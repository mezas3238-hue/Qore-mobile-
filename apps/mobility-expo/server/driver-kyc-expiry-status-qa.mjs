/**
 * Authenticated private Driver expiry/status reader.
 * No public SQL/grants, no IdP defaults, no push, no commercial permissions.
 */
export const DRIVER_KYC_EXPIRY_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const STATES=new Set(['BLOCKED_EXPIRED','BLOCKED_REVIEW','SUSPENDED','READY_QA']);
const KINDS=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','habilitacion','seguro','inspeccion','rostro_selfie']);
const DTO=['mode','state','expiredKinds','renewalRequiredKinds','expiringSoonKinds',
 'nearestExpiryAtMs','accountBlocked','qaOnboardingActive',
 'commercialDispatchAuthorized','qaOnly','productionEnabled'];
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const validKinds=items=>Array.isArray(items)&&items.length<=8&&
 new Set(items).size===items.length&&items.every(x=>KINDS.has(x));
const err=(code)=>Object.freeze({status:503,body:Object.freeze({
 code,qaOnly:true,productionEnabled:false,commercialDispatchAuthorized:false
})});
export function createDriverKycExpiryStatusQa({
 environment,localQaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,resolveActiveVehicle,
 queryOwnerValidity,allowRequest,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
 [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
  resolveActiveVehicle,queryOwnerValidity,allowRequest,now].some(x=>typeof x!=='function'))
 throw Error('KYC expiry requires authorized isolated server and owner SQL');
 return async({bearer}={})=>{
  if(typeof bearer!=='string'||!TOKEN.test(bearer))return err('KYC_JWT_REQUIRED');
  const at=now();
  if(!Number.isSafeInteger(at)||at<0)return err('KYC_CLOCK_UNAVAILABLE');
  let user;
  try{user=await verifyAccessToken(bearer);}
  catch{return err('KYC_IDENTITY_UNAVAILABLE');}
  if(!exact(user,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(user.id)||!UUID.test(user.sessionId)||
   !Number.isSafeInteger(user.tokenIatMs)||user.tokenIatMs>at||
   !Number.isSafeInteger(user.expiresAtMs)||user.expiresAtMs<=at||
   user.is_anonymous!==false)return err('KYC_IDENTITY_UNAVAILABLE');
  try{
   if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
    return err('KYC_SESSION_REVOKED');
   if(await resolveExclusiveRole(user.id)!=='driver')
    return err('KYC_EXCLUSIVE_DRIVER_REQUIRED');
   if(allowRequest({actorId:user.id,operation:'driver.kyc.validity'})!==true)
    return err('KYC_RATE_LIMITED');
  }catch{return err('KYC_AUTHORITY_UNAVAILABLE');}
  let scope,record;
  try{
   scope=await resolveActiveVehicle(user.id);
   if(!exact(scope,['driverId','vehicleId'])||scope.driverId!==user.id||
     !UUID.test(scope.vehicleId))throw Error('untrusted ownership');
   record=await queryOwnerValidity({driverId:user.id,vehicleId:scope.vehicleId});
  }catch{return err('KYC_PRIVATE_STATUS_UNAVAILABLE');}
  if(!exact(record,DTO)||record.mode!=='STAGING_DEMO_ONLY'||
   !STATES.has(record.state)||!validKinds(record.expiredKinds)||
   !validKinds(record.renewalRequiredKinds)||!validKinds(record.expiringSoonKinds)||
   !(record.nearestExpiryAtMs===null||
     Number.isSafeInteger(record.nearestExpiryAtMs)&&record.nearestExpiryAtMs>at)||
   typeof record.accountBlocked!=='boolean'||
   typeof record.qaOnboardingActive!=='boolean'||
   record.accountBlocked===record.qaOnboardingActive||
   record.qaOnboardingActive!==(record.state==='READY_QA')||
   (record.state==='BLOCKED_EXPIRED'&&record.expiredKinds.length===0)||
   (record.state==='READY_QA'&&record.renewalRequiredKinds.length!==0)||
   !record.expiredKinds.every(k=>record.renewalRequiredKinds.includes(k))||
   record.commercialDispatchAuthorized!==false||
   record.productionEnabled!==false||record.qaOnly!==true)
    return err('KYC_UNTRUSTED_VALIDITY');
  return Object.freeze({status:200,body:Object.freeze({...record})});
 };
}
