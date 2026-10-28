/**
 * B24: wire A's real G5 registration + G121 owner READ contract.
 * G5 201 is NOT identity, vehicle, quote, dispatch or payment evidence.
 * Only G121 independently proves persistence and the original request.
 * QA-only, caller must first persist the original requestKey (B19).
 */
import {readBoundedResponseText} from './bounded-http-response.mjs';

const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,fields)=>obj(x)&&Object.keys(x).length===fields.length
 &&fields.every(k=>Object.hasOwn(x,k));
const G5_FIELDS=['mode','liveDeliveriesEnabled','deliveryId','status','serverPersisted'];
const BODY_FIELDS=['requestKey','vehicleKind','category','grams','lengthCm',
 'widthCm','heightCm','pickupTag','deliveryTag','restrictedItemDeclared'];
const tag=x=>typeof x==='string'&&/^[A-Z_]{3,40}$/.test(x);
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const goodBody=b=>exact(b,BODY_FIELDS)
 &&uuid(b.requestKey)&&['AUTO','MOTO'].includes(b.vehicleKind)
 &&['DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT'].includes(b.category)
 &&int(b.grams,1,b.vehicleKind==='MOTO'?10000:100000)
 &&['lengthCm','widthCm','heightCm'].every(k=>int(b[k],1,200))
 &&tag(b.pickupTag)&&tag(b.deliveryTag)
 &&b.pickupTag!==b.deliveryTag&&b.restrictedItemDeclared===false;
const goodActor=(a,t)=>obj(a)&&a.role==='passenger'
 &&uuid(a.subject)&&typeof a.token==='string'
 &&/^[A-Za-z0-9._~-]{20,7900}$/.test(a.token)
 &&int(a.authRevision,0,Number.MAX_SAFE_INTEGER)
 &&int(a.sessionRevision,0,Number.MAX_SAFE_INTEGER)
 &&int(a.expiresAt,t+1001,Number.MAX_SAFE_INTEGER);
const same=(a,b)=>a.subject===b.subject&&a.role===b.role
 &&a.token===b.token&&a.authRevision===b.authRevision
 &&a.sessionRevision===b.sessionRevision&&a.expiresAt===b.expiresAt;
