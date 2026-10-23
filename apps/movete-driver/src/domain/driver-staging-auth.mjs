/**
 * Driver G22: Auth SDK bridge for an explicitly authorized STAGING environment.
 * No bundled project URL, anon/service key, real credentials, signup screen,
 * cookie storage, token persistence or default provider. NEVER LIVE.
 *
 * The injected SDK must verify the bearer via auth.getUser(jwt). In addition,
 * the isolated server MUST re-check the persisted exclusive Driver role;
 * verified JWT alone is insufficient.
 */
import {readDriverLicenseReadiness} from './driver-license-readiness.mjs';

export const DRIVER_STAGING_AUTH_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function checkOrigin(value){
 let url;
 try{url=new URL(value);}catch{throw Error('Driver STAGING Auth origin invalid');}
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||
    url.pathname!=='/'||url.search||url.hash||url.username||url.password)
  throw Error('Driver Auth bridge may connect only to isolated localhost QA');
 return url.origin;
}
function verifySessionRecord(data,now){
 if(!plain(data)||!plain(data.session)||data.error)return null;
 const record=data.session;
 if(typeof record.access_token!=='string'||!TOKEN.test(record.access_token)||
  !plain(record.user)||typeof record.user.id!=='string'||!UUID.test(record.user.id)||
  !Number.isFinite(record.expires_at)||record.expires_at*1000<=now()+30000)
  throw Error('Driver session expired');
 return record;
}
export function createDriverStagingAuthAdapter({
 auth,apiOrigin,request=fetch,now=Date.now
}={}){
 if(!plain(auth)||!['getSession','getUser','onAuthStateChange']
   .every(name=>typeof auth[name]==='function')||
   typeof request!=='function'||typeof now!=='function')
  throw Error('Independent trusted Driver Auth SDK required');
 const origin=checkOrigin(apiOrigin);
 return Object.freeze({
  async getSession(){
   let sessionRecord;
   try{
    const sessionResponse=await auth.getSession();
    sessionRecord=verifySessionRecord(sessionResponse?.data??null,now);
   }catch{
    throw Error('Driver session expired or not verified');
   }
   if(!sessionRecord)return null; // no account, no token stored
   const token=sessionRecord.access_token;
   let user;
   try{
    const verified=await auth.getUser(token);
    if(verified?.error||!plain(verified?.data)||!plain(verified.data.user))
     throw Error('Auth identity not confirmed');
    user=verified.data.user;
   }catch{throw Error('Driver session expired or not verified');}
   if(user.id!==sessionRecord.user.id||
     typeof user.id!=='string'||!UUID.test(user.id)||
     user.is_anonymous===true||
     !(typeof user.email_confirmed_at==='string'||
       typeof user.phone_confirmed_at==='string'))
    throw Error('Driver account identity invalid');
   // Positive role assertion MUST come from the server; never from user
   // metadata, the JWT's app_metadata, or a mobile toggle.
   const check=await readDriverLicenseReadiness({
    apiOrigin:origin,accessToken:token,request
   });
   if(check.driverEligible!==false||check.liveEnabled!==false)
    throw Error('Driver STAGING status invalid');
   return Object.freeze({userId:user.id,role:'driver',accessToken:token});
  },
  subscribe(notify){
   if(typeof notify!=='function')throw Error('Auth change listener required');
   const subscription=auth.onAuthStateChange(()=>{
    // Do not forward SDK session or bearer to listeners / UI.
    notify();
   });
   const remove=subscription?.data?.subscription?.unsubscribe;
   if(typeof remove!=='function')
    throw Error('Driver Auth change subscription unavailable');
   return ()=>{remove.call(subscription.data.subscription);};
  }
 });
}
