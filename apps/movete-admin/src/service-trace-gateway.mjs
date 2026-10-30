import {readBoundedResponseText} from './bounded-json-response.mjs';

/** #18 D — proposed Admin HTTPS STAGING trace by the same persisted serviceId.
 * This is NOT mounted in Backend A. Never turn on via UI/session toggles.
 */
export const TRACE_SERVICE_KINDS=Object.freeze([
 'AUTO_RIDE','MOTO_RIDE','DELIVERY_MOTO','DELIVERY_AUTO','COMMERCE'
]);
const STATES=Object.freeze({
 AUTO_RIDE:['requested','searching','assigned','arriving','in_progress','completed','cancelled'],
 MOTO_RIDE:['requested','searching','assigned','arriving','in_progress','completed','cancelled'],
 DELIVERY_MOTO:['requested','searching','assigned','accepted','pickup_pending','picked_up','in_transit','delivered','returned','cancelled'],
 DELIVERY_AUTO:['requested','searching','assigned','accepted','pickup_pending','picked_up','in_transit','delivered','returned','cancelled'],
 COMMERCE:['requested','confirmed','preparing','ready','in_transit','delivered','returned','cancelled']
});
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ROOT=['mode','viewerId','serviceId','serviceKind','bookingRequestKey',
 'quoteId','status','revision','observedAt','expiresAt','serverPersisted',
 'productionEnabled','assignment','events','ledger'];
const COMMERCE_ROOT=[...ROOT,'branchId','vehicleKind','orderSubtotalGs','deliveryId'];
const ASSIGN=['state','legalGate'];
const EVENT=['eventId','serviceId','sequence','status','at'];
const LEDGER=['serviceId','currency','grossGs','platformCommissionGs',
 'customerSubsidyGs','driverPayoutGs','reconciliationStatus'];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const safeInt=x=>Number.isSafeInteger(x)&&x>=0;
const fail=code=>Object.freeze({ok:false,code});
function originOf(v){
 try{
  if(typeof v!=='string'||v.includes('\\'))return null;
  const u=new URL(v);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash
   ||u.pathname!=='/'||u.port||u.hostname.endsWith('.'))return null;
  return u.origin;
 }catch{return null;}
}
const validActor=(s,t)=>obj(s)&&s.role==='admin'&&s.mfaVerified===true
 &&uuid(s.subject)&&typeof s.token==='string'&&s.token.length>=20
 &&safeInt(s.authRevision)&&safeInt(s.expiresAt)&&s.expiresAt>t+1000;
const same=(a,b)=>a.subject===b.subject&&a.role===b.role
 &&a.mfaVerified===b.mfaVerified&&a.token===b.token
 &&a.expiresAt===b.expiresAt&&a.authRevision===b.authRevision;
