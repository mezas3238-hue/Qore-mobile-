import React,{createContext,useContext,useEffect,useMemo,useRef,useState}
 from 'react';
import {AppState} from 'react-native';
import {driverKycScreenNotice,verifyDriverKycForOffer}
 from './domain/driver-kyc-expiry.mjs';
import type {DriverKycExpirySnapshot}
 from './domain/driver-kyc-expiry.mjs';
import type {DriverHttpsStagingAuthAdapter}
 from './domain/driver-https-staging-auth.mjs';
export type DriverKycExpiryAdapter=Readonly<{
 readStatus:(input:{accessToken:string})=>Promise<DriverKycExpirySnapshot>;
}>;
type Value=Readonly<{
 phase:'not-configured'|'checking'|'signed-out'|'connected'|'offline';
 snapshot:DriverKycExpirySnapshot|null;
 notice:Readonly<{severity:'warning'|'info';text:string}>;
 refresh:()=>Promise<void>;
 verifyForOffer:()=>Promise<boolean>;
}>;
const Ctx=createContext<Value|null>(null);
export function DriverKycExpiryProvider({children,authAdapter=null,adapter=null}:{
 children:React.ReactNode;authAdapter?:DriverHttpsStagingAuthAdapter|null;
 adapter?:DriverKycExpiryAdapter|null;
}){
 const epoch=useRef(0);
 const [phase,setPhase]=useState<Value['phase']>(adapter?'checking':'not-configured');
 const [snapshot,setSnapshot]=useState<DriverKycExpirySnapshot|null>(null);
 const refresh=async()=>{
  const seq=++epoch.current;
  setSnapshot(null);
  if(!adapter||!authAdapter){setPhase('not-configured');return;}
  setPhase('checking');
  try{
   const identity=await authAdapter.getSession();
   if(epoch.current!==seq)return;
   if(identity===null){setPhase('signed-out');return;}
   const result=await adapter.readStatus({accessToken:identity.accessToken});
   if(epoch.current!==seq)return;
   setSnapshot(result);setPhase('connected');
  }catch{
   if(epoch.current!==seq)return;
   setSnapshot(null);setPhase('offline');
  }
 };
 useEffect(()=>{
  const revoke=()=>{++epoch.current;setSnapshot(null);void refresh();};
  const unsubscribe=authAdapter?.subscribe?.(revoke);
  const foreground=AppState.addEventListener('change',s=>{
   if(s==='active')void refresh();
  });
  // Changes at the authoritative expiry instant are observed on screen
  // without trusting any stored device expiry time.
  const everyMinute=setInterval(()=>{
   if(AppState.currentState==='active')void refresh();
  },60000);
  void refresh();
  return ()=>{
   ++epoch.current;unsubscribe?.();foreground.remove();
   clearInterval(everyMinute);
  };
 },[authAdapter,adapter]);
 // Verify fresh documents with identity recheck immediately before accept.
 const verifyForOffer=async():Promise<boolean>=>{
  if(!adapter||!authAdapter)return false;
  const seq=epoch.current;
  const proof=await verifyDriverKycForOffer({
   getSession:()=>authAdapter.getSession(),
   readStatus:params=>adapter.readStatus(params),
   isCurrent:()=>epoch.current===seq
  });
  if(epoch.current!==seq)return false;
  if(!proof.ok){setSnapshot(null);setPhase('offline');}
  return proof.ok;
 };
 const notice=useMemo(()=>driverKycScreenNotice(
  phase==='connected'?snapshot:null
 ),[phase,snapshot]);
 return <Ctx.Provider value={{phase,snapshot,notice,refresh,verifyForOffer}}>
  {children}
 </Ctx.Provider>;
}
export function useDriverKycExpiry(){
 const ctx=useContext(Ctx);
 if(!ctx)throw Error('Driver KYC expiry provider missing');
 return ctx;
}
