/**
 * G69 private server-only bridge, QA only. Follows G68 sender-owned DTO.
 * No public mint, no raw proof, no service_role, no real IdP or HTTPS mount.
 */
export const G69_PUBLIC_SENDER_EXCHANGE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const STATES=['requested','accepted','picked_up','delivered','disputed','returned','cancelled'];
const KEYS=['mode','deliveryId','ownerId','state','revision','vehicleKind',
 'assignmentPersisted','proofVerified','qaOnly','productionEnabled','liveDeliveriesEnabled'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const failure=(code)=>Object.freeze({status:503,body:Object.freeze({
 code,qaOnly:true,productionEnabled:false,retrySafe:false
})});
export function createG69TrustedSenderReadQa({
 environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,issueOwnerAttestation,exchangeDelegatedProof,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
 [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 issueOwnerAttestation,exchangeDelegatedProof,now].some(f=>typeof f!=='function'))
 throw Error('G69 requires trusted QA identity, proof mint and restricted SQL');
 return Object.freeze({
  async read({accessToken,deliveryId}={}){
   if(typeof accessToken!=='string'||!TOKEN.test(accessToken)||
    typeof deliveryId!=='string'||!UUID.test(deliveryId))
    return failure('G69_NO_VALID_SCOPE');
   let identity;
   try{identity=await verifyAccessToken(accessToken);}
   catch{return failure('G69_IDENTITY_UNVERIFIED');}
   const at=now();
   if(!exact(identity,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
    !UUID.test(identity.id)||!UUID.test(identity.sessionId)||
    !Number.isSafeInteger(at)||at<0||
    !Number.isSafeInteger(identity.tokenIatMs)||identity.tokenIatMs>at||
    !Number.isSafeInteger(identity.expiresAtMs)||identity.expiresAtMs<=at||
    identity.is_anonymous!==false)
    return failure('G69_IDENTITY_UNVERIFIED');
   try{
    if(await verifySessionNotRevoked({userId:identity.id,
     sessionId:identity.sessionId,at})!==true)
      return failure('G69_SESSION_UNVERIFIED');
    if(await resolveExclusiveRole(identity.id)!=='passenger')
      return failure('G69_EXCLUSIVE_PASSENGER_REQUIRED');
    if(allowRequest({actorId:identity.id,operation:'sender_custody_read'})!==true)
      return failure('G69_RATE_LIMIT');
   }catch{return failure('G69_AUTHORITY_UNAVAILABLE');}
   // Both callbacks MUST be injected by backend trusted integrator;
   // no proof value is accepted from the mobile.
   let proof;
   try{proof=await issueOwnerAttestation(Object.freeze({
     senderId:identity.id,sessionId:identity.sessionId,
     tokenIatMs:identity.tokenIatMs,deliveryId
   }));}catch{return failure('G69_ATTESTATION_UNAVAILABLE');}
   if(typeof proof!=='string'||!UUID.test(proof))
    return failure('G69_ATTESTATION_UNVERIFIED');
   let data;
   try{data=await exchangeDelegatedProof(proof);}
   catch{return failure('G69_READ_OUTCOME_UNKNOWN');}
   if(!exact(data,KEYS)||data.mode!=='STAGING_DEMO_ONLY'||
    data.deliveryId!==deliveryId||data.ownerId!==identity.id||
    !STATES.includes(data.state)||!Number.isSafeInteger(data.revision)||
    data.revision<1||!['AUTO','MOTO'].includes(data.vehicleKind)||
    typeof data.assignmentPersisted!=='boolean'||
    typeof data.proofVerified!=='boolean'||
    data.qaOnly!==true||data.productionEnabled!==false||
    data.liveDeliveriesEnabled!==false||
    (['delivered','disputed','returned'].includes(data.state)&&
      (!data.proofVerified||!data.assignmentPersisted)))
    return failure('G69_UNTRUSTED_SQL_RESULT');
   // Read-only no retry. Never return internal attestation, session,
   // sender token, courier ID or real proof reference.
   return Object.freeze({status:200,body:Object.freeze({...data})});
  }
 });
}
