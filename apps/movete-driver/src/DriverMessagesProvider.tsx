import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createDriverMessagingController} from './domain/driver-messaging.mjs';
import type {
 DriverMessagingAdapters,DriverMessagingController,DriverMessagingSnapshot
} from './domain/driver-messaging.mjs';
import type {DriverAuthSessionAdapter} from './domain/driver-workspace.mjs';

/** G60A: independent Driver chat. No default provider, HTTP, credentials or LIVE. */
type DriverMessagesView=Omit<DriverMessagingSnapshot,'phase'>&{
 phase:DriverMessagingSnapshot['phase']|'not-configured';
};
type MessagesContextValue={
 state:DriverMessagesView;configured:boolean;
 refreshInbox:()=>Promise<void>;loadMoreInbox:()=>Promise<void>;
 open:(conversationId:string)=>Promise<void>;loadOlder:()=>Promise<void>;
 backToInbox:()=>void;sendMessage:(body:string)=>Promise<void>;
 reconcilePending:()=>Promise<void>;confirmVisible:(id:string)=>Promise<void>;
 clear:()=>void;
};
const OFF:DriverMessagesView=Object.freeze({
 phase:'not-configured',conversations:Object.freeze([]),hasMore:false,
 conversation:null,messages:Object.freeze([]),hasOlder:false,
 sendState:'idle',latestRevision:0,lastConfirmedId:null,
 readConfirmedIds:Object.freeze([]),canCompose:false,
 qaOnly:true,productionEnabled:false
});
const Context=createContext<MessagesContextValue|null>(null);

export function DriverMessagesProvider({
 children,authAdapter=null,qaAdapters=null
}:{
 children:React.ReactNode;
 authAdapter?:DriverAuthSessionAdapter|null;
 qaAdapters?:DriverMessagingAdapters|null;
}){
 // No QA functions are wired in the shipped app composition root: G60A stays OFF.
 const controller:DriverMessagingController|null=useMemo(
  ()=>qaAdapters?createDriverMessagingController(qaAdapters):null,[qaAdapters]);
 const [state,setState]=useState<DriverMessagesView>(()=>controller?.current()??OFF);
 useEffect(()=>{
  if(!controller||!authAdapter){
   setState(OFF);
   return;
  }
  let active=true;
  setState(controller.current());
  const unlisten=controller.subscribe(next=>{if(active)setState(next);});
  const synchronize=async()=>{
   controller.clear(); // immediate logout/actor-change privacy purge
   try{
    const identity=await authAdapter.getSession();
    if(!active)return;
    controller.setSession(identity);
    if(identity!==null)await controller.refreshInbox();
   }catch{if(active)controller.invalidate();}
  };
  let stop:undefined|(()=>void);
  try{stop=authAdapter.subscribe?.(()=>{void synchronize();});}
  catch{controller.invalidate();}
  void synchronize();
  return ()=>{
   active=false;stop?.();unlisten();controller.clear();
  };
 },[controller,authAdapter]);
 const value=useMemo<MessagesContextValue>(()=>({
  state,configured:!!controller&&!!authAdapter,
  refreshInbox:async()=>{await controller?.refreshInbox();},
  loadMoreInbox:async()=>{await controller?.loadMoreInbox();},
  open:async id=>{await controller?.open(id);},
  loadOlder:async()=>{await controller?.loadOlder();},
  backToInbox:()=>{controller?.backToInbox();},
  sendMessage:async body=>{await controller?.sendMessage(body);},
  reconcilePending:async()=>{await controller?.reconcilePending();},
  confirmVisible:async id=>{await controller?.confirmVisible(id);},
  clear:()=>{controller?.clear();}
 }),[controller,authAdapter,state]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDriverMessages(){
 const value=useContext(Context);
 if(value===null)throw Error('Driver Messages Provider required');
 return value;
}