const fail=code=>Object.freeze({ok:false,code});
function pinned(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&u.origin===raw&&u.pathname==='/'
   &&!u.username&&!u.password&&!u.search&&!u.hash&&!u.port
   &&/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(u.hostname)
   ?u.origin:null;
 }catch{return null;}
}
function verifiedDto(original,body){
 return exact(original,G5_FIELDS)&&original.mode==='STAGING_DEMO_ONLY'
  &&original.liveDeliveriesEnabled===false
  &&original.status==='requested'
  &&original.serverPersisted===true&&uuid(original.deliveryId);
}
function makeCertifiedReply(proof,scope,status,recovered){
 // G121 is the only owner-scoped evidence. G5 alone never counts.
 if(proof?.ok!==true||proof.status!==200||proof.qaOnly!==true
  ||proof.productionEnabled!==false||proof.commercialEnabled!==false
  ||proof.registrationOnly!==true
  ||!uuid(proof.deliveryId)||proof.requestKey!==scope.requestKey
  ||(scope.vehicleKind!==undefined&&proof.vehicleKind!==scope.vehicleKind)
  ||!int(proof.revision,1,Number.MAX_SAFE_INTEGER))return null;
 const data=Object.freeze({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
  ownerId:scope.subject,requestKey:scope.requestKey,operation:'deliveryRequest',
  serviceId:proof.deliveryId,revision:proof.revision,serverPersisted:true,
  status:'ACCEPTED_QA'});
 return Object.freeze({ok:true,status,qaOnly:true,commercialEnabled:false,
  bookingConfirmedForProduction:false,...(recovered?{recoveredWithoutPost:true}:{}),
  data});
}
export function createG5G121VerifiedDeliveryBookingGateway({
 enabled=false,ownerApproved=false,g5ContractVerified=false,
 g121ContractVerified=false,externalRuntimeVerified=false,
 senderRlsVerified=false,ownerTariffGateVerified=false,
 origin,pinnedOrigin,getSession,readG121,fetchImpl=fetch,
 onSessionInvalid=()=>{},now=Date.now,timeoutMs=8000
}={}){
 const host=pinned(origin);
 const ready=enabled===true&&ownerApproved===true
  &&g5ContractVerified===true&&g121ContractVerified===true
  &&externalRuntimeVerified===true&&senderRlsVerified===true
  &&ownerTariffGateVerified===true&&host!==null
  &&host===pinned(pinnedOrigin)&&typeof getSession==='function'
  &&typeof readG121==='function'&&typeof fetchImpl==='function';
 let busy=false,epoch=0,controller=null;
 function cancelPending(){epoch++;controller?.abort();controller=null;}
 async function session(scope,expectedSessionRevision){
  let value;try{value=await getSession();}catch{return null;}
  return goodActor(value,now())&&value.subject===scope
   &&value.sessionRevision===expectedSessionRevision?value:null;
 }
 async function certifiedRead({requestKey,vehicleKind,subject,expectedSessionRevision}){
  // Read-only G121. 404/timeout CANNOT permit another G5 POST.
  let proof;
  try{proof=await readG121({requestKey,expectedSubject:subject,
    expectedSessionRevision});}
  catch{return fail('G5_READBACK_UNAVAILABLE');}
  return makeCertifiedReply(proof,{requestKey,vehicleKind,subject},200,true)
   ??fail('G5_READBACK_UNVERIFIED');
 }
 async function send(operation,{body,expectedSubject,expectedSessionRevision}={}){
  if(!ready)return fail('G5_NOT_CERTIFIED');
  if(operation!=='deliveryRequest'||!goodBody(body)
   ||!uuid(expectedSubject)||!int(expectedSessionRevision,0,Number.MAX_SAFE_INTEGER))
   return fail('G5_INVALID_DELIVERY_SCOPE');
  if(busy)return fail('G5_REQUEST_IN_FLIGHT');
  busy=true;
  const seq=epoch;
  const scope={requestKey:body.requestKey,vehicleKind:body.vehicleKind,
   subject:expectedSubject};
  let timer=null;
  try{
   const before=await session(expectedSubject,expectedSessionRevision);
   if(!before||seq!==epoch)return fail('STALE_SESSION_RESPONSE');
   const ms=int(timeoutMs,1000,30000)?timeoutMs:8000;
   const ctl=new AbortController();controller=ctl;
   timer=setTimeout(()=>ctl.abort(),ms);
   const expiry=now()+ms;
   const timedOut=()=>ctl.signal.aborted||now()>=expiry||seq!==epoch;
   // The backend is responsible for translating server-approved route tags
   // into G128/G125; the client can never supply distance, cost or road proof.
   const res=await fetchImpl(host+'/v1/staging/sender/deliveries/request',{
    method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',signal:ctl.signal,
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     'Content-Type':'application/json'},body:JSON.stringify(body)
   });
   if(timedOut()||!res||res.redirected===true)
    return fail('NETWORK_OR_TIMEOUT');
   const after=await session(expectedSubject,expectedSessionRevision);
   if(!after||!same(before,after)||timedOut())
    return fail('STALE_SESSION_RESPONSE');
   if(res.status===401||res.status===403){
    try{onSessionInvalid();}catch{}
    return fail(res.status===401?'AUTH_REQUIRED':'FORBIDDEN');
   }
   if(res.status===409)return fail('CONFLICT_RECONCILE');
   if(res.status===429)return fail('RATE_LIMITED');
   if(res.status===503)return fail('SERVICE_UNAVAILABLE');
   if(res.status!==201||res.ok!==true)return fail('REQUEST_REJECTED');
   if(!/^application\/json(?:\s*;|$)/i.test(res.headers?.get?.('content-type')??''))
    return fail('BOOKING_RECEIPT_NOT_CERTIFIED');
   const len=res.headers?.get?.('content-length');
   if(len!=null&&(!/^\d+$/.test(len)||Number(len)>4096))
    return fail('BOOKING_RECEIPT_NOT_CERTIFIED');
   const data=await readBoundedResponseText(res,{
    limit:4096,signal:ctl.signal,timedOut
   });
   if(!data.ok)return fail('BOOKING_RECEIPT_NOT_CERTIFIED');
   let dto;try{dto=JSON.parse(data.text);}catch{return fail('BOOKING_RECEIPT_NOT_CERTIFIED');}
   if(!verifiedDto(dto,body))return fail('BOOKING_RECEIPT_NOT_CERTIFIED');
   const authenticated=await session(expectedSubject,expectedSessionRevision);
   if(!authenticated||!same(authenticated,before)||timedOut())
    return fail('STALE_SESSION_RESPONSE');
   // G121 GET is REQUIRED after G5 201. A G5 receipt omits owner/requestKey.
   const check=await certifiedRead({...scope,expectedSessionRevision});
   const final=await session(expectedSubject,expectedSessionRevision);
   if(!final||!same(before,final)||timedOut())return fail('STALE_SESSION_RESPONSE');
   if(check.ok!==true||check.data.serviceId!==dto.deliveryId)
    return fail('BOOKING_RECONCILIATION_UNKNOWN');
   return Object.freeze({...check,status:201,recoveredWithoutPost:false});
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{if(timer!==null)clearTimeout(timer);controller=null;busy=false;}
 }
 async function reconcile(operation,{requestKey,expectedSubject,expectedSessionRevision,
  vehicleKind}={}){
  if(!ready)return fail('BOOKING_RECONCILIATION_NOT_CERTIFIED');
  if(operation!=='deliveryRequest'||!uuid(requestKey)||!uuid(expectedSubject)
   ||(vehicleKind!==undefined&&!['AUTO','MOTO'].includes(vehicleKind))
   ||!int(expectedSessionRevision,0,Number.MAX_SAFE_INTEGER))
   return fail('INVALID_RECONCILIATION_SCOPE');
  if(busy)return fail('G5_REQUEST_IN_FLIGHT');
  const seq=epoch;busy=true;
  try{
   const before=await session(expectedSubject,expectedSessionRevision);
   if(!before||seq!==epoch)return fail('STALE_SESSION_RESPONSE');
   const result=await certifiedRead({
    requestKey,vehicleKind,subject:expectedSubject,expectedSessionRevision
   });
   const after=await session(expectedSubject,expectedSessionRevision);
   if(!after||!same(before,after)||seq!==epoch)
    return fail('STALE_SESSION_RESPONSE');
   return result;
  }finally{busy=false;}
 }
 return Object.freeze({isConfigured:()=>Boolean(ready),
  registrationReady:()=>Boolean(ready),
  bookingReconciliationRequired:true,
  reconcile,send,cancelPending,productionEnabled:false,qaOnly:true});
}
