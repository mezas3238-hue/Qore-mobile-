import React,{createContext,useCallback,useContext,useEffect,useMemo,useState}
 from 'react';
import {recoverOriginalDriverMoto} from './domain/driver-moto-current-resume.mjs';
import type {DriverMotoJourney} from './domain/driver-moto-journey-http.mjs';
import {createDriverMotoJourneyController}
 from './domain/driver-moto-journey.mjs';
import type {DriverMotoAdapters,DriverMotoController,DriverMotoSnapshot}
 from './domain/driver-moto-journey.mjs';
import type {DriverAuthSessionAdapter} from './domain/driver-workspace.mjs';
type Value=Readonly<{
 state:DriverMotoSnapshot;enabled:boolean;
 recoverCurrent:()=>Promise<{ok:boolean;bookingKey?:string;reason?:string}>;
 open:(bookingKey:string)=>Promise<void>;
 refresh:()=>Promise<void>;advance:()=>Promise<void>;
}>;
const OFF:DriverMotoSnapshot=Object.freeze({phase:'signed-out',
 bookingKey:null,tripId:null,status:null,revision:null,nextState:null,
 uncertain:false,qaOnly:true,productionEnabled:false});
const Context=createContext<Value|null>(null);
export function DriverMotoJourneyProvider({
 children,authAdapter=null,qaAdapters=null,currentReader=null
}:{
 children:React.ReactNode;authAdapter?:DriverAuthSessionAdapter|null;
 qaAdapters?:DriverMotoAdapters|null;
 currentReader?:Readonly<{readCurrent:(p:{accessToken:string})=>Promise<DriverMotoJourney|null>}>|null;
}){
 const controller:DriverMotoController|null=useMemo(
  ()=>qaAdapters?createDriverMotoJourneyController(qaAdapters):null,
  [qaAdapters]);
 const [state,setState]=useState<DriverMotoSnapshot>(()=>controller?.current()??OFF);
 useEffect(()=>{
  if(!controller||!authAdapter){setState(OFF);return;}
  let active=true,epoch=0;
  const stopSnapshot=controller.subscribe(s=>{if(active)setState(s);});
  const sync=async()=>{
   const version=++epoch;
   controller.clear();
   try{
    const user=await authAdapter.getSession();
    if(active&&version===epoch)controller.setSession(user);
   }catch{if(active&&version===epoch)controller.clear();}
  };
  let stop:undefined|(()=>void);
  try{stop=authAdapter.subscribe?.(()=>{void sync();});}
  catch{controller.clear();}
  void sync();
  return ()=>{active=false;epoch++;stop?.();stopSnapshot();controller.clear();};
 },[controller,authAdapter]);
 const open=useCallback(async(bookingKey:string)=>{
  await controller?.open(bookingKey);
 },[controller]);
 const refresh=useCallback(async()=>{await controller?.refresh();},[controller]);
 const advance=useCallback(async()=>{await controller?.advance();},[controller]);
 const recoverCurrent=useCallback(async()=>{
  if(!controller||!authAdapter||!currentReader)
   return {ok:false,reason:'MOTO_NOT_CONFIGURED'};
  return recoverOriginalDriverMoto({
   getSession:()=>authAdapter.getSession(),
   readCurrent:currentReader.readCurrent,
   openOriginal:key=>controller.open(key)
  });
 },[controller,authAdapter,currentReader]);
 const context=useMemo<Value>(()=>({
  state,enabled:!!controller&&!!authAdapter,
  open,refresh,advance,recoverCurrent
 }),[state,controller,authAdapter,open,refresh,advance,recoverCurrent]);
 return <Context.Provider value={context}>{children}</Context.Provider>;
}
export function useDriverMotoJourney(){
 const value=useContext(Context);
 if(!value)throw Error('G188 Driver MOTO provider required');
 return value;
}
