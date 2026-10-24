import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createDriverTripLifecycleController} from './domain/driver-trip-lifecycle.mjs';
import type {DriverTripAdapters,DriverTripController,DriverTripSnapshot}
 from './domain/driver-trip-lifecycle.mjs';
import type {DriverAuthSessionAdapter} from './domain/driver-workspace.mjs';
type TripContext={
 state:DriverTripSnapshot;enabled:boolean;
 open:(tripId:string)=>Promise<void>;
 refresh:()=>Promise<void>;advance:()=>Promise<void>;
};
const OFF:DriverTripSnapshot=Object.freeze({
 phase:'signed-out',tripId:null,status:null,revision:null,
 nextEvent:null,uncertain:false,qaOnly:true,productionEnabled:false
});
const Context=createContext<TripContext|null>(null);
export function DriverTripProvider({
 children,authAdapter=null,qaAdapters=null
}:{
 children:React.ReactNode;authAdapter?:DriverAuthSessionAdapter|null;
 qaAdapters?:DriverTripAdapters|null;
}){
 const controller:DriverTripController|null=useMemo(
  ()=>qaAdapters?createDriverTripLifecycleController(qaAdapters):null,
  [qaAdapters]);
 const [state,setState]=useState<DriverTripSnapshot>(()=>controller?.current()??OFF);
 useEffect(()=>{
  if(!controller||!authAdapter){setState(OFF);return;}
  let active=true,epoch=0;
  const stopSnapshot=controller.subscribe(s=>{if(active)setState(s);});
  const verify=async()=>{
   const current=++epoch;
   controller.clear();
   try{
    const auth=await authAdapter.getSession();
    if(active&&current===epoch)controller.setSession(auth);
   }catch{if(active&&current===epoch)controller.clear();}
  };
  let unsubscribe:undefined|(()=>void);
  try{unsubscribe=authAdapter.subscribe?.(()=>{void verify();});}
  catch{controller.clear();}
  void verify();
  return ()=>{active=false;epoch++;unsubscribe?.();stopSnapshot();controller.clear();};
 },[controller,authAdapter]);
 const ctx=useMemo<TripContext>(()=>({
  state,enabled:!!controller&&!!authAdapter,
  open:async tripId=>{await controller?.open(tripId);},
  refresh:async()=>{await controller?.refresh();},
  advance:async()=>{await controller?.advance();}
 }),[state,controller,authAdapter]);
 return <Context.Provider value={ctx}>{children}</Context.Provider>;
}
export function useDriverTrip(){
 const ctx=useContext(Context);
 if(ctx===null)throw Error('G65 DriverTripProvider required');
 return ctx;
}
