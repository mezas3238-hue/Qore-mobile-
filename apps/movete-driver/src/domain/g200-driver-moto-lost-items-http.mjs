/** G200 native Driver post-trip lost items inbox. Independent Driver Auth;
 * only cases returned from backend identity-scoped inbox are selectable.
 * SQL additionally verifies Driver is original trip assignee and stationary.
 */
import {readG178BoundedDriverLifecycleJson} from './g178-bounded-driver-lifecycle-json.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,k)=>obj(x)&&Object.keys(x).length===k.length&&k.every(f=>Object.hasOwn(x,f));
const fail=code=>Object.freeze({ok:false,code,retrySafe:false});
function hostOf(value){
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const u=new URL(value);
  return u.protocol==='https:'&&u.origin===value&&u.pathname==='/'&&
   !u.username&&!u.password&&!u.port&&!u.hash&&!u.search&&
   /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(u.hostname)
   ?u.origin:null;
 }catch{return null;}
}
const validActor=x=>obj(x)&&x.role==='driver'&&UUID.test(x.userId??'')&&
 typeof x.accessToken==='string'&&
 /^[A-Za-z0-9._~-]{20,7900}$/.test(x.accessToken);
function validResponse(dto,op,actor,caseId,key){
 if(!obj(dto)||dto.mode!=='STAGING_DEMO_ONLY'||dto.qaOnly!==true
  ||dto.productionEnabled!==false)return false;
 if(op==='inbox')return exact(dto,['mode','driverId','cases','qaOnly','productionEnabled'])
  &&dto.driverId===actor.userId&&Array.isArray(dto.cases)&&dto.cases.length<=50
  &&dto.cases.every(c=>exact(c,['caseId','tripId','state','expiresAtMs'])
   &&UUID.test(c.caseId)&&UUID.test(c.tripId)&&c.state==='OPEN'
   &&Number.isSafeInteger(c.expiresAtMs));
 if(op==='read')return exact(dto,['mode','caseId','tripId','state',
  'canSend','expiresAtMs','messages','qaOnly','productionEnabled'])
  &&dto.caseId===caseId&&UUID.test(dto.tripId)&&
  ['OPEN','CLOSED','BLOCKED'].includes(dto.state)&&
  typeof dto.canSend==='boolean'&&Array.isArray(dto.messages)&&
  dto.messages.length<=60&&dto.messages.every(m=>
   exact(m,['messageId','senderRole','body','createdAtMs'])
   &&UUID.test(m.messageId)&&['passenger','driver'].includes(m.senderRole)
   &&typeof m.body==='string'&&m.body.length<=500
   &&Number.isSafeInteger(m.createdAtMs));
 return exact(dto,['mode','caseId','messageId','requestKey',
  'serverPersisted','qaOnly','productionEnabled'])
  &&dto.caseId===caseId&&dto.requestKey===key&&
  UUID.test(dto.messageId)&&dto.serverPersisted===true;
}
export function createG200DriverMotoLostItemsHttp({
 enabled=false,ownerApproved=false,postTripCertified=false,
 verifiedStoppedProvider=false,origin,pinnedOrigin,getSession,
 request=fetch,now=Date.now
}={}){
 const host=hostOf(origin);
 const ready=enabled===true&&ownerApproved===true&&postTripCertified===true
  &&verifiedStoppedProvider===true&&host!==null&&host===hostOf(pinnedOrigin)
  &&typeof getSession==='function'&&typeof request==='function';
 let busy=false;
 async function action(op,{caseId,requestKey,body}={}){
  if(!ready)return fail('G200_DRIVER_UNAVAILABLE');
  if(busy)return fail('G200_DRIVER_BUSY');
  if(op!=='inbox'&&!UUID.test(caseId??'')||
    op==='send'&&(!UUID.test(requestKey??'')||
     typeof body!=='string'||body!==body.trim()||
     body.length<1||body.length>500))
    return fail('G200_INVALID_SCOPE');
  busy=true;const controller=new AbortController();let timer;
  try{
   const before=await getSession();
   if(!validActor(before))return fail('G200_DRIVER_AUTH_REQUIRED');
   const deadline=now()+8000;timer=setTimeout(()=>controller.abort(),8000);
   const isSend=op==='send';
   const data=isSend?{requestKey,body}:undefined;
   const path=op==='inbox'?'/v1/staging/driver/moto/lost-items':
    '/v1/staging/moto/lost-items/'+caseId+(isSend?'/messages':'');
   const response=await request(host+path,{
    method:isSend?'POST':'GET',credentials:'omit',redirect:'error',
    cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal,
    headers:{Authorization:'Bearer '+before.accessToken,Accept:'application/json',
     ...(data?{'Content-Type':'application/json'}:{})},
    ...(data?{body:JSON.stringify(data)}:{})
   });
   if(controller.signal.aborted||now()>=deadline||response?.redirected)
    return fail('G200_DRIVER_UNKNOWN_OUTCOME');
   const after=await getSession();
   if(!validActor(after)||after.userId!==before.userId||
    after.accessToken!==before.accessToken)return fail('G200_DRIVER_SESSION_CHANGED');
   if(response?.status!==200||response.ok!==true)
    return fail('G200_DRIVER_SERVER_DENIED');
   const type=response.headers?.get?.('content-type');
   if(!/^application\/json(?:\s*;|$)/i.test(type??''))
    return fail('G200_DRIVER_BAD_CONTENT_TYPE');
   // Driver-owned 16KiB streaming JSON guard; never import Cliente internals.
   // Preserve the original deadline and never retry a possibly committed POST.
   let dto;
   try{
    dto=await readG178BoundedDriverLifecycleJson({
     request:async()=>response,url:host+path,options:{method:'GET'},
     timeoutMs:Math.max(100,deadline-now()),maxBytes:16384
    });
   }catch{return fail('G200_DRIVER_UNKNOWN_OUTCOME');}
   if(controller.signal.aborted||now()>=deadline)
    return fail('G200_DRIVER_UNKNOWN_OUTCOME');
   if(!validResponse(dto,op,before,caseId,requestKey))
    return fail('G200_DRIVER_BAD_RECEIPT');
   const final=await getSession();
   if(!validActor(final)||final.userId!==before.userId||
    final.accessToken!==before.accessToken)
    return fail('G200_DRIVER_SESSION_CHANGED');
   return Object.freeze({ok:true,data:Object.freeze(dto),qaOnly:true,productionEnabled:false});
  }catch{return fail('G200_DRIVER_UNKNOWN_OUTCOME');}
  finally{if(timer)clearTimeout(timer);busy=false;}
 }
 return Object.freeze({isConfigured:()=>ready,
  inbox:()=>action('inbox'),read:caseId=>action('read',{caseId}),
  send:(caseId,requestKey,body)=>action('send',{caseId,requestKey,body}),
  productionEnabled:false});
}
