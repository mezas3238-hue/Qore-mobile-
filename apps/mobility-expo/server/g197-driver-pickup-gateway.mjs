/**
 * G197 A: authenticated Driver-only REST for maximum server ROAD distance.
 * QA only; callbacks MUST resolve IdP/G42 and persist to original PostgreSQL.
 * Never use driverId or GPS supplied by mobile as SQL authority.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const BEARER=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const KINDS=['RIDE','DELIVERY','MERCHANT_ORDER'];
const BANDS=[1000,2000,3000,5000,8000,10000,15000,20000,30000,50000];
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const deny=(status,code)=>Object.freeze({status,body:{code,retrySafe:false,
 mode:'STAGING_DEMO_ONLY',productionEnabled:false}});
const row=x=>exact(x,['serviceKind','maximumRoadMeters','revision'])&&
 KINDS.includes(x.serviceKind)&&BANDS.includes(x.maximumRoadMeters)&&
 Number.isSafeInteger(x.revision)&&x.revision>=1;
export function createG197DriverPickupGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,verifySessionNotRevoked,
 resolveExclusiveRole,allowRequest,readPreferences,savePreference,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
 [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
  readPreferences,savePreference,now].some(x=>typeof x!=='function'))
 throw Error('G197 independent Driver IdP, G42 and PostgreSQL authority required');
 return async({method,path,headers={},body}={})=>{
  if(path!=='/v1/staging/driver/pickup-preferences'||
    !['GET','PUT'].includes(method))return deny(404,'G197_UNKNOWN_ROUTE');
  if(method==='GET'&&body!=null)return deny(400,'G197_UNEXPECTED_BODY');
  if(method==='PUT'&&(!exact(body,['serviceKind','maximumRoadMeters','expectedRevision'])
   ||!KINDS.includes(body.serviceKind)||!BANDS.includes(body.maximumRoadMeters)
   ||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0))
   return deny(400,'G197_INVALID_RANGE');
  const token=headers.Authorization===undefined&&headers.cookie===undefined
   &&typeof headers.authorization==='string'?
   BEARER.exec(headers.authorization)?.[1]:null;
  if(!token)return deny(401,'G197_AUTH_REQUIRED');
  let actor;
  try{actor=await verifyAccessToken(token);}
  catch{return deny(401,'G197_IDP_UNAVAILABLE');}
  const at=now();
  if(!exact(actor,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])
   ||!UUID.test(actor.id)||!UUID.test(actor.sessionId)
   ||!Number.isSafeInteger(actor.tokenIatMs)||actor.tokenIatMs>at
   ||!Number.isSafeInteger(actor.expiresAtMs)||actor.expiresAtMs<=at
   ||actor.is_anonymous!==false)return deny(401,'G197_IDENTITY_INVALID');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,at})!==true)
    return deny(401,'G197_SESSION_REVOKED');
   if(await resolveExclusiveRole(actor.id)!=='driver')
    return deny(403,'G197_EXCLUSIVE_DRIVER_REQUIRED');
   if(allowRequest({actorId:actor.id,operation:'G197_'+method})!==true)
    return deny(429,'G197_RATE_LIMITED');
  }catch{return deny(503,'G197_AUTHORITY_UNAVAILABLE');}
  const scope={driverId:actor.id,sessionId:actor.sessionId,tokenIatMs:actor.tokenIatMs};
  let result;
  try{result=method==='GET'?await readPreferences(scope):
   await savePreference({...scope,serviceKind:body.serviceKind,
    maximumRoadMeters:body.maximumRoadMeters,
    expectedRevision:body.expectedRevision});}
  catch{return deny(503,'G197_SQL_OUTCOME_UNKNOWN');}
  const common=result?.mode==='STAGING_DEMO_ONLY'&&
   result.driverId===actor.id&&result.productionEnabled===false&&
   result.liveEnabled===false;
  const valid=method==='GET'?
   exact(result,['mode','driverId','preferences','productionEnabled','liveEnabled'])
   &&Array.isArray(result.preferences)&&result.preferences.length<=3
   &&result.preferences.every(row)
   &&new Set(result.preferences.map(x=>x.serviceKind)).size===result.preferences.length:
   exact(result,['mode','driverId','serviceKind','maximumRoadMeters','revision',
    'serverPersisted','liveEnabled','productionEnabled'])&&
   result.serviceKind===body.serviceKind&&
   result.maximumRoadMeters===body.maximumRoadMeters&&
   result.revision===body.expectedRevision+1&&result.serverPersisted===true;
  if(!common||!valid)return deny(503,'G197_UNVERIFIED_SQL_RECEIPT');
  const ended=now();
  if(ended<at||ended>=actor.expiresAtMs)return deny(503,'G197_SESSION_CHANGED');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,at:ended})!==true)
    return deny(503,'G197_SESSION_CHANGED');
  }catch{return deny(503,'G197_SESSION_CHANGED');}
  return {status:200,body:result};
 };
}
