import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createDriverCustodyController} from './domain/driver-custody-controller.mjs';
import type {DriverCustodyController,DriverCustodyAdapters,
 DriverCustodySnapshot} from './domain/driver-custody-controller.mjs';
import type {DriverAuthSessionAdapter} from './domain/driver-workspace.mjs';
type ContextValue={
 state:DriverCustodySnapshot;enabled:boolean;hasProofSource:boolean;
 open:(id:string)=>Promise<void>;refresh:()=>Promise<void>;advance:()=>Promise<void>;
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
  refresh:async()=>{await ctl?.refresh();},
  advance:async()=>{await ctl?.advance();}
 }),[state,ctl,authAdapter]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDriverCustody(){
 const x=useContext(Context);
 if(!x)throw Error('G66 DriverCustodyProvider missing');
 return x;
}
