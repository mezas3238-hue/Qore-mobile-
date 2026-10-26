/**
 * G124: Owner/AAL2 private tariffs for CARGO MOTO/AUTO, not passenger rates.
 * Server-only, STAGING only. No LIVE, no PSP, no external route provider.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const MATCH=/^\/v1\/staging\/owner\/delivery-rates\/(AUTO|MOTO)\/([A-Z_]{3,20})$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const integer=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const deny=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
const required=['requestKey','basePyg','perKmPyg','perMinutePyg',
 'minimumPyg','commissionBps','durationDays'];
const price=x=>exact(x,required)&&UUID.test(x.requestKey??'')&&
 integer(x.basePyg,0,1000000)&&integer(x.perKmPyg,0,100000)&&
 integer(x.perMinutePyg,0,20000)&&integer(x.minimumPyg,1,1000000)&&
 integer(x.commissionBps,0,3000)&&integer(x.durationDays,1,90);
const receipt=(d,v,z)=>obj(d)&&d.mode==='STAGING_DEMO_ONLY'&&
 d.liveEnabled===false&&d.passengerSubsidyPolicyApplicable===false&&
 d.vehicleKind===v&&d.cargoZone===z&&UUID.test(d.ruleId??'')&&
 typeof d.ruleVersion==='string'&&
 /^[a-zA-Z0-9._-]{1,48}$/.test(d.ruleVersion)&&
 integer(d.version,1,2147483647)&&integer(d.basePyg,0,1000000)&&
 integer(d.perKmPyg,0,100000)&&integer(d.perMinutePyg,0,20000)&&
 integer(d.minimumPyg,1,1000000)&&integer(d.commissionBps,0,3000)&&
 d.active===true&&typeof d.validUntil==='string'&&
 Number.isFinite(Date.parse(d.validUntil));
export function createG124OwnerCargoRateGateway({
 projectRef,environment,qaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,readPolicy,changePolicy,now=Date.now
}={}){
 assertStagingRef(projectRef);
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
   verifyBackofficeMfa,allowRequest,readPolicy,changePolicy,now]
   .some(f=>typeof f!=='function'))throw Error('G124 Owner AAL2 required');
 return async({method,path,headers={},body}={})=>{
  const hit=typeof path==='string'?MATCH.exec(path):null;
  if(!hit||!['GET','POST'].includes(method))
   return deny(404,'ROUTE_NOT_FOUND');
  const vehicleKind=hit[1],cargoZone=hit[2],write=method==='POST';
  if(!write&&body!=null)return deny(400,'GET_BODY_FORBIDDEN');
  if(write&&!price(body))return deny(400,'INVALID_CARGO_TARIFF');
  if(typeof headers.authorization!=='string'||headers.Authorization!==undefined||
   headers.cookie!==undefined)return deny(401,'BEARER_REQUIRED');
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return deny(401,'BEARER_REQUIRED');
  const at=now();if(!Number.isSafeInteger(at))return deny(503,'CLOCK_UNAVAILABLE');
  let user;
  try{user=await verifyAccessToken(token);}catch{return deny(401,'AUTH_UNAVAILABLE');}
  if(!obj(user)||!UUID.test(user.id??'')||!UUID.test(user.sessionId??'')||
   user.is_anonymous!==false||!integer(user.expiresAtMs,at+1,8640000000000000))
   return deny(401,'AUTH_INVALID');
  try{
   if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
    return deny(401,'SESSION_REVOKED');
  }catch{return deny(503,'SESSION_UNAVAILABLE');}
  let role;try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return deny(503,'ROLE_UNAVAILABLE');}
  if(role!=='owner')return deny(403,'OWNER_REQUIRED');
  let mfa;try{mfa=await verifyBackofficeMfa({
   token,userId:user.id,sessionId:user.sessionId,requiredLevel:'aal2',at});
  }catch{return deny(503,'MFA_UNAVAILABLE');}
  if(!obj(mfa)||mfa.verifiedByProvider!==true||mfa.assuranceLevel!=='aal2'||
   mfa.userId!==user.id||mfa.sessionId!==user.sessionId||
   !integer(mfa.verifiedAtMs,1,at)||at-mfa.verifiedAtMs>43200000||
   !integer(mfa.expiresAtMs,at+1,user.expiresAtMs))
   return deny(403,'AAL2_REQUIRED');
  try{
   if(allowRequest({userId:user.id,operation:write?
    'owner.delivery.rate.write':'owner.delivery.rate.read'})!==true)
    return deny(429,'RATE_LIMITED');
  }catch{return deny(503,'LIMITER_UNAVAILABLE');}
  let result;
  try{
   result=write?await changePolicy({
    actorId:user.id,vehicleKind,cargoZone,...body}):
    await readPolicy({actorId:user.id,vehicleKind,cargoZone});
  }catch{return deny(409,'CARGO_TARIFF_REJECTED');}
  if(!write&&result===null)return deny(404,'CARGO_TARIFF_NOT_CONFIGURED');
  return receipt(result,vehicleKind,cargoZone)?{status:200,body:result}:
   deny(503,'INVALID_CARGO_TARIFF_RECEIPT');
 };
}
