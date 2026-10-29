/**
 * G187 Client: sender binds a distinct recipient and recipient confirms original
 * G5 delivery after G67 courier proof. NO payments, NO LIVE, NO implicit replay.
 * Host is owner-approved and independently attested, not inferred from CI.
 */
import {readBoundedResponseText} from './bounded-http-response.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,fields)=>plain(x)&&Object.keys(x).length===fields.length
 &&fields.every(f=>Object.hasOwn(x,f));
const fail=(code,status=0)=>Object.freeze({ok:false,code,status,
 retrySafe:false});
const int=x=>Number.isSafeInteger(x)&&x>=0;
const norm=x=>typeof x==='string'&&UUID.test(x)?x.toLowerCase():null;
function approvedOrigin(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.origin!==raw||u.pathname!=='/'||
   u.username||u.password||u.search||u.hash||u.port||
   !/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(u.hostname))
   return null;
  return u.origin;
 }catch{return null;}
}
function validSession(x,time){
 return plain(x)&&x.role==='passenger'&&norm(x.subject)!==null
  &&typeof x.token==='string'&&TOKEN.test(x.token)
  &&int(x.expiresAt)&&x.expiresAt>time+1000
  &&int(x.privateViewRevision);
}
function same(a,b){return a.subject===b.subject&&a.role===b.role
 &&a.token===b.token&&a.expiresAt===b.expiresAt
 &&a.privateViewRevision===b.privateViewRevision;}
const BIND=['mode','deliveryId','bindingPersisted','recipientConfirmed',
 'qaOnly','productionEnabled'];
const CONFIRM=['mode','deliveryId','confirmationId','recipientConfirmed',
 'serverPersisted','qaOnly','productionEnabled','paymentAuthorized'];
const READ=['mode','deliveryId','ownerId','deliveryState','revision',
 'courierProofCommitted','recipientBound','recipientConfirmed',
 'eligibleForSettlement','paymentAuthorized','qaOnly','productionEnabled'];
const STATES=['requested','accepted','picked_up','delivered','disputed','returned','cancelled'];
const RECOVER=['mode','deliveryId','recipientConfirmed','confirmationId',
 'deliveryState','revision','eligibleForSettlement','paymentAuthorized',
 'qaOnly','productionEnabled'];