function validated(d,kind,id,subject,t){
 if(!exact(d,kind==='COMMERCE'?COMMERCE_ROOT:ROOT)||d.mode!=='STAGING_DEMO_ONLY'
  ||d.productionEnabled!==false||d.viewerId!==subject
  ||d.serviceKind!==kind||d.serviceId!==id
  ||(kind==='COMMERCE'?(d.quoteId!==null||!uuid(d.branchId)
   ||!['AUTO','MOTO'].includes(d.vehicleKind)||!safeInt(d.orderSubtotalGs)
   ||d.orderSubtotalGs<100||d.orderSubtotalGs>50000000
   ||!(d.deliveryId===null||uuid(d.deliveryId))
   ||(d.deliveryId!==null&&(d.status!=='ready'||d.revision!==5))
   ||(d.revision===5&&d.deliveryId===null)):!uuid(d.quoteId))
  ||!uuid(d.bookingRequestKey)||!STATES[kind].includes(d.status)
  ||!safeInt(d.revision)||d.revision<1
  ||!safeInt(d.observedAt)||d.observedAt>t||t-d.observedAt>30000
  ||!safeInt(d.expiresAt)||d.expiresAt<=t||d.expiresAt>t+60000
  ||d.serverPersisted!==true||!exact(d.assignment,ASSIGN)
  ||!['NOT_ASSIGNABLE','UNASSIGNED','ASSIGNED','CLOSED',
   'QA_ACCEPTED','QA_COMPLETED'].includes(d.assignment.state)
  ||!['G38_BLOCKED','G71_BLOCKED','UNVERIFIED','CLEARED',
   'EXTERNAL_NOT_CERTIFIED'].includes(d.assignment.legalGate)
  ||(d.assignment.legalGate!=='CLEARED'&&d.assignment.state!=='NOT_ASSIGNABLE'
   &&!['QA_ACCEPTED','QA_COMPLETED'].includes(d.assignment.state))
  ||(d.assignment.state==='ASSIGNED'&&d.assignment.legalGate!=='CLEARED')
  // QA source provenance is never physical delivery, legal permission or PSP settlement.
  ||(['QA_ACCEPTED','QA_COMPLETED'].includes(d.assignment.state)!==
    (d.assignment.legalGate==='EXTERNAL_NOT_CERTIFIED'))
  ||(['QA_ACCEPTED','QA_COMPLETED'].includes(d.assignment.state)&&(
    !['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO'].includes(kind)||
    (d.assignment.state==='QA_ACCEPTED'&&
     !(['AUTO_RIDE','MOTO_RIDE'].includes(kind)
       ?['assigned','arriving','in_progress'].includes(d.status)
       :['accepted','picked_up'].includes(d.status)))||
    (d.assignment.state==='QA_COMPLETED'&&
     !(['AUTO_RIDE','MOTO_RIDE'].includes(kind)?d.status==='completed':
      d.status==='delivered'))))
  ||!Array.isArray(d.events)||d.events.length<1||d.events.length>40
  ||(kind==='COMMERCE'&&(
    !['requested','confirmed','preparing','ready','cancelled'].includes(d.status)
    ||d.revision<1||d.revision>5
    ||(d.status!=='cancelled'&&
      (d.revision===5?'ready':['requested','confirmed','preparing','ready'][d.revision-1])!==d.status)
    ||(d.status==='cancelled'&&d.revision<2)
    ||d.events.length!==d.revision||d.ledger!==null
    ||d.assignment.state!=='NOT_ASSIGNABLE'
    ||d.assignment.legalGate!=='G38_BLOCKED')))return false;
 let last=0,at=0;const ids=new Set();
 for(const event of d.events){
  if(!exact(event,EVENT)||!uuid(event.eventId)||ids.has(event.eventId)
   ||event.serviceId!==id||!safeInt(event.sequence)||event.sequence<=last
   ||!STATES[kind].includes(event.status)||!safeInt(event.at)
   ||event.at<at||event.at>d.observedAt)return false;
  ids.add(event.eventId);last=event.sequence;at=event.at;
 }
 if(d.events[d.events.length-1].status!==d.status)return false;
 if(['AUTO_RIDE','MOTO_RIDE'].includes(kind)&&
  ['QA_ACCEPTED','QA_COMPLETED'].includes(d.assignment.state)){
  const expected={assigned:2,arriving:3,in_progress:4,completed:5}[d.status];
  const timeline=['searching','assigned','arriving','in_progress','completed'];
  if(!expected||d.revision!==expected||d.events.length!==expected||
   d.events.some((event,index)=>event.sequence!==index+1||
    event.status!==timeline[index]))return false;
 }

 if(['DELIVERY_AUTO','DELIVERY_MOTO'].includes(kind)&&
  d.assignment.state==='QA_ACCEPTED'){
  const timeline=['requested','accepted','picked_up'];
  if(d.revision!==(d.status==='accepted'?2:3)||
   d.events.length!==d.revision||d.ledger!==null||
   d.events.some((event,i)=>event.sequence!==i+1||
    event.status!==timeline[i]))return false;
 }
 if(['DELIVERY_AUTO','DELIVERY_MOTO'].includes(kind)&&
  d.assignment.state==='QA_COMPLETED'){
  const timeline=['requested','accepted','picked_up','delivered'];
  if(d.revision!==4||d.events.length!==4||d.ledger!==null||
   d.events.some((event,i)=>event.sequence!==i+1||
    event.status!==timeline[i]))return false;
 }
 if(kind==='COMMERCE'&&d.events.some((e,i)=>
  e.sequence!==i+1||
  e.status!==(d.status==='cancelled'&&i===d.revision-1
   ?'cancelled':i===4?'ready':['requested','confirmed','preparing','ready'][i])))return false;
 if(d.ledger!==null){
  const l=d.ledger;
  if(!exact(l,LEDGER)||l.serviceId!==id||l.currency!=='PYG'
   ||!['PENDING','RECONCILED'].includes(l.reconciliationStatus)
   ||(l.reconciliationStatus==='RECONCILED'
    &&!['completed','delivered','returned','cancelled'].includes(d.status))
   ||!['grossGs','platformCommissionGs','customerSubsidyGs','driverPayoutGs']
    .every(k=>safeInt(l[k])&&l[k]<=100000000000))return false;
 }
 return true;
}
// Independent authorization and infrastructure must be attested externally.
// Every field defaults OFF, HTTPS pinned Onrender staging only.
export function createServiceTraceQaOptions({
 origin,pinnedOrigin,ownerApproved=false,externalHttpsVerified=false,
 contractVerified=false,postgresVerified=false,serverMfaVerified=false,
 serverRbacVerified=false,serverRevocationVerified=false,fetchImpl
}={}){
 const host=originOf(origin);
 if(host===null||host!==originOf(pinnedOrigin)
  ||!/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(new URL(host).hostname)
  ||ownerApproved!==true||externalHttpsVerified!==true
  ||contractVerified!==true||postgresVerified!==true
  ||serverMfaVerified!==true||serverRbacVerified!==true
  ||serverRevocationVerified!==true||typeof fetchImpl!=='function')return null;
 return Object.freeze({enabled:true,contractCertified:true,origin:host,
  pinnedOrigin:host,fetchImpl});
}
export function createServiceTraceGateway({
 enabled=false,contractCertified=false,origin,pinnedOrigin,
 getSession,fetchImpl,onSessionInvalid=()=>{},now=Date.now,
 timeoutMs=8000,maxBytes=32768
}={}){
 const host=originOf(origin);
 const ready=enabled===true&&contractCertified===true&&host!==null
  &&host===originOf(pinnedOrigin)&&typeof getSession==='function'
  &&typeof fetchImpl==='function';
 let epoch=0,active=null;
 function cancelPending(){epoch++;active?.abort();active=null;}
 async function read(kind,id){
  if(!ready)return fail('TRACE_CONTRACT_PENDING');
  if(!Object.hasOwn(STATES,kind))return fail('INVALID_SERVICE_KIND');
  if(!uuid(id))return fail('INVALID_SERVICE_ID');
  if(active!==null)return fail('TRACE_IN_FLIGHT');
  const run=epoch,ctl=new AbortController();active=ctl;
  let timer=null;
  try{
   let before;try{before=await getSession();}catch{return fail('ADMIN_AUTH_REQUIRED');}
   if(run!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!validActor(before,now()))return fail('FORBIDDEN');
   const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000
    ?timeoutMs:8000,deadline=now()+ms;
   timer=setTimeout(()=>ctl.abort(),ms);
   const timedOut=()=>ctl.signal.aborted||now()>=deadline;
   const response=await fetchImpl(host+'/v1/staging/admin/services/'
    +encodeURIComponent(kind)+'/'+encodeURIComponent(id)+'/trace',{
    method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',headers:{
     Authorization:'Bearer '+before.token,Accept:'application/json'
    },signal:ctl.signal
   });
   if(run!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(timedOut())return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   let after;try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(!validActor(after,now())||!same(before,after))
    return fail('STALE_SESSION_RESPONSE');
   if(response.status===401||response.status===403){
    onSessionInvalid();
    return fail(response.status===401?'ADMIN_AUTH_REQUIRED':'FORBIDDEN');
   }
   if(response.status===404)return fail('SERVICE_NOT_FOUND');
   if(response.status===429)return fail('RATE_LIMITED');
   if(response.status===503)return fail('SERVICE_UNAVAILABLE');
   if(response.status!==200||response.ok!==true)return fail('TRACE_UNAVAILABLE');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=65536
    ?maxBytes:32768;
   const advertised=response.headers?.get?.('content-length');
   if(advertised!=null&&(!/^\d+$/.test(advertised)||Number(advertised)>limit))
    return fail('RESPONSE_TOO_LARGE');
   const body=await readBoundedResponseText(response,{
    limit,signal:ctl.signal,timedOut
   });
   if(run!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!body.ok)return fail(body.code);
   let dto;try{dto=JSON.parse(body.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   if(!validated(dto,kind,id,before.subject,now()))
    return fail('INVALID_TRACE_RECEIPT');
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(run!==epoch||timedOut()||!validActor(after,now())||!same(before,after))
    return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,data:Object.freeze({
    serviceKind:kind,serviceId:id,quoteId:dto.quoteId,
    ...(kind==='COMMERCE'?{branchId:dto.branchId,
     vehicleKind:dto.vehicleKind,orderSubtotalGs:dto.orderSubtotalGs,
     deliveryId:dto.deliveryId}:{}),
    bookingRequestKey:dto.bookingRequestKey,status:dto.status,
    revision:dto.revision,assignment:Object.freeze({...dto.assignment}),
    events:Object.freeze(dto.events.map(e=>Object.freeze({...e}))),
    ledger:dto.ledger===null?null:Object.freeze({...dto.ledger}),
    observedAt:dto.observedAt,expiresAt:dto.expiresAt,
    serverPersistedReported:true,qaOnly:true,productionEnabled:false
   })});
  }catch{return fail(run!==epoch?'STALE_SESSION_RESPONSE':'NETWORK_OR_TIMEOUT');}
  finally{if(timer!==null)clearTimeout(timer);if(active===ctl)active=null;}
 }
 return Object.freeze({isConfigured:()=>ready,cancelPending,read});
}
