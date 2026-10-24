import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createDriverOfferActionsController}
 from './domain/driver-offer-actions.mjs';
import type {DriverOfferActionsController,DriverOfferActionsAdapters,
 DriverOfferActionsSnapshot,OfferAction}
 from './domain/driver-offer-actions.mjs';
import type {DriverAuthSessionAdapter} from './domain/driver-workspace.mjs';
import {useDriverWorkspace} from './DriverWorkspaceProvider';

type State=Omit<DriverOfferActionsSnapshot,'phase'>&{
 phase:DriverOfferActionsSnapshot['phase']|'not-configured';
};
type ContextValue={
 state:State;enabled:boolean;
 decide:(offerId:string,action:OfferAction)=>Promise<void>;
};
const OFF:State=Object.freeze({phase:'not-configured',
 offers:Object.freeze([]),decisions:Object.freeze([]),
 busy:false,qaOnly:true,productionEnabled:false});
const Context=createContext<ContextValue|null>(null);
export function DriverOfferActionsProvider({
 children,authAdapter=null,qaAdapters=null
}:{
 children:React.ReactNode;
 authAdapter?:DriverAuthSessionAdapter|null;
 qaAdapters?:DriverOfferActionsAdapters|null;
}){
 const {state:workspace}=useDriverWorkspace();
 const controller:DriverOfferActionsController|null=useMemo(
  ()=>qaAdapters?createDriverOfferActionsController(qaAdapters):null,
  [qaAdapters]);
 const [state,setState]=useState<State>(()=>controller?.current()??OFF);
 useEffect(()=>{
  if(!controller||!authAdapter){setState(OFF);return;}
  let active=true,epoch=0;
  setState(controller.current());
  const unsubscribe=controller.subscribe(value=>{
   if(active)setState(value);
  });
  const synchronize=async()=>{
   const nonce=++epoch;
   controller.clear(); // immediately remove stale offer/action state
   try{
    const verified=await authAdapter.getSession();
    if(!active||epoch!==nonce)return;
    controller.setSession(verified);
   }catch{if(active&&epoch===nonce)controller.clear();}
  };
  let stop:undefined|(()=>void);
  try{stop=authAdapter.subscribe?.(()=>{void synchronize();});}
  catch{controller.clear();}
  void synchronize();
  return ()=>{active=false;epoch++;stop?.();unsubscribe();controller.clear();};
 },[controller,authAdapter]);
 useEffect(()=>{
  if(!controller||!authAdapter)return;
  if(workspace.phase==='connected'){
   controller.setOffers(workspace.offers,
    {currentLicenseApproved:workspace.currentLicenseApproved});
  }else{
   // A stale inbox must not remain actionable during offline, refresh or logout.
   controller.setOffers([],{currentLicenseApproved:false});
  }
 },[controller,authAdapter,workspace]);
 const context=useMemo<ContextValue>(()=>({
  state,enabled:!!controller&&!!authAdapter,
  decide:async(offerId,action)=>{
   // No actions when the workspace is offline/reauthenticating.
   if(workspace.phase!=='connected'||!workspace.currentLicenseApproved)return;
   await controller?.decide({offerId,action});
  }
 }),[state,controller,authAdapter,workspace]);
 return <Context.Provider value={context}>{children}</Context.Provider>;
}
export function useDriverOfferActions(){
 const value=useContext(Context);
 if(value===null)throw Error('Driver offer actions provider missing');
 return value;
}
