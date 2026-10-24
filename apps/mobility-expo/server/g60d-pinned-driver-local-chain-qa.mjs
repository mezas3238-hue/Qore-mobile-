/**
 * G60D local-only QA composition: ES256/RS256/EdDSA pinned G42 JWT ->
 * provider session/SQL grant -> exclusive Driver role -> server-scoped
 * stopped evidence -> G60C one-use proof -> G60B loopback.
 * Contains NO credentials, IdP network, production endpoint, or user data.
 */
import {createG42PinnedJwtVerifier,createG42ProviderSessionAdapters}
 from './g42-provider-pinned-jwt-auth-qa.mjs';
import {createG60CVerifiedDriverWriteQa}
 from './g60c-verified-driver-write-qa.mjs';
import {createG60BDriverWriteLoopbackQa}
 from './g60b-driver-write-loopback-qa.mjs';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&ID.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const QA={environment:'isolated_staging',localQaOnly:true,liveEnabled:false};
export function createG60DDriverVerifiedLocalChainQa({
 environment,localQaOnly,liveEnabled,issuer,audience,publicKeys,
 readProviderUser,readProviderSession,readPrivateSessionGrant,
 readExclusiveRole,readStoppedEvidence,allowRequest,
 createSyntheticAttestation,exchangeScopedProof,now=Date.now
}={}){
 if(environment!==QA.environment||localQaOnly!==true||liveEnabled!==false||
  [readProviderUser,readProviderSession,readPrivateSessionGrant,
   readExclusiveRole,readStoppedEvidence,allowRequest,
   createSyntheticAttestation,exchangeScopedProof,now]
  .some(f=>typeof f!=='function'))
  throw Error('G60D cannot start without independent provider/G42/SQL QA authorities');
 const verifier=createG42PinnedJwtVerifier({issuer,audience,publicKeys,now});
 const auth=createG42ProviderSessionAdapters({...QA,
  verifyJwt:verifier,readProviderUser,readProviderSession,
  readPrivateSessionGrant,now});
 const role=async actor=>{
  if(!id(actor))throw Error('G60D invalid actor');
  const actual=await readExclusiveRole(actor);
  if(actual!=='driver'&&actual!=='passenger')
   throw Error('G60D missing/ambiguous exclusive role');
  return actual;
 };
 const scopedAuth=async bearer=>{
  const a=await auth.verifyAccessToken(bearer);
  return Object.freeze({id:a.id,sessionId:a.sessionId,
   tokenIatMs:a.tokenIatMs,expiresAtMs:a.expiresAtMs,
   is_anonymous:false});
 };
 const write=createG60CVerifiedDriverWriteQa({...QA,
  verifyAccessToken:scopedAuth,
  verifySessionNotRevoked:auth.verifySessionNotRevoked,
  resolveExclusiveRole:role,allowRequest,
  createSyntheticAttestation,exchangeScopedProof,now});
 async function verifyStopped({
  bearer,serviceKind,serviceId,conversationId
 }){
  const actor=await scopedAuth(bearer);
  if(await auth.verifySessionNotRevoked({
   userId:actor.id,sessionId:actor.sessionId,at:now()})!==true||
   await role(actor.id)!=='driver')
   throw Error('G60D Driver auth/role denied before telematics read');
  const input=Object.freeze({driverId:actor.id,serviceKind,
   serviceId,conversationId});
  const record=await readStoppedEvidence(input);
  const at=now();
  if(!exact(record,[
   'driverId','serviceKind','serviceId','conversationId',
   'vehicleStopped','source','observedAtMs'
  ])||record.driverId!==actor.id||
   record.serviceKind!==serviceKind||record.serviceId!==serviceId||
   record.conversationId!==conversationId||
   record.vehicleStopped!==true||record.source!=='trusted_navigation'||
   !Number.isSafeInteger(record.observedAtMs)||
   record.observedAtMs>at||at-record.observedAtMs>5000)
   throw Error('G60D no current independent stopped-vehicle evidence');
  return Object.freeze({vehicleStopped:true,
   source:'trusted_navigation',observedAtMs:record.observedAtMs});
 }
 const transport=createG60BDriverWriteLoopbackQa({...QA,
  driverSendHandler:write.send,
  driverReconcileHandler:write.reconcile,verifyStopped,now});
 return Object.freeze({
  // Deliberately NO exposed token verifier, SQL owner proof issuer or raw DB.
  async listen(){return transport.listen();},
  async close(){return transport.close();}
 });
}
