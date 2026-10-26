/**
 * B18 / A G7 + G122: authenticated delivery fare REVIEW followed by
 * one explicit QA-only consent. Prerequisite: verified G121 registration.
 * Neither endpoint enables booking, courier offer, real payment or dispatch.
 */
import {readBoundedResponseText} from './bounded-http-response.mjs';

const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&ID.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=code=>Object.freeze({ok:false,code});
const quoteKeys=['mode','livePaymentsEnabled','quote','serverPriced','ownerId',
 'quoteId','amountGs','fareMode','subjectKind','subjectId','expiresAt',
 'fareVersion','routingVerified'];
const nestedKeys=['id','mode','subjectKind','subjectId','ruleVersion',
 'subtotalPyg','tollsPyg','totalPyg','commissionBps','commissionPyg',
 'providerPyg','expiresAt'];
const confirmationKeys=['mode','liveDeliveriesEnabled','paymentAuthorized',
 'dispatchEnabled','ownerId','consentId','deliveryId','quoteId',
 'confirmationKey','vehicleKind','acceptedTotalGs','fareVersion',
 'status','serverPersisted'];
const exact=(dto,keys)=>obj(dto)&&Object.keys(dto).length===keys.length
 &&keys.every(k=>Object.hasOwn(dto,k));
const validActor=(s,now)=>obj(s)&&s.role==='passenger'&&uuid(s.subject)
 &&typeof s.token==='string'&&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.token)
 &&Number.isSafeInteger(s.authRevision)&&s.authRevision>=0
 &&Number.isSafeInteger(s.sessionRevision)&&s.sessionRevision>=0
 &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>now+1000;
const sameActor=(a,b)=>obj(a)&&obj(b)
 &&a.subject===b.subject&&a.token===b.token
 &&a.authRevision===b.authRevision&&a.sessionRevision===b.sessionRevision
 &&a.expiresAt===b.expiresAt;
function origin(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&u.origin===raw&&!u.username&&!u.password
   &&!u.port&&!u.search&&!u.hash&&u.pathname==='/'
   &&/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(u.hostname)
   ?u.origin:null;
 }catch{return null;}
}
function validQuote(x,owner,deliveryId,now){
 if(!exact(x,quoteKeys)||x.mode!=='STAGING_DEMO_ONLY'
  ||x.livePaymentsEnabled!==false||x.serverPriced!==true
  ||x.routingVerified!==true||x.ownerId!==owner
  ||!uuid(x.quoteId)||x.subjectId!==deliveryId
  ||x.fareMode!=='DELIVERY'||x.subjectKind!=='DELIVERY'
  ||!Number.isSafeInteger(x.amountGs)||x.amountGs<1||x.amountGs>100000000
  ||!Number.isSafeInteger(x.expiresAt)||x.expiresAt<=now+1000
  ||x.expiresAt>now+3600000||typeof x.fareVersion!=='string'
  ||!/^[a-zA-Z0-9._-]{1,48}$/.test(x.fareVersion))return false;
 const q=x.quote;
 if(!exact(q,nestedKeys)||q.id!==x.quoteId
  ||q.mode!=='DELIVERY'||q.subjectKind!=='DELIVERY'
  ||q.subjectId!==deliveryId||q.ruleVersion!==x.fareVersion
  ||q.totalPyg!==x.amountGs||!Number.isSafeInteger(q.subtotalPyg)
  ||!Number.isSafeInteger(q.tollsPyg)
  ||q.subtotalPyg+q.tollsPyg!==q.totalPyg
  ||!Number.isSafeInteger(q.commissionBps)
  ||!Number.isSafeInteger(q.commissionPyg)
  ||!Number.isSafeInteger(q.providerPyg)
  ||q.providerPyg+q.commissionPyg!==q.totalPyg
  ||typeof q.expiresAt!=='string'
  ||Math.abs(Date.parse(q.expiresAt)-x.expiresAt)>1000)return false;
 return true;
}
function validConsent(x,scope,quote,key){
 return exact(x,confirmationKeys)&&x.mode==='STAGING_DEMO_ONLY'
  &&x.liveDeliveriesEnabled===false&&x.paymentAuthorized===false
  &&x.dispatchEnabled===false&&x.serverPersisted===true
  &&x.ownerId===scope.ownerId&&x.deliveryId===scope.deliveryId
  &&x.vehicleKind===scope.vehicleKind
  &&uuid(x.consentId)&&x.quoteId===quote.quoteId
  &&x.confirmationKey===key&&x.acceptedTotalGs===quote.amountGs
  &&x.fareVersion===quote.fareVersion&&x.status==='confirmed_qa';
}

