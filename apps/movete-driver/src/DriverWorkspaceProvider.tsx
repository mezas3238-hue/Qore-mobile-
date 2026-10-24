import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createDriverWorkspaceController} from './domain/driver-workspace.mjs';
import type {
 DriverAuthSessionAdapter,DriverWorkspaceSnapshot,DriverWorkspaceController,
 DriverWorkspaceControllerOptions
} from './domain/driver-workspace.mjs';

/**
 * UI composition root for the independent Driver application.
 * No credentials, mock users, demo dispatch or real network adapters are
 * supplied in the production app tree. Until an authorized Auth bridge and
 * isolated STAGING route are wired, all KYC/offers remain unavailable.
 */
type DriverWorkspaceContextValue={
 state:DriverWorkspaceSnapshot;
 refresh:()=>Promise<DriverWorkspaceSnapshot>;
 clear:()=>void;
};
const Context=createContext<DriverWorkspaceContextValue|null>(null);

export function DriverWorkspaceProvider({
 children,authAdapter=null,apiOrigin=null,
 approvedStagingHost=null,allowedByOwner=false,
 readInbox,readDocuments,readLicense
}:{
 children:React.ReactNode;
 authAdapter?:DriverAuthSessionAdapter|null;
 apiOrigin?:string|null;
 approvedStagingHost?:string|null;
 allowedByOwner?:boolean;
 readInbox?:DriverWorkspaceControllerOptions['readInbox'];
 readDocuments?:DriverWorkspaceControllerOptions['readDocuments'];
 readLicense?:DriverWorkspaceControllerOptions['readLicense'];
}){
 const controller:DriverWorkspaceController=useMemo(
  ()=>createDriverWorkspaceController({
    authAdapter,apiOrigin,approvedStagingHost,allowedByOwner,
    readInbox,readDocuments,readLicense
  }),[authAdapter,apiOrigin,approvedStagingHost,allowedByOwner,
    readInbox,readDocuments,readLicense]
 );
 const [state,setState]=useState<DriverWorkspaceSnapshot>(()=>controller.current());
 useEffect(()=>{
  // Set the visible snapshot immediately when the QA adapter changes.
  setState(controller.current());
  const unsubscribe=controller.subscribe(setState);
  const changed=()=>{
   controller.invalidate();
   void controller.refresh();
  };
  const stopAuth=authAdapter?.subscribe?.(changed);
  void controller.refresh();
  return ()=>{
   stopAuth?.();
   unsubscribe();
   controller.invalidate(); // invalidate pending asynchronous reads on unmount
  };
 },[controller,authAdapter]);
 const value=useMemo<DriverWorkspaceContextValue>(()=>({
  state,
  refresh:()=>controller.refresh(),
  clear:()=>{controller.invalidate();}
 }),[controller,state]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDriverWorkspace(){
 const context=useContext(Context);
 if(!context)throw Error('Driver workspace provider missing');
 return context;
}
