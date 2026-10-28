import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import type {DriverAuthSessionAdapter} from './domain/driver-workspace.mjs';
import type {DriverCurrentTrip} from './domain/driver-current-trip-http.mjs';
import {verifyPrivateDriverCurrentTrip} from './domain/driver-current-trip-session.mjs';

export type DriverCurrentTripReader=Readonly<{
 readCurrent:(input:{accessToken:string})=>Promise<DriverCurrentTrip|null>;
}>;
type State=Readonly<{
 phase:'not-configured'|'signed-out'|'loading'|'none'|'active'|
 'offline'|'authorization-required';
 trip:DriverCurrentTrip|null;
}>;
type ContextValue=Readonly<{
 state:State;enabled:boolean;refresh:()=>Promise<DriverCurrentTrip|null>;
}>;
const OFF:State=Object.freeze({phase:'not-configured',trip:null});
const SIGNED_OUT:State=Object.freeze({phase:'signed-out',trip:null});
const Context=createContext<ContextValue|null>(null);

/** No local trip cache or default network adapter. Auth rotations immediately
 * revoke any visible prior assignment; delayed responses are discarded. */
export function DriverCurrentTripProvider({
 children,authAdapter=null,reader=null
}:{
 children:React.ReactNode;
 authAdapter?:DriverAuthSessionAdapter|null;
 reader?:DriverCurrentTripReader|null;
}){
 const generation=useRef(0);
 const enabled=!!authAdapter&&!!reader;
 const [state,setState]=useState<State>(enabled?SIGNED_OUT:OFF);
 const refresh=useCallback(async()=>{
  const sequence=++generation.current;
  setState({phase:enabled?'loading':'not-configured',trip:null});
  if(!authAdapter||!reader)return null;
  try{
   const session=await authAdapter.getSession();
   if(generation.current!==sequence)return null;
   if(!session){setState(SIGNED_OUT);return null;}
   if(session.role!=='driver'){
    setState({phase:'authorization-required',trip:null});return null;
   }
   const trip=await verifyPrivateDriverCurrentTrip({
    session,readCurrent:reader.readCurrent,getSession:()=>authAdapter.getSession()
   });
   if(generation.current!==sequence)return null;
   setState({phase:trip?'active':'none',trip});
   return trip;
  }catch{
   if(generation.current===sequence)setState({phase:'offline',trip:null});
   return null;
  }
 },[authAdapter,reader,enabled]);
 useEffect(()=>{
  ++generation.current;
  setState(enabled?SIGNED_OUT:OFF);
  const changed=()=>{
   ++generation.current;setState(SIGNED_OUT);
   void refresh();
  };
  const stop=authAdapter?.subscribe?.(changed);
  void refresh();
  return ()=>{++generation.current;stop?.();setState(OFF);};
 },[authAdapter,refresh,enabled]);
 return <Context.Provider value={{state,enabled,refresh}}>
  {children}
 </Context.Provider>;
}
export function useDriverCurrentTrip(){
 const context=useContext(Context);
 if(!context)throw Error('G106 Driver current trip provider required');
 return context;
}
