import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyG39SignedOfferProof,createG39OfferAdmissionQa}
 from './g39-signed-offer-admission-qa.mjs';

const time=Date.parse('2026-10-23T15:00:00Z');
const issuer='qore-stage-authority';
const audience='qore-mobile-driver';
const driverId='11111111-1111-4111-8111-111111111111';
const offerId='22222222-2222-4222-8222-222222222222';
const jobId='33333333-3333-4333-8333-333333333333';
const vehicleId='44444444-4444-4444-8444-444444444444';
const zoneId='55555555-5555-4555-8555-555555555555';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const {privateKey:otherPrivate,publicKey:otherPublic}=generateKeyPairSync('ed25519');
const keys=new Map([
 ['qa-kid-001',publicKey.export({type:'spki',format:'pem'})],
 ['qa-kid-previous',otherPublic.export({type:'spki',format:'pem'})]
]);
const claims=Object.freeze({
 version:1,issuer,audience,purpose:'DRIVER_OFFER_ELIGIBILITY',
 jti:'66666666-6666-4666-8666-666666666666',
 offerId,jobId,jobKind:'AUTO_RIDE',driverId,vehicleId,zoneId,
 serviceKind:'AUTO_RIDE',consentRevision:3,geometryRevision:8,
 policyRevision:11,sessionId:'session-verified-001',
 issuedAtMs:time-5000,expiresAtMs:time+10000
});
const expected=Object.freeze(Object.fromEntries([
 'offerId','jobId','jobKind','driverId','vehicleId','zoneId','serviceKind',
 'consentRevision','geometryRevision','policyRevision','sessionId'
].map(k=>[k,claims[k]])));
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function token(payload=claims,{kid='qa-kid-001',key=privateKey,alg='EdDSA',
 typ='qore-offer-proof+jwt'}={}){
 const h=enc({alg,typ,kid}),p=enc(payload);
 return h+'.'+p+'.'+sign(null,Buffer.from(h+'.'+p),key).toString('base64url');
}
const check=(compact=token(),override={})=>verifyG39SignedOfferProof({
 compact,keyring:keys,issuer,audience,expected,nowMs:time,...override
});
test('G39 verifies Ed25519 SHA audit only, never authorizes dispatch',()=>{
 const o=check();
 assert.equal(o.type,'G39_QA_SIGNATURE_CHECK_ONLY');
 assert.equal(o.keyId,'qa-kid-001');
 assert.match(o.evidenceSha256,/^[0-9a-f]{64}$/);
 assert.equal(o.dispatchAuthorized,false);
 assert.equal(o.productionEnabled,false);
 assert.equal(Object.isFrozen(o),true);
});
test('G39 accepts trusted previous public key during explicit rotation',()=>{
 const o=check(token(claims,{kid:'qa-kid-previous',key:otherPrivate}));
 assert.equal(o.keyId,'qa-kid-previous');
 const expired=new Map([['qa-kid-001',keys.get('qa-kid-001')]]);
 assert.throws(()=>check(token(claims,{
  kid:'qa-kid-previous',key:otherPrivate
 }),{keyring:expired}),/G39_SIGNED_PROOF_REJECTED/);
});
test('G39 blocks tampering, wrong key, wrong algorithm and invalid canonical JWS',()=>{
 const valid=token();
 const [h,p,s]=valid.split('.');
 for(const invalid of [
  h+'.'+p+'.'+(s[0]==='A'?'B':'A')+s.slice(1),
  token(claims,{key:otherPrivate}),
  token(claims,{alg:'HS256'}),
  token(claims,{alg:'none'}),
  token(claims,{typ:'JWT'}),
  token(claims,{kid:'unknown-public-key'}),
  h+'.'+p+'.'+s+'=',
  valid+'.trailing',
  'x'.repeat(6001),
  h+'.'+Buffer.from('{"version":1,"version":1}').toString('base64url')+'.'+s,
  Buffer.from(' { "alg":"EdDSA","typ":"qore-offer-proof+jwt","kid":"qa-kid-001" }').toString('base64url')+'.'+p+'.'+s,
 ]){
  assert.throws(()=>check(invalid),/G39_SIGNED_PROOF_REJECTED/);
 }
});
test('G39 rejects all stale, replayable, cross-service and impersonated claims',()=>{
 for(const changes of [
  {offerId:'77777777-7777-4777-8777-777777777777'},
  {jobId:'77777777-7777-4777-8777-777777777777'},
  {driverId:'77777777-7777-4777-8777-777777777777'},
  {vehicleId:'77777777-7777-4777-8777-777777777777'},
  {zoneId:'77777777-7777-4777-8777-777777777777'},
  {jobKind:'DELIVERY'},{serviceKind:'MOTO_DELIVERY'},
  {consentRevision:4},{geometryRevision:9},{policyRevision:12},
  {sessionId:'session-elsewhere'},
  {purpose:'ADMIN_OWNER'},{issuer:'evil-backend'},
  {audience:'public-client'},
  {issuedAtMs:time-40000},{issuedAtMs:time+4000},
  {expiresAtMs:time},{expiresAtMs:time+60000},
  {version:2},{extra:'unauthorized'},
 ]){
  assert.throws(()=>check(token({...claims,...changes})),
   /G39_SIGNED_PROOF_REJECTED/,JSON.stringify(changes));
 }
});
const bearer='validatedJWTtokenWithAdequateLength123';
const snapshot=()=>({...expected});
function gateway(overrides={}){
 return createG39OfferAdmissionQa({
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  keyring:keys,issuer,audience,now:()=>time,
  verifyAccessToken:async()=>({
   id:driverId,sessionId:claims.sessionId,expiresAtMs:time+60000,
   is_anonymous:false
  }),
  readAuthoritativeBinding:async()=>snapshot(),
  verifySessionNotRevoked:async()=>true,
  allowRequest:()=>true,...overrides
 });
}
test('G39 valid signed evidence, current session and independent binding ALWAYS locked',async()=>{
 const res=await gateway()({bearer,compact:token(),offerId});
 assert.deepEqual(res,{status:423,body:{
  code:'G39_QA_DISPATCH_LOCKED',dispatchAuthorized:false,
  productionEnabled:false
 }});
 assert.doesNotMatch(JSON.stringify(res),/vehicleId|service_role|latitude|token/);
});
test('G39 revoked JWT/session, wrong actor, missing independent source fail closed',async()=>{
 for(const [overrides,status] of [
  [{verifyAccessToken:async()=>{throw Error('expired');}},401],
  [{verifyAccessToken:async()=>({...{
   id:driverId,sessionId:claims.sessionId,expiresAtMs:time
  }})},401],
  [{verifyAccessToken:async()=>({
   id:'77777777-7777-4777-8777-777777777777',
   sessionId:claims.sessionId,expiresAtMs:time+10000
  })},403],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('db down');}},503],
  [{readAuthoritativeBinding:async()=>{throw Error('db down');}},503],
  [{readAuthoritativeBinding:async()=>({...expected,zoneId:
   '77777777-7777-4777-8777-777777777777'})},403],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('rate down')}},503]
 ]){
  const a=await gateway(overrides)({bearer,compact:token(),offerId});
  assert.equal(a.status,status,JSON.stringify(overrides));
  assert.equal(a.body.dispatchAuthorized,false);
 }
 assert.equal((await gateway()({bearer:'bad',compact:token(),offerId})).status,401);
 assert.equal((await gateway()({bearer,compact:token(),offerId:'fake'})).status,400);
 assert.equal((await gateway()({bearer,compact:token({...claims,zoneId:
  '77777777-7777-4777-8777-777777777777'}),offerId})).status,403);
});
test('G39 cannot be accidentally created as LIVE gateway or without authorities',()=>{
 for(const override of [
  {liveEnabled:true},{localQaOnly:false},{environment:'production'},
  {keyring:new Map()},{verifyAccessToken:undefined},
  {readAuthoritativeBinding:undefined},
  {verifySessionNotRevoked:undefined},{allowRequest:undefined}
 ]){
  assert.throws(()=>gateway(override),/unsafe runtime/);
 }
});
