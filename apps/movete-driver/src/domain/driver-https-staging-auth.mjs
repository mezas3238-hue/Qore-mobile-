/**
 * G61B — independent Driver session SDK adapter for authorized HTTPS STAGING.
 * Does not authorize a Driver from token role claims or user metadata.
 * The role check must be backed by a separate server-side exclusive-role
 * endpoint; this file does not ship any such endpoint or provider credentials.
 */
import {assertDriverApprovedStagingOrigin}
 from './driver-chat-https-staging.mjs';
export const DRIVER_HTTPS_AUTH_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
export function createDriverHttpsStagingAuthAdapter({
 auth,apiOrigin,approvedStagingHost,verifyExclusiveDriverRole,
 allowedByOwner=false,liveEnabled=false,now=Date.now
}={}){
 if(allowedByOwner!==true||liveEnabled!==false||
  !plain(auth)||!['getSession','getUser','onAuthStateChange']
  .every(key=>typeof auth[key]==='function')||
  typeof verifyExclusiveDriverRole!=='function'||
  typeof now!=='function')
  throw Error('G61B independent approved STAGING Auth and role authority required');
 const origin=assertDriverApprovedStagingOrigin({
  apiOrigin,approvedStagingHost});
 return Object.freeze({
  async getSession(){
   let record;
   try{
    const result=await auth.getSession();
    if(result?.error||!plain(result?.data))throw Error('SDK session invalid');
    record=result.data.session;
   }catch{throw Error('Driver session expired or not verified');}
   if(record===null)return null;
   if(!plain(record)||!plain(record.user)||
    typeof record.access_token!=='string'||!TOKEN.test(record.access_token)||
    typeof record.user.id!=='string'||!UUID.test(record.user.id)||
    !Number.isSafeInteger(record.expires_at)||
    record.expires_at*1000<=now()+30000)
    throw Error('Driver session expired or not verified');
   const bearer=record.access_token;
   let user;
   try{
    const verified=await auth.getUser(bearer);
    if(verified?.error||!plain(verified?.data)||!plain(verified.data.user))
     throw Error('Independent getUser failed');
    user=verified.data.user;
   }catch{throw Error('Driver identity not verified');}
   if(user.id!==record.user.id||!UUID.test(user.id)||
    user.is_anonymous===true||
    !(typeof user.email_confirmed_at==='string'||
      typeof user.phone_confirmed_at==='string'))
    throw Error('Driver identity not verified');
   // Mobile role flags (including signed JWT app_metadata) NEVER authorize.
   let assigned;
   try{
    assigned=await verifyExclusiveDriverRole(Object.freeze({
     apiOrigin:origin,userId:user.id,accessToken:bearer}));
   }catch{throw Error('Driver role provider unavailable');}
   if(assigned!==true)throw Error('Driver exclusive role not authorized');
   // Any role or Auth change requires subscribers to purge all prior chats.
   return Object.freeze({role:'driver',userId:user.id,accessToken:bearer});
  },
  subscribe(notify){
   if(typeof notify!=='function')throw Error('Driver auth callback required');
   let subscription;
   try{
    subscription=auth.onAuthStateChange(()=>{
     // Never forward token or account details to UI listeners.
     notify();
    });
   }catch{throw Error('Driver Auth listener unavailable');}
   const unsubscribe=subscription?.data?.subscription?.unsubscribe;
   if(typeof unsubscribe!=='function')
    throw Error('Driver Auth unsubscribe missing');
   return ()=>{unsubscribe.call(subscription.data.subscription);};
  }
 });
}
