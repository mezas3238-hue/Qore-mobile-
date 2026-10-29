/**
 * G198 original completed ride lost-item case; NOT the active ride chat G50.
 * Same Passenger provider session, private trip, explicit opt-in and bounded
 * REST. No phone/email exchange, no new booking, no GPS or payment.
 */
import {readBoundedResponseText} from './bounded-http-response.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(v,k)=>obj(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const deny=code=>Object.freeze({ok:false,code,retrySafe:false});
function originOnly(value){
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const url=new URL(value);
  return url.protocol==='https:'&&url.origin===value&&url.pathname==='/'&&
   !url.port&&!url.username&&!url.password&&!url.hash&&!url.search&&
   /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(url.hostname)
   ?url.origin:null;
 }catch{return null;}
}
const session=x=>obj(x)&&x.role==='passenger'&&UUID.test(x.subject??'')&&
 typeof x.token==='string'&&/^[A-Za-z0-9._~-]{20,7900}$/.test(x.token)&&
 Number.isSafeInteger(x.expiresAt)&&x.expiresAt>Date.now()+1000&&
 Number.isSafeInteger(x.privateViewRevision)&&x.privateViewRevision>=0;
const same=(a,b)=>a.subject===b.subject&&a.token===b.token&&
 a.expiresAt===b.expiresAt&&a.privateViewRevision===b.privateViewRevision;
const OPEN=['mode','caseId','tripId','state','expiresAtMs','qaOnly','productionEnabled'];
const READ=['mode','caseId','tripId','state','canSend','expiresAtMs','messages','qaOnly','productionEnabled'];
const MESSAGE=['mode','caseId','messageId','requestKey','serverPersisted','qaOnly','productionEnabled'];
const msg=x=>exact(x,['messageId','senderRole','body','createdAtMs'])&&
 UUID.test(x.messageId)&&['passenger','driver'].includes(x.senderRole)&&
 typeof x.body==='string'&&x.body.length>=1&&x.body.length<=500&&
 Number.isSafeInteger(x.createdAtMs)&&x.createdAtMs>0;
function proof(x,operation,scope){
 if(!obj(x)||x.mode!=='STAGING_DEMO_ONLY'||x.qaOnly!==true||
  x.productionEnabled!==false)return false;
 if(operation==='open')return exact(x,OPEN)&&x.tripId===scope.tripId&&
 UUID.test(x.caseId)&&['OPEN','CLOSED','BLOCKED'].includes(x.state)&&
 Number.isSafeInteger(x.expiresAtMs);
 if(operation==='read')return exact(x,READ)&&x.caseId===scope.caseId&&
 x.tripId===scope.tripId&&['OPEN','CLOSED','BLOCKED'].includes(x.state)&&
 typeof x.canSend==='boolean'&&Number.isSafeInteger(x.expiresAtMs)&&
 Array.isArray(x.messages)&&x.messages.length<=60&&x.messages.every(msg)&&
 (!x.canSend||x.state==='OPEN');
 return exact(x,MESSAGE)&&x.caseId===scope.caseId&&
 x.requestKey===scope.requestKey&&UUID.test(x.messageId)&&x.serverPersisted===true;
}
export function createG198PassengerLostItemsHttp({
 enabled=false,ownerApproved=false,providerVerified=false,
 g198PostgresVerified=false,origin,pinnedOrigin,
 getSession,request=fetch,now=Date.now,timeoutMs=8000
}={}){
 const host=originOnly(origin);
 const ready=enabled===true&&ownerApproved===true&&providerVerified===true
  &&g198PostgresVerified===true&&host!==null&&host===originOnly(pinnedOrigin)
  &&typeof getSession==='function'&&typeof request==='function';
 let pending=false;
 async function action(operation,scope){
  if(!ready)return deny('G198_STAGING_UNAVAILABLE');
  if(pending)return deny('G198_BUSY');
  if(!obj(scope)||!UUID.test(scope.tripId??'')||
   !UUID.test(scope.expectedSubject??'')||
   !Number.isSafeInteger(scope.expectedPrivateViewRevision)||
   (operation!=='open'&&!UUID.test(scope.caseId??''))||
   (operation==='send'&&(!UUID.test(scope.requestKey??'')||
     typeof scope.body!=='string'||scope.body!==scope.body.trim()||
     scope.body.length<1||scope.body.length>500||
     /(?:https?:\/\/|www\.|@|[0-9][\s().-]*){7,}/i.test(scope.body))))
   return deny('G198_INVALID_SCOPE');
  pending=true;
  const ctrl=new AbortController();
  let timer;
  try{
   const before=await getSession();
   if(!session(before)||before.subject!==scope.expectedSubject||
    before.privateViewRevision!==scope.expectedPrivateViewRevision)
    return deny('G198_SESSION_CHANGED');
   const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000?timeoutMs:8000;
   const deadline=now()+ms;timer=setTimeout(()=>ctrl.abort(),ms);
   const method=operation==='read'?'GET':'POST';
   const path=operation==='open'?'rider/trips/'+scope.tripId+'/lost-items':
    'lost-items/'+scope.caseId+(operation==='send'?'/messages':'');
   const body=operation==='send'?{requestKey:scope.requestKey,body:scope.body}:
    operation==='open'?{}:null;
   const response=await request(host+'/v1/staging/'+path,{
    method,headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    cache:'no-store',credentials:'omit',redirect:'error',
    referrerPolicy:'no-referrer',signal:ctrl.signal
   });
   if(ctrl.signal.aborted||now()>=deadline||response?.redirected)
    return deny('G198_UNKNOWN_OUTCOME');
   const after=await getSession();
   if(!session(after)||!same(before,after))return deny('G198_SESSION_CHANGED');
   if(response?.status!==200||response.ok!==true)
    return deny('G198_AUTH_OR_SERVICE_DENIED');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return deny('G198_UNVERIFIED_RECEIPT');
   const length=response.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>16384))
    return deny('G198_UNVERIFIED_RECEIPT');
   const data=await readBoundedResponseText(response,{limit:16384,signal:ctrl.signal,
    timedOut:()=>ctrl.signal.aborted||now()>=deadline});
   if(!data.ok)return deny('G198_UNKNOWN_OUTCOME');
   let dto;try{dto=JSON.parse(data.text);}catch{return deny('G198_UNVERIFIED_RECEIPT');}
   if(!proof(dto,operation,scope))return deny('G198_UNVERIFIED_RECEIPT');
   const final=await getSession();
   if(!session(final)||!same(before,final))return deny('G198_SESSION_CHANGED');
   return Object.freeze({ok:true,data:Object.freeze(dto),qaOnly:true,productionEnabled:false});
  }catch{return deny('G198_UNKNOWN_OUTCOME');}
  finally{if(timer)clearTimeout(timer);pending=false;}
 }
 return Object.freeze({isConfigured:()=>ready,
  open:s=>action('open',s),
  read:s=>action('read',s),
  send:s=>action('send',s),
  productionEnabled:false});
}
