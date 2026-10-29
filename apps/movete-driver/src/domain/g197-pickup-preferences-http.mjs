/**
 * G197: Driver's pickup radius is actual server road-distance (meters).
 * Native Client never calculates, signs or trusts a GPS circle. Staging only,
 * pinned HTTPS, independently verified exclusive Driver Auth.
 */
import {readBoundedResponseText} from '../../../movete-cliente/src/domain/bounded-http-response.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const KINDS=['RIDE','DELIVERY','MERCHANT_ORDER'];
const BANDS=[1000,2000,3000,5000,8000,10000,15000,20000,30000,50000];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const fail=code=>Object.freeze({ok:false,code});
function pinned(url){
 try{
  if(typeof url!=='string'||url.includes('\\'))return null;
  const u=new URL(url);
  return u.protocol==='https:'&&u.origin===url&&u.pathname==='/'&&
   !u.username&&!u.password&&!u.port&&!u.hash&&!u.search&&
   /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\\.onrender\\.com$/.test(u.hostname)
   ?u.origin:null;
 }catch{return null;}
}
function validateSession(s){
 return obj(s)&&s.role==='driver'&&UUID.test(s.userId??'')&&
 typeof s.accessToken==='string'&&
 /^[A-Za-z0-9._~-]{20,7900}$/.test(s.accessToken);
}
const same=(a,b)=>a.userId===b.userId&&a.accessToken===b.accessToken;
function validRow(x){return exact(x,['serviceKind','maximumRoadMeters','revision'])
 &&KINDS.includes(x.serviceKind)&&BANDS.includes(x.maximumRoadMeters)
 &&Number.isSafeInteger(x.revision)&&x.revision>=1;}
function verified(x,actor,method,kind,meters,version){
 if(!obj(x)||x.mode!=='STAGING_DEMO_ONLY'||x.driverId!==actor.userId
  ||x.productionEnabled!==false||x.liveEnabled!==false)return false;
 if(method==='GET')return exact(x,['mode','driverId','preferences',
  'productionEnabled','liveEnabled'])&&Array.isArray(x.preferences)
  &&x.preferences.length<=3&&x.preferences.every(validRow)
  &&new Set(x.preferences.map(v=>v.serviceKind)).size===x.preferences.length;
 return exact(x,['mode','driverId','serviceKind','maximumRoadMeters',
  'revision','serverPersisted','liveEnabled','productionEnabled'])
  &&x.serviceKind===kind&&x.maximumRoadMeters===meters&&x.serverPersisted===true
  &&Number.isSafeInteger(x.revision)&&x.revision===version+1;
}
export function createG197DriverPickupPreferencesHttp({
 enabled=false,ownerApproved=false,serverRoleVerified=false,
 roadEnforcementVerified=false,origin,pinnedOrigin,getSession,request=fetch,
 timeoutMs=8000,now=Date.now
}={}){
 const host=pinned(origin);
 const ready=enabled===true&&ownerApproved===true&&serverRoleVerified===true
  &&roadEnforcementVerified===true&&host!==null&&host===pinned(pinnedOrigin)
  &&typeof getSession==='function'&&typeof request==='function';
 let busy=false;
 async function perform(method,body){
  if(!ready)return fail('G197_STAGING_NOT_CERTIFIED');
  if(busy)return fail('G197_BUSY');
  if(method==='PUT'&&(!KINDS.includes(body?.serviceKind)
   ||!BANDS.includes(body?.maximumRoadMeters)
   ||!Number.isSafeInteger(body?.expectedRevision)||body.expectedRevision<0))
   return fail('G197_INVALID_PREFERENCE');
  busy=true;let timer;
  const ctrl=new AbortController();
  try{
   const before=await getSession();
   if(!validateSession(before))return fail('G197_AUTH_REQUIRED');
   const delay=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000
    ?timeoutMs:8000;
   timer=setTimeout(()=>ctrl.abort(),delay);
   const deadline=now()+delay;
   const res=await request(host+'/v1/staging/driver/pickup-preferences',{
    method,headers:{Authorization:'Bearer '+before.accessToken,
     Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',signal:ctrl.signal
   });
   if(!res||res.redirected||ctrl.signal.aborted||now()>=deadline)
    return fail('G197_UNKNOWN_OUTCOME');
   const after=await getSession();
   if(!validateSession(after)||!same(before,after))
    return fail('G197_SESSION_CHANGED');
   if(res.status!==200||res.ok!==true)return fail('G197_SERVER_DENIED');
   if(!/^application\\/json(?:\\s*;|$)/i.test(res.headers?.get?.('content-type')??''))
    return fail('G197_INVALID_RECEIPT');
   const size=res.headers?.get?.('content-length');
   if(size!=null&&(!/^\\d+$/.test(size)||Number(size)>4096))
    return fail('G197_INVALID_RECEIPT');
   const loaded=await readBoundedResponseText(res,{limit:4096,signal:ctrl.signal,
    timedOut:()=>ctrl.signal.aborted||now()>=deadline});
   if(!loaded.ok)return fail('G197_INVALID_RECEIPT');
   let parsed;
   try{parsed=JSON.parse(loaded.text);}catch{return fail('G197_INVALID_RECEIPT');}
   if(!verified(parsed,before,method,body?.serviceKind,
    body?.maximumRoadMeters,body?.expectedRevision))
    return fail('G197_UNTRUSTED_RECEIPT');
   const final=await getSession();
   if(!validateSession(final)||!same(before,final))
    return fail('G197_SESSION_CHANGED');
   return Object.freeze({ok:true,data:Object.freeze(parsed),
    qaOnly:true,productionEnabled:false});
  }catch{return fail('G197_UNKNOWN_OUTCOME');}
  finally{if(timer)clearTimeout(timer);busy=false;}
 }
 return Object.freeze({isConfigured:()=>ready,
  read:()=>perform('GET'),
  update:(serviceKind,maximumRoadMeters,expectedRevision)=>
   perform('PUT',{serviceKind,maximumRoadMeters,expectedRevision}),
  productionEnabled:false});
}
