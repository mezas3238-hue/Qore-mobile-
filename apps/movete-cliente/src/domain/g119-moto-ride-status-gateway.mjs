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
export function createG119MotoStatusGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 origin,pinnedOrigin,getSession,fetchImpl,now=Date.now
}={}){
 const o=pinnedHttps(origin),p=pinnedHttps(pinnedOrigin);
 const ready=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&o!==null&&o===p
  &&typeof getSession==='function'&&typeof fetchImpl==='function';
 let epoch=0;
 function cancelPending(){epoch++;}
 async function read({bookingKey,expectedTripId,minimumRevision=1}={}){
  if(!ready)return fail('G119_MOTO_STATUS_NOT_CERTIFIED');
  if(!validId(bookingKey)||!validId(expectedTripId)
   ||!Number.isSafeInteger(minimumRevision)||minimumRevision<1
   ||minimumRevision>5)return fail('G119_INVALID_RIDE_SCOPE');
  const current=epoch;
  try{
   const before=await getSession();
   if(!active(before,now()))return fail('G119_PASSENGER_SESSION_REQUIRED');
   const response=await fetchImpl(o+'/v1/staging/rider/moto/bookings/'+bookingKey+'/status',{
    method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
    headers:{Authorization:'Bearer '+before.token,Accept:'application/json'}
   });
   const after=await getSession();
   if(current!==epoch||!active(after,now())||before.subject!==after.subject
    ||before.token!==after.token||before.expiresAt!==after.expiresAt)
    return fail('STALE_SESSION_RESPONSE');
   if(response?.status!==200||response?.ok!==true||response.redirected===true)
    return fail('G119_STATUS_UNAVAILABLE');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
    return fail('G119_BAD_CONTENT_TYPE');
   const body=await response.text();
   if(typeof body!=='string'||body.length>4096)return fail('G119_UNTRUSTED_BODY');
   const final=await getSession();
   if(current!==epoch||!active(final,now())||before.subject!==final.subject
    ||before.token!==final.token||before.expiresAt!==final.expiresAt)
    return fail('STALE_SESSION_RESPONSE');
   let data;try{data=JSON.parse(body);}catch{return fail('G119_BAD_JSON');}
   if(!valid(data,before.subject,bookingKey,expectedTripId,minimumRevision))
    return fail('G119_INVALID_PERSISTED_STATUS');
   return Object.freeze({ok:true,data:Object.freeze({...data}),
    qaOnly:true,productionEnabled:false});
  }catch{return fail('G119_NETWORK_UNAVAILABLE');}
 }
 return Object.freeze({isConfigured:()=>ready,read,cancelPending});
}