export function createG122DeliveryPriceConsentFlow({
 enabled=false,contractCertified=false,externalRuntimeVerified=false,
 ownerTariffVerified=false,officialRoutingVerified=false,
 g123FenceVerified=false,ownerApproved=false,
 sourceOrigin,pinnedOrigin,getSession,fetchImpl=fetch,
 onSessionInvalid=()=>{},now=Date.now,timeoutMs=8000
}={}){
 const host=origin(sourceOrigin);
 const ready=enabled===true&&contractCertified===true
  &&externalRuntimeVerified===true&&ownerTariffVerified===true
  &&officialRoutingVerified===true&&g123FenceVerified===true
  &&ownerApproved===true&&host!==null&&host===origin(pinnedOrigin)
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let epoch=0,active=null;
 let state={phase:'idle',scope:null,quote:null,confirmationKey:null,receipt:null};
 const readReady=()=>Boolean(ready);
 const scopeValid=s=>obj(s)&&uuid(s.ownerId)&&uuid(s.deliveryId)
  &&uuid(s.requestKey)&&['AUTO','MOTO'].includes(s.vehicleKind)
  &&Number.isSafeInteger(s.sessionRevision)&&s.sessionRevision>=0;
 function snapshot(){
  const live=state.quote&&state.quote.expiresAt>now()+1000;
  return Object.freeze({
   contractReady:readReady(),
   phase:state.phase,
   deliveryId:state.scope?.deliveryId??null,
   vehicleKind:state.scope?.vehicleKind??null,
   quote:live&&['quoted','consenting','consent_unknown','confirmed_qa'].includes(state.phase)
    ?Object.freeze({...state.quote}):null,
   consentId:state.phase==='confirmed_qa'?state.receipt?.consentId??null:null,
   canQuote:ready&&state.phase==='idle',
   canConfirm:ready&&state.phase==='quoted'&&Boolean(live),
   unknown:state.phase==='quote_unknown'||state.phase==='consent_unknown',
   qaOnly:true,productionEnabled:false,paymentAuthorized:false,dispatchEnabled:false
  });
 }
 function clear(){
  epoch++;active?.abort();active=null;
  state={phase:'idle',scope:null,quote:null,confirmationKey:null,receipt:null};
 }
 async function http(path,body,scope,version){
  let before,after;
  try{before=await getSession();}catch{return fail('AUTH_REQUIRED');}
  if(version!==epoch||!validActor(before,now())
   ||before.subject!==scope.ownerId
   ||before.sessionRevision!==scope.sessionRevision)
   return fail('STALE_SESSION_RESPONSE');
  const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000
   ?timeoutMs:8000;
  const ctl=new AbortController();active=ctl;
  const deadline=now()+ms,timer=setTimeout(()=>ctl.abort(),ms);
  try{
   const response=await fetchImpl(host+path,{
    method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',signal:ctl.signal,
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json',
     'Content-Type':'application/json'},body:JSON.stringify(body)
   });
   if(ctl.signal.aborted||now()>=deadline||version!==epoch)
    return fail('NETWORK_OR_TIMEOUT');
   if(!response||response.redirected===true)return fail('UNTRUSTED_REDIRECT');
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(!validActor(after,now())||!sameActor(before,after))
    return fail('STALE_SESSION_RESPONSE');
   if(response.status===401||response.status===403){
    try{onSessionInvalid();}catch{}
    return fail(response.status===401?'AUTH_REQUIRED':'FORBIDDEN');
   }
   if(response.status===409)return fail('PRICE_CONSENT_CONFLICT');
   if(response.status===429)return fail('RATE_LIMITED');
   if(response.status===503)return fail('SERVICE_UNAVAILABLE');
   if(response.ok!==true||![200,201].includes(response.status))
    return fail('SERVER_REJECTED');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('BAD_CONTENT_TYPE');
   const length=response.headers?.get?.('content-length');
   if(length!=null&&(!/^\d+$/.test(length)||Number(length)>8192))
    return fail('RESPONSE_TOO_LARGE');
   const bounded=await readBoundedResponseText(response,{
    limit:8192,signal:ctl.signal,
    timedOut:()=>ctl.signal.aborted||now()>=deadline||version!==epoch
   });
   if(!bounded.ok)return fail(bounded.code);
   let data;try{data=JSON.parse(bounded.text);}catch{return fail('BAD_SERVER_RESPONSE');}
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(version!==epoch||ctl.signal.aborted||now()>=deadline
    ||!validActor(after,now())||!sameActor(before,after))
    return fail('STALE_SESSION_RESPONSE');
   return Object.freeze({ok:true,status:response.status,data});
  }catch{return fail('NETWORK_OR_TIMEOUT');}
  finally{clearTimeout(timer);if(active===ctl)active=null;}
 }
 async function quote(scope,quoteRequestKey){
  if(!ready)return fail('G122_NOT_CERTIFIED');
  if(!scopeValid(scope)||!uuid(quoteRequestKey))return fail('INVALID_G122_SCOPE');
  if(state.phase!=='idle')return fail('G122_ALREADY_STARTED');
  const version=++epoch;
  state={phase:'quoting',scope:Object.freeze({...scope}),
   quote:null,confirmationKey:null,receipt:null};
  const result=await http('/v1/staging/fares/quote',{
   requestKey:quoteRequestKey,fareMode:'DELIVERY',
   subjectKind:'DELIVERY',subjectId:scope.deliveryId
  },scope,version);
  if(version!==epoch)return fail('STALE_SESSION_RESPONSE');
  if(result.ok&&result.status===201
   &&validQuote(result.data,scope.ownerId,scope.deliveryId,now())){
   const d=result.data;
   state.phase='quoted';
   state.quote=Object.freeze({quoteId:d.quoteId,amountGs:d.amountGs,
    fareVersion:d.fareVersion,expiresAt:d.expiresAt,currency:'PYG'});
   return Object.freeze({ok:true,qaOnly:true,quote:state.quote});
  }
  // A server POST may have committed a quote before ACK loss.
  // No automatic second quote POST with a new key.
  state.phase='quote_unknown';
  return fail(result.code??'G122_QUOTE_UNVERIFIED');
 }
 async function confirm({confirmationKey,acceptedTotalGs,acceptedFareVersion}={}){
  if(!ready)return fail('G122_NOT_CERTIFIED');
  if(state.phase!=='quoted')return fail('G122_NO_FRESH_QUOTE');
  if(!uuid(confirmationKey)||state.confirmationKey!==null)
   return fail('INVALID_CONFIRMATION_KEY');
  if(!state.quote||state.quote.expiresAt<=now()+1000)
   return fail('QUOTE_EXPIRED');
  if(acceptedTotalGs!==state.quote.amountGs
   ||acceptedFareVersion!==state.quote.fareVersion)
   return fail('PRICE_TAMPERED');
  const version=++epoch,scope=state.scope,quote=state.quote;
  state.phase='consenting';state.confirmationKey=confirmationKey;
  const result=await http('/v1/staging/sender/deliveries/quotes/confirm',{
   deliveryId:scope.deliveryId,quoteId:quote.quoteId,confirmationKey,
   acceptedTotalGs:quote.amountGs,acceptedFareVersion:quote.fareVersion
  },scope,version);
  if(version!==epoch)return fail('STALE_SESSION_RESPONSE');
  if(result.ok&&result.status===200
   &&validConsent(result.data,scope,quote,confirmationKey)){
   state.phase='confirmed_qa';
   state.receipt=Object.freeze({consentId:result.data.consentId});
   return Object.freeze({ok:true,status:200,consentId:result.data.consentId,
    deliveryId:scope.deliveryId,vehicleKind:scope.vehicleKind,
    paymentAuthorized:false,dispatchEnabled:false,productionEnabled:false});
  }
  // If ACK is lost the same confirmationKey may already be persisted.
  // Require an independently certified readback; never POST it again.
  state.phase='consent_unknown';
  return fail(result.code??'G122_CONSENT_UNVERIFIED');
 }
 return Object.freeze({isConfigured:readReady,snapshot,quote,confirm,clear});
}
