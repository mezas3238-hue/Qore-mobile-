/**
 * G67: owner-only synthetic proof lookup, no upload endpoint, no bytes/PII.
 * The mobile MUST NOT manufacture the proofRef; this adapter only accepts
 * the result of a privately server-owned, independently reviewed registry.
 * SQL G67 trigger is the FINAL authority inside the G5 delivery transaction.
 */
export const G67_REAL_PROOF_STORAGE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid=x=>typeof x==='string'&&UUID.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
export function createG67SyntheticProofAuthority({
 environment,localQaOnly,liveEnabled,
 resolveServerSession,resolveExclusiveRole,readAttestedProof,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [resolveServerSession,resolveExclusiveRole,readAttestedProof,now]
   .some(x=>typeof x!=='function'))
  throw Error('G67 only with private server-authenticated synthetic proof registry');
 return Object.freeze({
  async obtainVerifiedProof({accessToken,deliveryId,actorId}={}){
   if(typeof accessToken!=='string'||accessToken.length<20||
    accessToken.length>7900||!valid(deliveryId)||!valid(actorId))
    throw Error('G67 proof identity invalid');
   let s;
   try{s=await resolveServerSession(accessToken);}
   catch{throw Error('G67 independently authenticated session unavailable');}
   const at=now();
   if(!plain(s)||Object.keys(s).length!==6||
    !valid(s.id)||!valid(s.sessionId)||s.id!==actorId||
    !Number.isSafeInteger(s.tokenIatMs)||s.tokenIatMs>at||
    !Number.isSafeInteger(s.expiresAtMs)||s.expiresAtMs<=at||
    s.is_anonymous!==false||s.sessionActive!==true)
    throw Error('G67 expired/foreign identity denied');
   let r;
   try{r=await resolveExclusiveRole(actorId);}
   catch{throw Error('G67 role authority unavailable');}
   if(r!=='driver')throw Error('G67 exclusive Driver required');
   let stored;
   try{stored=await readAttestedProof({
    actorId,deliveryId,sessionId:s.sessionId,tokenIatMs:s.tokenIatMs
   });}catch{throw Error('G67 proof registry unavailable');}
   if(!plain(stored)||Object.keys(stored).length!==6||
    stored.deliveryId!==deliveryId||stored.courierId!==actorId||
    stored.sessionId!==s.sessionId||
    !valid(stored.proofRef)||stored.status!=='verified'||
    !Number.isSafeInteger(stored.expiresAtMs)||stored.expiresAtMs<=at)
    throw Error('G67 no verified proof available');
   // No photo, hash, file, location, phone, sender metadata, provider key,
   // session or token is surfaced into the Driver screen snapshot.
   return Object.freeze({deliveryId,actorId,proofRef:stored.proofRef,
    verifiedByServer:true});
  }
 });
}
