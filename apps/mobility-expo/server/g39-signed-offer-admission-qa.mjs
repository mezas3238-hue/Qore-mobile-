/**
 * G39 / A20 — Ed25519 proof verification boundary for REAL future dispatch.
 * Isolated QA only. No issuer keys, no access tokens or HTTP listener here.
 * A signed envelope is NOT legal, GPS or KYC authority and cannot dispatch.
 */
import {createPublicKey, createHash, verify as verifySignature} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KID=/^[A-Za-z0-9_-]{4,64}$/;
const SERVICES=new Set(['AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY']);
const CLAIMS=['version','issuer','audience','purpose','jti','offerId','jobId',
 'jobKind','driverId','vehicleId','zoneId','serviceKind','consentRevision',
 'geometryRevision','policyRevision','sessionId','issuedAtMs','expiresAtMs'];
const BINDING=['offerId','jobId','jobKind','driverId','vehicleId','zoneId',
 'serviceKind','consentRevision','geometryRevision','policyRevision','sessionId'];
const base64=/^[A-Za-z0-9_-]+$/;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&
 keys.every(k=>Object.hasOwn(o,k));
const validUuid=v=>typeof v==='string'&&UUID.test(v);
function decoded(segment,max){
 if(typeof segment!=='string'||segment.length===0||
   segment.length>max||!base64.test(segment))return null;
 try{
  const b=Buffer.from(segment,'base64url');
  if(b.length===0||b.toString('base64url')!==segment)return null;
  const str=new TextDecoder('utf-8',{fatal:true}).decode(b);
  const value=JSON.parse(str);
  // Prevent duplicate-JSON-key ambiguity, whitespace and parser differentials.
  if(JSON.stringify(value)!==str)return null;
  return value;
 }catch{return null;}
}
const failed=()=>{throw Error('G39_SIGNED_PROOF_REJECTED');};
function validClaims(c,issuer,audience,now){
 if(!exact(c,CLAIMS)||c.version!==1||c.issuer!==issuer||
  c.audience!==audience||c.purpose!=='DRIVER_OFFER_ELIGIBILITY'||
  ![c.jti,c.offerId,c.jobId,c.driverId,c.vehicleId,c.zoneId].every(validUuid)||
  !['AUTO_RIDE','DELIVERY'].includes(c.jobKind)||
  !SERVICES.has(c.serviceKind)||
  (c.jobKind==='AUTO_RIDE'&&c.serviceKind!=='AUTO_RIDE')||
  (c.jobKind==='DELIVERY'&&c.serviceKind==='AUTO_RIDE')||
  typeof c.sessionId!=='string'||!KID.test(c.sessionId)||
  ![c.consentRevision,c.geometryRevision,c.policyRevision].every(
   n=>Number.isSafeInteger(n)&&n>0)||
  !Number.isSafeInteger(c.issuedAtMs)||
  !Number.isSafeInteger(c.expiresAtMs)||
  c.issuedAtMs>now+2000||
  c.expiresAtMs<=now||
  c.issuedAtMs<now-30000||
  c.expiresAtMs-c.issuedAtMs>30000||
  c.expiresAtMs-c.issuedAtMs<=0)return false;
 return true;
}
/**
 * keyring is Map(kid => Ed25519 SPKI PUBLIC KEY PEM), from server secret/
 * trust management. No network or dynamic fetching by token-provided kid.
 * expected MUST be read independently from trusted server sources, not
 * interpreted from bearer, signed content, query strings or client payload.
 * Returns only a safe audit receipt; never returns an authorization token.
 */
