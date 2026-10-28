import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createDriverCustodyController} from './domain/driver-custody-controller.mjs';
import {verifyAcceptedPrivateDeliveryCustody}
 from './domain/driver-delivery-navigation.mjs';
import {createDriverDeliveryResume} from './domain/driver-delivery-resume.mjs';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
import type {DriverCustodyController,DriverCustodyAdapters,
 DriverCustodySnapshot} from './domain/driver-custody-controller.mjs';
import type {DriverAuthSessionAdapter} from './domain/driver-workspace.mjs';
type ContextValue={
 state:DriverCustodySnapshot;enabled:boolean;hasProofSource:boolean;
 open:(id:string)=>Promise<void>;
 openVerified:(id:string)=>Promise<boolean>;refresh:()=>Promise<void>;
 poll:()=>Promise<void>;advance:()=>Promise<void>;
 rememberDelivery:(id:string)=>Promise<{ok:boolean;code?:string;saved?:boolean}>;
 resumeDelivery:()=>Promise<{ok:boolean;code?:string;deliveryId?:string}>;
};
const EMPTY:DriverCustodySnapshot=Object.freeze({
 phase:'signed-out',deliveryId:null,status:null,revision:null,
 nextEvent:null,uncertain:false,proofVerified:false,qaOnly:true,productionEnabled:false
});
const Context=createContext<ContextValue|null>(null);
export function DriverCustodyProvider({
 children,authAdapter=null,qaAdapters=null
}:{
 children:React.ReactNode;authAdapter?:DriverAuthSessionAdapter|null;
 qaAdapters?:DriverCustodyAdapters|null;
}){
 const ctl:DriverCustodyController|null=useMemo(
  ()=>qaAdapters?createDriverCustodyController(qaAdapters):null,[qaAdapters]);
 const [state,setState]=useState<DriverCustodySnapshot>(()=>ctl?.current()??EMPTY);
 const recovery=useMemo(()=>ctl&&authAdapter?createDriverDeliveryResume({
  getSession:()=>authAdapter.getSession(),
  readAssignment:id=>verifyAcceptedPrivateDeliveryCustody({
   deliveryId:id,readCustody:()=>ctl.open(id)
  }),
  storage:Platform.OS==='web'?null:{
   get:key=>SecureStore.getItemAsync(key),
   put:(key,value)=>SecureStore.setItemAsync(key,value,{
    keychainAccessible:SecureStore.WHEN_UNLOCKED
   }),
   del:key=>SecureStore.deleteItemAsync(key)
  }
 }):null,[ctl,authAdapter]);
 useEffect(()=>{
  if(!ctl||!authAdapter){setState(EMPTY);return;}
  let active=true,epoch=0;
  const stop=ctl.subscribe(x=>{if(active)setState(x);});
  const verify=async()=>{
   const nonce=++epoch;
   ctl.clear();
   try{const session=await authAdapter.getSession();
    if(active&&nonce===epoch)ctl.setSession(session);
   }catch{if(active&&nonce===epoch)ctl.clear();}
  };
  let off:undefined|(()=>void);
  try{off=authAdapter.subscribe?.(()=>{void verify();});}
  catch{ctl.clear();}
  void verify();
  return ()=>{active=false;epoch++;off?.();stop();ctl.clear();};
 },[ctl,authAdapter]);
 const value=useMemo<ContextValue>(()=>({
  state,enabled:!!ctl&&!!authAdapter,
  hasProofSource:typeof qaAdapters?.obtainVerifiedProof==='function',
  open:async id=>{await ctl?.open(id);},
  openVerified:async id=>Boolean((await verifyAcceptedPrivateDeliveryCustody({
   deliveryId:id,readCustody:()=>ctl?.open(id)
  })).ok),
  refresh:async()=>{await ctl?.refresh();},
  poll:async()=>{await ctl?.poll();},
  advance:async()=>{await ctl?.advance();},
  rememberDelivery:async id=>recovery
   ?await recovery.remember(id):{ok:false,code:'CUSTODY_NOT_CONFIGURED'},
  resumeDelivery:async()=>recovery
   ?await recovery.resume():{ok:false,code:'CUSTODY_NOT_CONFIGURED'}
 }),[state,ctl,authAdapter,recovery]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDriverCustody(){
 const x=useContext(Context);
 if(!x)throw Error('G66 DriverCustodyProvider missing');
 return x;
}
