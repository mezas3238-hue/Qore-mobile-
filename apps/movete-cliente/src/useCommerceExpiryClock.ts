import {useEffect,useState} from 'react';
import {AppState} from 'react-native';
import {commerceExpiryRefreshDelay} from './domain/commerce-ttl-refresh.mjs';

/**
 * R47 - Force UI re-render at expiry, and after returning to foreground.
 * React snapshots do not re-render just because Date.now() changes.
 * No network calls, renewals, native permissions, or long-lived storage.
 */
export function useCommerceExpiryClock(expiresAt:number|null):number{
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{
  let active=true;
  let timer:ReturnType<typeof setTimeout>|null=null;
  const refresh=()=>{
   if(!active)return;
   if(timer!==null){clearTimeout(timer);timer=null;}
   const instant=Date.now();
   setNow(instant);
   const delay=commerceExpiryRefreshDelay(expiresAt,instant);
   if(delay!==null&&delay>0)timer=setTimeout(refresh,delay);
  };
  refresh();
  const listener=AppState.addEventListener('change',state=>{
   if(state==='active')refresh();
  });
  return ()=>{
   active=false;
   if(timer!==null)clearTimeout(timer);
   listener.remove();
  };
 },[expiresAt]);
 return now;
}
