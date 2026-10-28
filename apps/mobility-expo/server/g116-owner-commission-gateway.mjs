/** Owner commission configuration; QA-only, no production HTTP or payments.
 * Owner ID MUST come from independently verified Auth + AAL2, not JSON.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const PATH=/^\/v1\/staging\/owner\/commissions\/(AUTO_RIDE|MOTO_RIDE|DELIVERY_AUTO|DELIVERY_MOTO|COMMERCE)$/;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const deny=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
const valid=(x,service)=>exact(x,['serviceKind','commissionBps','subsidyBps',
 'version','mode','productionEnabled'])&&x.serviceKind===service
 &&Number.isSafeInteger(x.commissionBps)&&x.commissionBps>=0
 &&x.commissionBps<=3000
 &&(['AUTO_RIDE','MOTO_RIDE'].includes(service)
  ?x.commissionBps>=1000&&x.subsidyBps===1000:x.subsidyBps===0)
 &&Number.isSafeInteger(x.version)&&x.version>=1
 &&x.mode==='STAGING_DEMO_ONLY'&&x.productionEnabled===false;
export function createG116OwnerCommissionGateway({
 projectRef,environment,qaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,readPolicy,changePolicy,now=Date.now
}={}){
 assertStagingRef(projectRef);
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false
 ||[verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,readPolicy,changePolicy,now]
 .some(f=>typeof f!=='function'))throw Error('G116 requires Owner AAL2 QA');
 return async({method,path,headers={},body}={})=>{
  const found=typeof path==='string'?PATH.exec(path):null;
  if(!found||!['GET','POST'].includes(method))return deny(404,'ROUTE_NOT_FOUND');
  const service=found[1],isWrite=method==='POST';
  if(!isWrite&&body!=null)return deny(400,'GET_BODY_FORBIDDEN');
  if(isWrite&&(!exact(body,['requestKey','commissionBps'])
   ||typeof body.requestKey!=='string'||!UUID.test(body.requestKey)
   ||!Number.isSafeInteger(body.commissionBps)
   ||body.commissionBps<0||body.commissionBps>3000
   ||(['AUTO_RIDE','MOTO_RIDE'].includes(service)&&body.commissionBps<1000)))
   return deny(400,'INVALID_COMMISSION');
  if(typeof headers.authorization!=='string'||headers.Authorization!==undefined
   ||headers.cookie!==undefined)return deny(401,'BEARER_REQUIRED');
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return deny(401,'BEARER_REQUIRED');
  const at=now();if(!Number.isSafeInteger(at))return deny(503,'CLOCK_UNAVAILABLE');
  let user;try{user=await verifyAccessToken(token);}
  catch{return deny(401,'AUTH_UNAVAILABLE');}
  if(!obj(user)||!UUID.test(user.id??'')||!UUID.test(user.sessionId??'')
   ||user.is_anonymous!==false||!Number.isSafeInteger(user.expiresAtMs)
   ||user.expiresAtMs<=at)return deny(401,'AUTH_INVALID');
  try{if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
   return deny(401,'SESSION_REVOKED');}
  catch{return deny(503,'SESSION_UNAVAILABLE');}
  let role;try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return deny(503,'ROLE_UNAVAILABLE');}
  if(role!=='owner')return deny(403,'OWNER_REQUIRED');
  let mfa;try{mfa=await verifyBackofficeMfa({
   token,userId:user.id,sessionId:user.sessionId,requiredLevel:'aal2',at
  });}catch{return deny(503,'MFA_UNAVAILABLE');}
  if(!obj(mfa)||mfa.verifiedByProvider!==true||mfa.assuranceLevel!=='aal2'
   ||mfa.userId!==user.id||mfa.sessionId!==user.sessionId
   ||!Number.isSafeInteger(mfa.verifiedAtMs)||mfa.verifiedAtMs>at
   ||at-mfa.verifiedAtMs>43200000||!Number.isSafeInteger(mfa.expiresAtMs)
   ||mfa.expiresAtMs<=at||mfa.expiresAtMs>user.expiresAtMs)
   return deny(403,'AAL2_REQUIRED');
  try{if(allowRequest({userId:user.id,
   operation:isWrite?'owner.commission.write':'owner.commission.read'})!==true)
   return deny(429,'RATE_LIMITED');}
  catch{return deny(503,'LIMITER_UNAVAILABLE');}
  let data;
  try{data=isWrite?await changePolicy({actorId:user.id,serviceKind:service,
   requestKey:body.requestKey,commissionBps:body.commissionBps})
   :await readPolicy({actorId:user.id,serviceKind:service});}
  catch{return deny(409,'POLICY_NOT_CONFIRMED');}
  return valid(data,service)?{status:200,body:data}:deny(503,'INVALID_POLICY_RECEIPT');
 };
}
