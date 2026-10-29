import {readBoundedResponseText} from './bounded-http-response.mjs';

/** G119: private MOTO Passenger status, from A PostgreSQL only.
 * No location, ETA, Driver PII, local pricing or production activation.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);
const exact=(x,fields)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));
const KEYS=['mode','commercialEnabled','ownerId','bookingKey','tripId',
 'serviceKind','tripState','tripRevision','driverAssigned','driverIdentityExposed',
 'gpsVerified','etaAvailable','commissionBps','subsidyBps','amountGs',
 'customerPaysGs','customerSubsidyGs','financialState','pspCollected','serverPersisted'];
const STAGES=new Map([['searching',1],['accepted',2],['arriving',3],
 ['in_progress',4],['completed',5],['cancelled',2]]);
const fail=code=>Object.freeze({ok:false,code});
function pinnedHttps(origin){
 try{
  if(typeof origin!=='string'||origin.includes('\\'))return null;
  const u=new URL(origin);
  return u.protocol==='https:'&&u.pathname==='/'&&!u.username&&!u.password
   &&!u.port&&!u.hash&&!u.search&&!u.hostname.endsWith('.')?u.origin:null;
 }catch{return null;}
}
function valid(x,owner,booking,trip,minRevision){
 return exact(x,KEYS)&&x.mode==='STAGING_DEMO_ONLY'
  &&x.commercialEnabled===false&&x.ownerId===owner
  &&x.bookingKey===booking&&x.tripId===trip&&validId(x.tripId)
  &&x.serviceKind==='MOTO_RIDE'&&STAGES.has(x.tripState)
  &&x.tripRevision===STAGES.get(x.tripState)
  &&x.tripRevision>=minRevision
  &&x.driverAssigned===!['searching','cancelled'].includes(x.tripState)
  &&x.driverIdentityExposed===false&&x.gpsVerified===false
  &&x.etaAvailable===false&&x.pspCollected===false&&x.serverPersisted===true
  &&Number.isSafeInteger(x.amountGs)&&x.amountGs>0&&x.amountGs<=100000000
  &&Number.isSafeInteger(x.commissionBps)&&x.commissionBps>=1000
  &&x.commissionBps<=3000&&x.subsidyBps===1000
  &&Number.isSafeInteger(x.customerPaysGs)&&x.customerPaysGs>=0
  &&Number.isSafeInteger(x.customerSubsidyGs)&&x.customerSubsidyGs>=0
  &&x.customerSubsidyGs===Math.floor((x.amountGs*1000+5000)/10000)
  &&x.customerPaysGs===x.amountGs-x.customerSubsidyGs
  &&x.financialState===(x.tripState==='cancelled'?'VOIDED_QA'
   :x.tripState==='completed'?'COMPLETED_UNSETTLED_QA':'RESERVED_QA');
}
function active(s,t){
 return s?.role==='passenger'&&validId(s.subject)
  &&typeof s.token==='string'&&s.token.length>=20&&s.token.length<=7900
  &&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>t+1000;
}
/**
 * G167: single in-flight private MOTO read, eight-second maximum by default.
 * Abort alone is insufficient: injected fetches on older Android transports
 * may ignore AbortSignal, so a deadline Promise also settles the UI.
 * No POST retry, no background fetch, no Driver identity or GPS fallback.
 */
export function createG119MotoStatusGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,now=Date.now,
 timeoutMs=8000,maxBytes=4096
}={}){
 const o=pinnedHttps(origin),p=pinnedHttps(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&o!==null&&o===p
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 const deadline=Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=30000
  ?timeoutMs:8000;
 const bytes=Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=8192
  ?maxBytes:4096;
 let epoch=0,inFlight=null;
 function cancelPending(){epoch++;try{inFlight?.abort();}catch{}}
 async function read({bookingKey,expectedTripId,minimumRevision=1}={}){
  if(!ready)return fail('G119_MOTO_STATUS_NOT_CERTIFIED');
  if(!validId(bookingKey)||!validId(expectedTripId)
   ||!Number.isSafeInteger(minimumRevision)||minimumRevision<1
   ||minimumRevision>5)return fail('G119_INVALID_RIDE_SCOPE');
  if(inFlight!==null)return fail('G119_READ_IN_FLIGHT');
  const run=epoch,ctl=new AbortController();inFlight=ctl;
  let timer=null,timedOut=false;
  const timeout=new Promise(resolve=>{
   timer=setTimeout(()=>{
    timedOut=true;ctl.abort();resolve(fail('G119_NETWORK_OR_TIMEOUT'));
   },deadline);
  });
  const work=(async()=>{
   try{
    const before=await getSession();
    if(run!==epoch||ctl.signal.aborted)return fail('STALE_SESSION_RESPONSE');
    if(!active(before,now()))return fail('G119_PASSENGER_SESSION_REQUIRED');
    const response=await fetchImpl(o+'/v1/staging/rider/moto/bookings/'+bookingKey+'/status',{
     method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
     referrerPolicy:'no-referrer',signal:ctl.signal,
     headers:{Authorization:'Bearer '+before.token,Accept:'application/json'}
    });
    if(run!==epoch||ctl.signal.aborted)return fail('STALE_SESSION_RESPONSE');
    const after=await getSession();
    if(run!==epoch||ctl.signal.aborted||!active(after,now())
     ||before.subject!==after.subject||before.token!==after.token
     ||before.expiresAt!==after.expiresAt)
     return fail('STALE_SESSION_RESPONSE');
    if(response?.status!==200||response?.ok!==true||response.redirected===true)
     return fail('G119_STATUS_UNAVAILABLE');
    if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
     return fail('G119_BAD_CONTENT_TYPE');
    const advertised=response.headers?.get?.('content-length');
    if(advertised!==null&&advertised!==undefined&&
     (!/^\d+$/.test(advertised)||Number(advertised)>bytes))
     return fail('G119_UNTRUSTED_BODY');
    const body=await readBoundedResponseText(response,{
     limit:bytes,signal:ctl.signal,timedOut:()=>timedOut
    });
    if(!body.ok)return fail(body.code);
    const final=await getSession();
    if(run!==epoch||ctl.signal.aborted||!active(final,now())
     ||before.subject!==final.subject||before.token!==final.token
     ||before.expiresAt!==final.expiresAt)
     return fail('STALE_SESSION_RESPONSE');
    let data;try{data=JSON.parse(body.text);}catch{return fail('G119_BAD_JSON');}
    if(!valid(data,before.subject,bookingKey,expectedTripId,minimumRevision))
     return fail('G119_INVALID_PERSISTED_STATUS');
    return Object.freeze({ok:true,data:Object.freeze({...data}),
     qaOnly:true,productionEnabled:false});
   }catch{return fail(run!==epoch?'STALE_SESSION_RESPONSE':'G119_NETWORK_UNAVAILABLE');}
  })();
  try{return await Promise.race([work,timeout]);}
  finally{
   if(timer!==null)clearTimeout(timer);
   if(inFlight===ctl)inFlight=null;
  }
 }
 return Object.freeze({isConfigured:()=>ready,read,cancelPending});
}
