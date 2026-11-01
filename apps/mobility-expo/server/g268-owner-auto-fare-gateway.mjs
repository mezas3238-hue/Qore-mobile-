/**
 * G268: private Owner AUTO fare publication bridge to STAGING G265.
 * No LIVE, PSP, synthetic Owner credentials, grants or browser service key.
 * The server derives user/session/iat; body can only contain fare parameters.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const PATH=/^\/v1\/staging\/owner\/auto-fares\/([A-Z_]{3,40})$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,ks)=>obj(x)&&Object.keys(x).length===ks.length&&ks.every(k=>Object.hasOwn(x,k));
const fields=['requestKey','basePyg','perKmPyg','perMinutePyg','minimumPyg','commissionBps'];
const deny=(status,code)=>({status,body:{code,mode:'STAGING_DEMO_ONLY',commercialEnabled:false}});
const validRequest=b=>exact(b,fields)&&UUID.test(b.requestKey??'')&&
 integer(b.basePyg,1000,1000000)&&integer(b.perKmPyg,0,100000)&&
 integer(b.perMinutePyg,0,20000)&&integer(b.minimumPyg,1000,1000000)&&
 integer(b.commissionBps,0,3000);
const validReceipt=(r,z,b)=>exact(r,['mode','commercialEnabled','ruleKey',
 'zoneTag','commissionBps','commissionPercent','active','idempotent'])&&
 r.mode==='STAGING_DEMO_ONLY'&&r.commercialEnabled===false&&
 r.zoneTag===z&&r.ruleKey==='G265_'+b.requestKey.replace(/-/g,'')&&
 r.commissionBps===b.commissionBps&&
 r.commissionPercent===b.commissionBps/100&&r.active===true&&
 typeof r.idempotent==='boolean';
export function createG268OwnerAutoFareGateway({
 projectRef,environment,qaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,publishFare,now=Date.now
}={}){
 assertStagingRef(projectRef);
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
  verifyBackofficeMfa,allowRequest,publishFare,now].some(fn=>typeof fn!=='function'))
  throw Error('G268 requires isolated STAGING Owner AAL2 and private G265 adapter');
 return async({method,path,headers={},body}={})=>{
  const match=typeof path==='string'?PATH.exec(path):null;
  if(method!=='POST'||!match)return deny(404,'G268_ROUTE_NOT_FOUND');
  const zoneTag=match[1];
  if(!validRequest(body))return deny(400,'G268_INVALID_AUTO_FARE');
  if(typeof headers.authorization!=='string'||headers.Authorization!==undefined||
     headers.cookie!==undefined)return deny(401,'G268_BEARER_REQUIRED');
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return deny(401,'G268_BEARER_REQUIRED');
  const at=now();
  if(!Number.isSafeInteger(at))return deny(503,'G268_CLOCK_UNAVAILABLE');
  let user;
  try{user=await verifyAccessToken(token);}catch{return deny(401,'G268_AUTH_UNAVAILABLE');}
  if(!obj(user)||!UUID.test(user.id??'')||!UUID.test(user.sessionId??'')||
     user.is_anonymous!==false||!Number.isSafeInteger(user.expiresAtMs)||
     user.expiresAtMs<=at||!Number.isSafeInteger(user.tokenIatMs)||
     user.tokenIatMs<=0||user.tokenIatMs>at)
   return deny(401,'G268_AUTH_INVALID');
  try{
   if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
    return deny(401,'G268_SESSION_REVOKED');
  }catch{return deny(503,'G268_SESSION_UNAVAILABLE');}
  let role;
  try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return deny(503,'G268_ROLE_UNAVAILABLE');}
  if(role!=='owner')return deny(403,'G268_OWNER_REQUIRED');
  let mfa;
  try{mfa=await verifyBackofficeMfa({
   token,userId:user.id,sessionId:user.sessionId,requiredLevel:'aal2',at
  });}catch{return deny(503,'G268_MFA_UNAVAILABLE');}
  if(!obj(mfa)||mfa.verifiedByProvider!==true||mfa.assuranceLevel!=='aal2'||
    mfa.userId!==user.id||mfa.sessionId!==user.sessionId||
    !Number.isSafeInteger(mfa.verifiedAtMs)||mfa.verifiedAtMs>at||
    at-mfa.verifiedAtMs>43200000||!Number.isSafeInteger(mfa.expiresAtMs)||
    mfa.expiresAtMs<=at||mfa.expiresAtMs>user.expiresAtMs)
   return deny(403,'G268_AAL2_REQUIRED');
  try{
   if(allowRequest({userId:user.id,operation:'owner.auto-fares.write'})!==true)
    return deny(429,'G268_RATE_LIMITED');
  }catch{return deny(503,'G268_LIMITER_UNAVAILABLE');}
  let receipt;
  try{receipt=await publishFare({
   ownerId:user.id,sessionId:user.sessionId,tokenIatMs:user.tokenIatMs,
   zoneTag,requestKey:body.requestKey,basePyg:body.basePyg,
   perKmPyg:body.perKmPyg,perMinutePyg:body.perMinutePyg,
   minimumPyg:body.minimumPyg,commissionBps:body.commissionBps
  });}catch{return deny(409,'G268_PRIVATE_FARE_UNRESOLVED');}
  if(!validReceipt(receipt,zoneTag,body))
   return deny(503,'G268_FARE_RECEIPT_UNVERIFIED');
  return {status:200,body:receipt};
 };
}
