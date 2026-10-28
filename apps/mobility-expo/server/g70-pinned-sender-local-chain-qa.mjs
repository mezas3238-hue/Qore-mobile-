/**
 * G70 pinned JWT -> provider G42 session -> exclusive Passenger ->
 * G69 one-use owner-only SQL proof -> local HTTP (127.0.0.1).
 * No real IdP, database, bearer, credentials or HTTPS endpoint configured.
 */
import {createG42PinnedJwtVerifier,createG42ProviderSessionAdapters}
 from './g42-provider-pinned-jwt-auth-qa.mjs';
import {createG69TrustedSenderReadQa}
 from './g69-trusted-sender-read-qa.mjs';
import {createG70SenderCustodyLoopbackQa}
 from './g70-sender-custody-loopback-qa.mjs';
export const G70_PUBLIC_HTTPS_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createG70PinnedSenderLocalChainQa({
 environment,localQaOnly,liveEnabled,issuer,audience,publicKeys,
 readProviderUser,readProviderSession,readPrivateSessionGrant,
 readExclusiveRole,allowRequest,createSyntheticAttestation,
 exchangeScopedProof,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [readProviderUser,readProviderSession,readPrivateSessionGrant,
   readExclusiveRole,allowRequest,createSyntheticAttestation,
   exchangeScopedProof,now].some(f=>typeof f!=='function'))
  throw Error('G70 requires pinned provider, G42 and G69 private authorities');
 const verifier=createG42PinnedJwtVerifier({issuer,audience,publicKeys,now});
 const auth=createG42ProviderSessionAdapters({
  environment,localQaOnly,liveEnabled,verifyJwt:verifier,
  readProviderUser,readProviderSession,readPrivateSessionGrant,now
 });
 const scopedVerify=async bearer=>{
  const a=await auth.verifyAccessToken(bearer);
  return Object.freeze({id:a.id,sessionId:a.sessionId,
   tokenIatMs:a.tokenIatMs,expiresAtMs:a.expiresAtMs,is_anonymous:false});
 };
 const readRole=async actor=>{
  if(typeof actor!=='string'||!UUID.test(actor))
   throw Error('G70 invalid actor');
  const role=await readExclusiveRole(actor);
  if(role!=='driver'&&role!=='passenger')
   throw Error('G70 only one current role permitted');
  return role;
 };
 const service=createG69TrustedSenderReadQa({
  environment,localQaOnly,liveEnabled,now,
  verifyAccessToken:scopedVerify,
  verifySessionNotRevoked:auth.verifySessionNotRevoked,
  resolveExclusiveRole:readRole,allowRequest,
  issueOwnerAttestation:createSyntheticAttestation,
  exchangeDelegatedProof:exchangeScopedProof
 });
 const listener=createG70SenderCustodyLoopbackQa({
  environment,localQaOnly,liveEnabled,
  privateSenderRead:service.read
 });
 // Explicitly do not expose the verifier, owner proof issuer, SQL function,
 // private bearer, sessions or server object to the caller.
 return Object.freeze({
  listen:()=>listener.listen(),
  close:()=>listener.close()
 });
}