function validReceipt(r,operation,deliveryId,ownerId){
 if(!plain(r)||r.mode!=='STAGING_DEMO_ONLY'||r.qaOnly!==true
  ||r.productionEnabled!==false||r.deliveryId!==deliveryId)return false;
 if(operation==='bind')return exact(r,BIND)&&r.bindingPersisted===true
  &&r.recipientConfirmed===false;
 if(operation==='confirm')return exact(r,CONFIRM)
  &&norm(r.confirmationId)!==null&&r.serverPersisted===true
  &&r.recipientConfirmed===true&&r.paymentAuthorized===false;
 if(operation==='recover')return exact(r,RECOVER)
  &&typeof r.recipientConfirmed==='boolean'
  &&(r.confirmationId===null||norm(r.confirmationId)!==null)
  &&r.recipientConfirmed===(r.confirmationId!==null)
  &&STATES.includes(r.deliveryState)&&Number.isSafeInteger(r.revision)
  &&r.revision>=1&&typeof r.eligibleForSettlement==='boolean'
  &&(!r.eligibleForSettlement||
    (r.recipientConfirmed&&r.deliveryState==='delivered'))
  &&r.paymentAuthorized===false;
 return exact(r,READ)&&r.ownerId===ownerId&&STATES.includes(r.deliveryState)
  &&Number.isSafeInteger(r.revision)&&r.revision>=1
  &&['courierProofCommitted','recipientBound','recipientConfirmed','eligibleForSettlement']
    .every(k=>typeof r[k]==='boolean')
  &&(!r.eligibleForSettlement||
    (r.recipientConfirmed&&r.deliveryState==='delivered'))
  &&(!r.recipientConfirmed||(r.courierProofCommitted&&r.recipientBound))
  &&r.paymentAuthorized===false;
}
export function createG187ClientHttpGateway({
 enabled=false,ownerApproved=false,contractVerified=false,
 externalRuntimeVerified=false,independentIdpVerified=false,
 originalSqlVerified=false,origin,pinnedOrigin,getSession,
 fetchImpl=fetch,now=Date.now,timeoutMs=8000,maxBytes=4096
}={}){
 const host=approvedOrigin(origin);
 const ready=enabled===true&&ownerApproved===true&&contractVerified===true
  &&externalRuntimeVerified===true&&independentIdpVerified===true
  &&originalSqlVerified===true&&host!==null&&host===approvedOrigin(pinnedOrigin)
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let busy=false,epoch=0,controller=null;
 function cancelPending(){epoch++;controller?.abort();controller=null;}
 async function perform(operation,scope={}){
  if(!ready)return fail('G187_EXTERNAL_AUTHORITY_NOT_CERTIFIED');
  if(!['bind','confirm','read','recover'].includes(operation)||!plain(scope)
   ||!norm(scope.deliveryId)||!norm(scope.expectedSubject)
   ||!int(scope.expectedPrivateViewRevision)
   ||(operation!=='read'&&!norm(scope.requestKey))
   ||(operation==='bind'&&(!norm(scope.recipientId)
     ||norm(scope.recipientId)===norm(scope.expectedSubject))))
   return fail('G187_INVALID_SCOPE');
  if(busy)return fail('G187_REQUEST_IN_FLIGHT');
  busy=true;const version=epoch;
  const ctl=new AbortController();controller=ctl;
  let timer=null;
  const ms=Number.isInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000
   ?timeoutMs:8000;
  const max=Number.isInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=8192
   ?maxBytes:4096;
  const end=now()+ms;
  const timedOut=()=>ctl.signal.aborted||now()>=end||epoch!==version;
  try{
   const before=await getSession();
   if(!validSession(before,now())||!sameScope(before,scope)||timedOut())
    return fail('G187_SESSION_CHANGED');
   const deliveryId=norm(scope.deliveryId);
   const route=operation==='bind'?'sender/deliveries/'+deliveryId+'/recipient-bind':
    operation==='confirm'?'recipient/deliveries/'+deliveryId+'/confirm':
    operation==='recover'?'recipient/deliveries/'+deliveryId+'/confirmation':
    'sender/deliveries/'+deliveryId+'/recipient-confirmation';
   const method=operation==='read'||operation==='recover'?'GET':'POST';
   const body=operation==='bind'?{
    recipientId:norm(scope.recipientId),requestKey:norm(scope.requestKey)}:
    operation==='confirm'?{requestKey:norm(scope.requestKey)}:undefined;
   timer=setTimeout(()=>ctl.abort(),ms);
   const response=await fetchImpl(host+'/v1/staging/'+route,{
    method,credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:ctl.signal
   });
   if(timedOut())return fail('G187_UNKNOWN_OUTCOME');
   if(!response||response.redirected===true)return fail('G187_UNTRUSTED_REDIRECT');
   const after=await getSession();
   if(!validSession(after,now())||!same(before,after)
    ||!sameScope(after,scope)||timedOut())
    return fail('G187_SESSION_CHANGED');
   if(response.status===401||response.status===403)
    return fail('G187_AUTH_DENIED',response.status);
   if(response.status===404)return fail('G187_DELIVERY_UNAVAILABLE',404);
   if(response.status===429)return fail('G187_RATE_LIMITED',429);
   if(response.status===503)return fail('G187_UNKNOWN_OUTCOME',503);
   if(response.status!==200||response.ok!==true)
    return fail('G187_REJECTED',response.status);
   if(!/^application\/json(?:\s*;|$)/i.test(
    response.headers?.get?.('content-type')??''))
    return fail('G187_UNVERIFIED_RECEIPT');
   const size=response.headers?.get?.('content-length');
   if(size!=null&&(!/^\d+$/.test(size)||Number(size)>max))
    return fail('G187_UNVERIFIED_RECEIPT');
   const loaded=await readBoundedResponseText(response,{
    limit:max,signal:ctl.signal,timedOut
   });
   if(!loaded.ok)return fail('G187_UNKNOWN_OUTCOME');
   let dto;try{dto=JSON.parse(loaded.text);}catch{return fail('G187_UNVERIFIED_RECEIPT');}
   const final=await getSession();
   if(timedOut()||!validSession(final,now())||!same(before,final)
    ||!sameScope(final,scope))return fail('G187_SESSION_CHANGED');
   if(!validReceipt(dto,operation,deliveryId,before.subject))
    return fail('G187_UNTRUSTED_RECEIPT');
   return Object.freeze({ok:true,status:200,
    data:Object.freeze({...dto}),qaOnly:true,productionEnabled:false});
  }catch{return fail('G187_UNKNOWN_OUTCOME');}
  finally{if(timer!==null)clearTimeout(timer);if(controller===ctl)controller=null;busy=false;}
 }
 function sameScope(actor,scope){
  return norm(actor.subject)===norm(scope.expectedSubject)
   &&actor.privateViewRevision===scope.expectedPrivateViewRevision;
 }
 return Object.freeze({isConfigured:()=>ready,
  bindRecipient:scope=>perform('bind',scope),
  confirmReceived:scope=>perform('confirm',scope),
  readSenderStatus:scope=>perform('read',scope),
  readRecipientConfirmation:scope=>perform('recover',scope),
  cancelPending,productionEnabled:false,commercialEnabled:false});
}
