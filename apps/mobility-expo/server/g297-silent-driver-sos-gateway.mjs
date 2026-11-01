/**
 * G297 — Manual, silent Driver SOS + server-derived passenger identity receipt.
 * STAGING LAB ONLY. Nothing here calls police, dispatches push, or shows documents
 * to a driver. A configured adapter MUST atomically persist an incident + dossier.
 * There is deliberately no unauthenticated/browser route, no biometric inference,
 * and no client-supplied passenger/trip/identity/geo information.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ENDPOINT='/v1/staging/driver/sos';
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const LIVE=new Set(['accepted','arriving','in_progress']);
const PLAIN=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const uuid=x=>typeof x==='string'&&UUID.test(x);
const receipt=(status,body)=>({status,body});
const checkedBody=x=>PLAIN(x)&&Object.keys(x).length===1&&uuid(x.requestKey);
const noData=Object.freeze({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 externalResponseDispatched:false,operatorAcknowledged:false});
const rejected=()=>receipt(503,{error:'Private SOS authority or persistence unavailable'});
const statusFrom=record=>{
 if(!PLAIN(record))return null;
 if(record.status!=='VERIFIED'&&record.status!=='NOT_VERIFIED')return null;
 if(record.status==='VERIFIED'&&!uuid(record.receiptId))return null;
 if(record.status==='NOT_VERIFIED'&&record.receiptId!==null)return null;
 // Never ingest raw evidence or arbitrary contact data in this gateway.
 if(Object.keys(record).some(x=>!['status','receiptId'].includes(x)))return null;
 return record;
};
export function createG297SilentDriverSosGateway({
 projectRef,environment,liveEnabled=false,qaApproved=false,
 verifyDriverSession,lookupAssignedTrip,lookupIdentityReceipt,
 persistAtomicIncident,allowRequest
}={}){
 if(!/^[a-z0-9]{20}$/.test(projectRef??'')||
  environment!=='isolated_staging'||liveEnabled!==false||qaApproved!==true||
  ![verifyDriverSession,lookupAssignedTrip,lookupIdentityReceipt,
    persistAtomicIncident,allowRequest].every(x=>typeof x==='function'))
  throw Error('G297 requires approved STAGING and independent private authorities');
 return async ({method,path,headers,body}={})=>{
  if(path!==ENDPOINT||method!=='POST')
   return receipt(404,{error:'Not found'});
  if(!checkedBody(body))return receipt(400,{error:'Invalid SOS request'});
  // No client-supplied tripId/identity/passengerId/latitude/longitude accepted.
  const authorization=headers?.authorization??headers?.Authorization;
  const token=typeof authorization==='string'&&authorization.length<8000?
   TOKEN.exec(authorization)?.[1]:null;
  if(!token)return receipt(401,{error:'Driver session required'});
  let driver;
  try{driver=await verifyDriverSession(token);}catch{
   return receipt(401,{error:'Driver session invalid'});
  }
  // Must be provider-backed, current, exclusive Driver role, not raw JWT claims.
  if(!PLAIN(driver)||!uuid(driver.userId)||!uuid(driver.sessionId)||
     driver.role!=='driver'||driver.providerVerified!==true||
     driver.sessionActive!==true)
   return receipt(403,{error:'Verified Driver authority required'});
  try{
   if(await allowRequest({userId:driver.userId,operation:'G297_DRIVER_SOS'})!==true)
    return receipt(429,{error:'SOS request rate-limited'});
  }catch{return rejected();}
  let trip;
  try{trip=await lookupAssignedTrip({driverId:driver.userId,
   sessionId:driver.sessionId});}catch{return rejected();}
  if(!PLAIN(trip)||!uuid(trip.tripId)||!uuid(trip.passengerId)||
     trip.driverId!==driver.userId||!LIVE.has(trip.status)||
     !['AUTO','MOTO'].includes(trip.vehicleKind))
   return receipt(409,{error:'No independently assigned active ride'});
  let identity={status:'NOT_VERIFIED',receiptId:null};
  try{
   const verified=statusFrom(await lookupIdentityReceipt({
    passengerId:trip.passengerId,tripId:trip.tripId}));
   if(verified)identity=verified;
  }catch{
   // Failure of KYC lookup never fabricates verification, and must not
   // prevent a legitimate emergency from being recorded.
   identity={status:'NOT_VERIFIED',receiptId:null};
  }
  let event;
  try{
   event=await persistAtomicIncident({
    actorId:driver.userId,sessionId:driver.sessionId,
    requestKey:body.requestKey,tripId:trip.tripId,passengerId:trip.passengerId,
    vehicleKind:trip.vehicleKind,
    verificationStatus:identity.status,
    identityReceiptId:identity.receiptId
   });
  }catch{return rejected();}
  if(!PLAIN(event)||!uuid(event.incidentId)||event.atomicCommitted!==true||
     event.liveEnabled!==false)return rejected();
  // Intentionally never return identity, doc refs, phone, address, or GPS.
  // This is server persistence only, not delivered notification or human ACK.
  return receipt(event.idempotent===true?200:201,{
   ...noData,incidentId:event.incidentId,serverPersisted:true,
   idempotent:event.idempotent===true,journeyContinues:true
  });
 };
}
