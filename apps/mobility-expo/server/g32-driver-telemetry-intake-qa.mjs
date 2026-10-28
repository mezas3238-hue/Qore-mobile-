/**
 * G32 — synthetic-only, verified Driver location telemetry intake gate.
 * No HTTP listener, no user-generated zone/driver attribution, NO dispatch.
 * All adapters are server-trusted AND independently verified.
 * Accepted signals go to private quarantine; never modify G31 zone counts.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>isObject(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const validInt=n=>Number.isSafeInteger(n)&&n>=0;
const result=(status,code)=>Object.freeze({status,body:{code,productionEnabled:false,dispatchAuthorized:false}});
const SERVICE=new Set(['AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY']);
function validatePacket(packet,at){
 if(!exact(packet,['eventId','sequence','capturedAtMs','location'])
 ||typeof packet.eventId!=='string'||!uuid.test(packet.eventId)
 ||!Number.isSafeInteger(packet.sequence)||packet.sequence<1
 ||!validInt(packet.capturedAtMs)||packet.capturedAtMs<at-30000
 ||packet.capturedAtMs>at+5000
 ||!exact(packet.location,['lat','lng','accuracyMeters'])
 ||!Number.isFinite(packet.location.lat)||packet.location.lat< -90||
 packet.location.lat>90||!Number.isFinite(packet.location.lng)||
 packet.location.lng< -180||packet.location.lng>180||
 !Number.isFinite(packet.location.accuracyMeters)||
 packet.location.accuracyMeters<=0||packet.location.accuracyMeters>50)
 return false;
 return true;
}
export function createQoreG32TelemetryIntakeQa({
 environment,liveEnabled,localQaOnly,
 verifyDriverAccessToken,loadLocationConsent,verifyDriverEligibility,
 resolveVerifiedGeofence,verifyLocationIntegrity,allowRequest,
 commitQuarantinedSignal,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
 localQaOnly!==true)throw Error('G32 location telemetry is isolated QA only');
 const deps=[verifyDriverAccessToken,loadLocationConsent,verifyDriverEligibility,
  resolveVerifiedGeofence,verifyLocationIntegrity,allowRequest,
  commitQuarantinedSignal,now];
 if(deps.some(x=>typeof x!=='function'))
  throw Error('All independent, trusted location/identity adapters required');
 return async({method,headers,packet}={})=>{
  if(method!=='POST')return result(405,'METHOD_NOT_ALLOWED');
  if(!headers||typeof headers!=='object'||headers.cookie||
    headers.origin||headers['x-forwarded-host'])
   return result(403,'UNTRUSTED_CLIENT');
  const raw=headers.authorization??headers.Authorization;
  const bearer=typeof raw==='string'&&raw.length<8000?
   /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(raw)?.[1]:null;
  if(!bearer)return result(401,'DRIVER_AUTH_REQUIRED');
  const at=now();
  if(!validInt(at))return result(503,'CLOCK_UNAVAILABLE');
  if(!validatePacket(packet,at))return result(400,'INVALID_LOCATION_PACKET');
  let driver;
  try{driver=await verifyDriverAccessToken(bearer);}
  catch{return result(401,'INVALID_DRIVER_SESSION');}
  if(!isObject(driver)||driver.verifiedByProvider!==true||
   driver.role!=='driver'||driver.revoked!==false||
   typeof driver.id!=='string'||!uuid.test(driver.id)||
   typeof driver.sessionId!=='string'||driver.sessionId.length<8||
   !validInt(driver.expiresAtMs)||driver.expiresAtMs<=at)
   return result(401,'DRIVER_AUTH_REQUIRED');
  try{
   if(await allowRequest({driverId:driver.id,operation:'driver.location.qa'})!==true)
    return result(429,'DRIVER_LOCATION_RATE_LIMITED');
  }catch{return result(503,'RATE_LIMIT_UNAVAILABLE');}
  let consent;
  try{consent=await loadLocationConsent({driverId:driver.id,at});}
  catch{return result(503,'CONSENT_AUTHORITY_UNAVAILABLE');}
  if(!isObject(consent)||consent.verifiedByServer!==true||
   consent.driverId!==driver.id||consent.active!==true||
   !validInt(consent.revision)||consent.revision<1||
   !validInt(consent.optedInAtMs)||
   consent.optedInAtMs>packet.capturedAtMs||consent.revokedAtMs!==null)
   return result(403,'LOCATION_CONSENT_REQUIRED');
  let integrity;
  try{integrity=await verifyLocationIntegrity({
   driverId:driver.id,sessionId:driver.sessionId,
   eventId:packet.eventId,sequence:packet.sequence,
   capturedAtMs:packet.capturedAtMs,at,location:packet.location
  });}catch{return result(503,'INTEGRITY_CHECK_UNAVAILABLE');}
  if(!isObject(integrity)||integrity.verifiedByServer!==true||
   integrity.driverId!==driver.id||integrity.eventId!==packet.eventId||
   integrity.accepted!==true||!validInt(integrity.checkedAtMs)||
   integrity.checkedAtMs>at||at-integrity.checkedAtMs>10000)
   return result(403,'LOCATION_INTEGRITY_DENIED');
  let geo;
  try{geo=await resolveVerifiedGeofence({
   driverId:driver.id,capturedAtMs:packet.capturedAtMs,
   location:packet.location,at
  });}catch{return result(503,'GEOFENCE_UNAVAILABLE');}
  if(!isObject(geo)||geo.verifiedByServer!==true||
   geo.driverId!==driver.id||geo.countryCode!=='PY'||
   typeof geo.zoneId!=='string'||!uuid.test(geo.zoneId)||
   !validInt(geo.geometryRevision)||geo.geometryRevision<1||
   !validInt(geo.verifiedAtMs)||geo.verifiedAtMs>at||
   at-geo.verifiedAtMs>10000)
   return result(403,'GEOFENCE_NOT_VERIFIED');
  let eligibility;
  try{eligibility=await verifyDriverEligibility({
   driverId:driver.id,zoneId:geo.zoneId,at
  });}catch{return result(503,'ELIGIBILITY_UNAVAILABLE');}
  if(!isObject(eligibility)||eligibility.verifiedByServer!==true||
   eligibility.driverId!==driver.id||eligibility.zoneId!==geo.zoneId||
   eligibility.eligible!==true||!SERVICE.has(eligibility.serviceKind)||
   !validInt(eligibility.checkedAtMs)||eligibility.checkedAtMs>at||
   at-eligibility.checkedAtMs>10000)
   return result(403,'DRIVER_SERVICE_NOT_VERIFIED');
  try{
   const stored=await commitQuarantinedSignal({
    driverId:driver.id,eventId:packet.eventId,sequence:packet.sequence,
    capturedAtMs:packet.capturedAtMs,zoneId:geo.zoneId,
    serviceKind:eligibility.serviceKind,
    consentRevision:consent.revision,geometryRevision:geo.geometryRevision
   });
   if(!isObject(stored)||stored.persisted!==true||
      stored.eventId!==packet.eventId)
    return result(503,'QUARANTINE_NOT_CONFIRMED');
  }catch{return result(409,'SIGNAL_REJECTED_OR_REPLAYED');}
  return Object.freeze({status:202,body:Object.freeze({
   code:'LOCATION_QA_QUARANTINED',
   eventId:packet.eventId,productionEnabled:false,
   availabilityConfirmed:false,dispatchAuthorized:false
  })});
 };
}