export function verifyG39SignedOfferProof({
 compact,keyring,issuer,audience,expected,nowMs
}={}){
 if(typeof compact!=='string'||compact.length>6000||compact.length<100||
  !Number.isSafeInteger(nowMs)||nowMs<0||
  !plain(expected)||!(keyring instanceof Map)||keyring.size===0||
  typeof issuer!=='string'||issuer.length<8||issuer.length>128||
  typeof audience!=='string'||audience.length<8||audience.length>128)
  failed();
 const segments=compact.split('.');
 if(segments.length!==3||segments[2].length>256||
   !base64.test(segments[2]))failed();
 const [h,p,s]=segments;
 const header=decoded(h,400);
 const claims=decoded(p,3500);
 if(!exact(header,['alg','typ','kid'])||header.alg!=='EdDSA'||
  header.typ!=='qore-offer-proof+jwt'||!KID.test(header.kid)||
  !validClaims(claims,issuer,audience,nowMs))failed();
 if(!BINDING.every(k=>Object.hasOwn(expected,k)&&
    expected[k]===claims[k]))failed();
 if(!exact(expected,BINDING))failed();
 const rawSig=Buffer.from(s,'base64url');
 if(rawSig.length!==64||rawSig.toString('base64url')!==s)failed();
 const pem=keyring.get(header.kid);
 if(typeof pem!=='string'||!pem.startsWith('-----BEGIN PUBLIC KEY-----')||
  pem.length>2000)failed();
 let key;
 try{key=createPublicKey(pem);}catch{failed();}
 if(key.asymmetricKeyType!=='ed25519')failed();
 if(!verifySignature(null,Buffer.from(h+'.'+p,'utf8'),key,rawSig))
  failed();
 return Object.freeze({
  type:'G39_QA_SIGNATURE_CHECK_ONLY',
  keyId:header.kid,
  evidenceSha256:createHash('sha256').update(compact).digest('hex'),
  dispatchAuthorized:false,productionEnabled:false
 });
}
const response=(status,code)=>Object.freeze({
 status,body:Object.freeze({code,dispatchAuthorized:false,productionEnabled:false})
});
/**
 * A trusted JWT provider and DB authority are injected. Deliberately does
 * not persist G38 proof rows: no certified issuer/geofence/HTTPS is available.
 * This is a cryptographic integration seam, never a dispatch endpoint.
 */
export function createG39OfferAdmissionQa({
 environment,liveEnabled,localQaOnly,keyring,issuer,audience,
 verifyAccessToken,readAuthoritativeBinding,verifySessionNotRevoked,
 allowRequest,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
  localQaOnly!==true||!(keyring instanceof Map)||keyring.size===0||
  ![verifyAccessToken,readAuthoritativeBinding,verifySessionNotRevoked,
    allowRequest,now].every(f=>typeof f==='function'))
  throw Error('G39 no unsafe runtime without all independent authorities');
 return async({bearer,compact,offerId}={})=>{
  if(typeof bearer!=='string'||bearer.length<20||bearer.length>7900||
   !/^[A-Za-z0-9._~-]+$/.test(bearer))return response(401,'JWT_REQUIRED');
  if(!validUuid(offerId))return response(400,'OFFER_ID_REQUIRED');
  const t=now();
  if(!Number.isSafeInteger(t)||t<0)return response(503,'CLOCK_UNAVAILABLE');
  let identity;
  try{identity=await verifyAccessToken(bearer);}
  catch{return response(401,'SESSION_UNVERIFIED');}
  if(!plain(identity)||!validUuid(identity.id)||
   !KID.test(identity.sessionId)||identity.is_anonymous===true||
   !Number.isSafeInteger(identity.expiresAtMs)||identity.expiresAtMs<=t)
   return response(401,'SESSION_UNVERIFIED');
  let isCurrent;
  try{isCurrent=await verifySessionNotRevoked({
   driverId:identity.id,sessionId:identity.sessionId,at:t
  });}catch{return response(503,'REVOCATION_UNAVAILABLE');}
  if(isCurrent!==true)return response(401,'SESSION_REVOKED');
  try{
   if(allowRequest({driverId:identity.id,operation:'qa.offer.proof'})!==true)
    return response(429,'PROOF_RATE_LIMIT');
  }catch{return response(503,'RATE_LIMIT_UNAVAILABLE');}
  let expected;
  try{expected=await readAuthoritativeBinding({
   offerId,driverId:identity.id,sessionId:identity.sessionId,at:t
  });}catch{return response(503,'OFFER_AUTHORITY_UNAVAILABLE');}
  if(!exact(expected,BINDING)||expected.offerId!==offerId||
   expected.driverId!==identity.id||
   expected.sessionId!==identity.sessionId)
   return response(403,'OFFER_CONTEXT_DENIED');
  try{verifyG39SignedOfferProof({
    compact,keyring,issuer,audience,expected,nowMs:t
   });}catch{return response(403,'ATTESTATION_UNVERIFIED');}
  // Even VALID cryptographic signatures do not prove legal coverage,
  // geographic integrity, real KYC or commercial deployment readiness.
  return response(423,'G39_QA_DISPATCH_LOCKED');
 };
}
