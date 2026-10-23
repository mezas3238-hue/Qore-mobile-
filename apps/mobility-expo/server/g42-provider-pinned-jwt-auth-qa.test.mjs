import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as signData} from 'node:crypto';
import {
 createG42PinnedJwtVerifier,createG42ProviderSessionAdapters,
 createG42PrivateGrantReader
} from './g42-provider-pinned-jwt-auth-qa.mjs';
import {createG41AdminTriageQa} from './g41-admin-triage-qa.mjs';

const at=Date.parse('2026-10-23T16:00:00Z');
const nowSec=Math.floor(at/1000);
const sub='42420000-0000-4242-8242-000000000001';
const sessionId='42420000-0000-4242-8242-000000000101';
const issuer='https://isolated-stage.supabase.co/auth/v1';
const audience='authenticated';
const p256=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const rsa=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001});
const ed=generateKeyPairSync('ed25519');
const keys=new Map([
 ['qa-es256-primary',{alg:'ES256',jwk:p256.publicKey.export({format:'jwk'})}],
 ['qa-rs256-old',{alg:'RS256',jwk:rsa.publicKey.export({format:'jwk'})}],
 ['qa-eddsa',{alg:'EdDSA',jwk:ed.publicKey.export({format:'jwk'})}]
]);
const claims={
 iss:issuer,aud:audience,role:'authenticated',sub,session_id:sessionId,
 iat:nowSec-60,exp:nowSec+600,nbf:nowSec-30,
 aal:'aal2',app_metadata:{roles:['admin']},is_anonymous:false
};
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(payload=claims,{
 alg='ES256',kid='qa-es256-primary',privateKey=p256.privateKey,
 typ='JWT'
}={}){
 const h=b64({alg,typ,kid}),p=b64(payload),buffer=Buffer.from(h+'.'+p);
 const sig=alg==='EdDSA'?
  signData(null,buffer,privateKey):
  alg==='ES256'?
  signData('sha256',buffer,{key:privateKey,dsaEncoding:'ieee-p1363'}):
  signData('RSA-SHA256',buffer,privateKey);
 return h+'.'+p+'.'+sig.toString('base64url');
}
function verifier(override={}){
 return createG42PinnedJwtVerifier({
  issuer,audience,publicKeys:keys,now:()=>at,...override
 });
}
const providerUser={id:sub,email_confirmed_at:'2026-10-20T00:00:00Z',
 is_anonymous:false};
const providerSession={userId:sub,sessionId,active:true,
 assuranceLevel:'aal2',verifiedAtMs:at-1000,expiresAtMs:at+900000};
const bearer=jwt();
function setup(overrides={}){
 let calls={user:0,session:0,grant:0};
 const base={
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  verifyJwt:verifier(),
  now:()=>at,
  readProviderUser:async id=>{calls.user++;return id===sub?providerUser:null;},
  readProviderSession:async args=>{
   calls.session++;
   return args.userId===sub&&args.sessionId===sessionId?
    providerSession:null;
  },
  readPrivateSessionGrant:async args=>{
   calls.grant++;
   return args.userId===sub&&args.sessionId===sessionId;
  },
  ...overrides
 };
 return {adapters:createG42ProviderSessionAdapters(base),calls};
}
test('G42 crypto verifies pinned ES256, RS256 and EdDSA public keys',()=>{
 for(const [key,alg,pair] of [
  ['qa-es256-primary','ES256',p256],
  ['qa-rs256-old','RS256',rsa],
  ['qa-eddsa','EdDSA',ed]
 ]){
  const actual=verifier()(jwt(claims,{
   alg,kid:key,privateKey:pair.privateKey
  }));
  assert.deepEqual(actual,{id:sub,sessionId,
   tokenIatMs:(nowSec-60)*1000,expiresAtMs:(nowSec+600)*1000});
  assert.equal(Object.isFrozen(actual),true);
 }
});
test('G42 forbids algorithm confusion, attacker kid/URL, weak signing and modified bytes',()=>{
 const alternate=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const p=jwt(),parts=p.split('.');
 for(const wrong of [
  jwt({...claims,sub:'99999999-9999-4999-8999-999999999999'}),
  jwt(claims,{alg:'ES256',privateKey:alternate.privateKey}),
  jwt(claims,{kid:'evil-provider'}),
  jwt(claims,{typ:'qore-proof'}),
  jwt(claims,{alg:'RS256',kid:'qa-es256-primary',privateKey:rsa.privateKey}),
  jwt(claims,{alg:'ES256',kid:'qa-rs256-old'}),
  parts[0]+'.'+parts[1]+'.'+parts[2].slice(0,-2)+'ZZ',
  p+'.extra',p+'=',
  b64({alg:'ES256',typ:'JWT',kid:'qa-es256-primary',
   jku:'https://attacker.example/jwks'})+'.'+parts[1]+'.'+parts[2],
  'x'.repeat(8500)
 ])assert.throws(()=>verifier()(wrong),/G42_UNVERIFIED_IDENTITY/);
 const onlyNew=new Map([['qa-es256-primary',keys.get('qa-es256-primary')]]);
 assert.throws(()=>verifier({publicKeys:onlyNew})(jwt(claims,{
  alg:'RS256',kid:'qa-rs256-old',privateKey:rsa.privateKey
 })),/G42_UNVERIFIED_IDENTITY/);
});
test('G42 refuses wrong iss/aud, guest, invalid session, expired, future and oversized JWT',()=>{
 for(const patches of [
  {iss:'https://evil.supabase.co/auth/v1'},
  {aud:'service_role'},{role:'service_role'},
  {is_anonymous:true},
  {session_id:'not-a-uuid'},
  {iat:nowSec+40},{exp:nowSec-1},{exp:nowSec+4000},
  {nbf:nowSec+60},{sub:'not-uuid'},
  {iat:nowSec-7200,exp:nowSec+10},
 ]){
  assert.throws(()=>verifier()(jwt({...claims,...patches})),
   /G42_UNVERIFIED_IDENTITY/,JSON.stringify(patches));
 }
 assert.throws(()=>createG42PinnedJwtVerifier({
  issuer:'http://localhost:3000/auth/v1',audience,publicKeys:keys
 }),/issuer\/audience/);
 const privateJwk=p256.privateKey.export({format:'jwk'});
 assert.throws(()=>verifier({publicKeys:new Map([
  ['qa-private',{alg:'ES256',jwk:privateJwk}]
 ])}),/G42_UNVERIFIED_IDENTITY/);
 const tooShort=generateKeyPairSync('rsa',{modulusLength:1024});
 assert.throws(()=>verifier({publicKeys:new Map([[
  'qa-weak',{alg:'RS256',jwk:tooShort.publicKey.export({format:'jwk'})}
 ]])}),/G42_UNVERIFIED_IDENTITY/);
});
test('G42 refuses absent/expired/revoked provider session or SQL authority',async()=>{
 for(const data of [
  {readProviderUser:async()=>null},
  {readProviderUser:async()=>({...providerUser,is_anonymous:true})},
  {readProviderUser:async()=>({id:sub,is_anonymous:false})},
  {readProviderSession:async()=>null},
  {readProviderSession:async()=>({...providerSession,active:false})},
  {readProviderSession:async()=>({...providerSession,sessionId:sub})},
  {readProviderSession:async()=>({...providerSession,expiresAtMs:at})},
  {readProviderSession:async()=>{throw Error('provider unavailable')}},
  {readPrivateSessionGrant:async()=>false},
  {readPrivateSessionGrant:async()=>{throw Error('db unavailable')}}
 ]){
  const {adapters}=setup(data);
  await assert.rejects(()=>adapters.verifyAccessToken(bearer));
 }
});
test('G42 never trusts signed MFA or Admin role; requires separate fresh provider evidence',async()=>{
 const ok=setup();
 const user=await ok.adapters.verifyAccessToken(bearer);
 assert.deepEqual(user,{id:sub,sessionId,expiresAtMs:(nowSec+600)*1000,
  is_anonymous:false,email_confirmed_at:'2026-10-20T00:00:00Z'});
 assert.equal(await ok.adapters.verifySessionNotRevoked({userId:sub,sessionId,at}),true);
 const mfa=await ok.adapters.verifyBackofficeMfa({
  token:bearer,userId:sub,sessionId,at
 });
 assert.equal(mfa.verifiedByProvider,true);
 assert.equal(mfa.assuranceLevel,'aal2');
 for(const s of [
  {...providerSession,assuranceLevel:'aal1'},
  {...providerSession,verifiedAtMs:at-43200001},
  {...providerSession,verifiedAtMs:at+1000}
 ]){
  const other=setup({readProviderSession:async()=>s});
  await assert.rejects(()=>other.adapters.verifyBackofficeMfa({
   token:bearer,userId:sub,sessionId,at
  }));
 }
 assert.equal(await ok.adapters.verifySessionNotRevoked({
  userId:sub,sessionId:'99999999-9999-4999-8999-999999999999',at
 }),false);
});
test('G42 private revocation RPC bridge returns only exact boolean',async()=>{
 const calls=[];
 const r=createG42PrivateGrantReader({rpc:async(name,args)=>{
  calls.push({name,args});return {data:true,error:null};
 }});
 assert.equal(await r({userId:sub,sessionId,tokenIatMs:at-60000}),true);
 assert.equal(await r({userId:sub,sessionId,tokenIatMs:null}),true);
 assert.equal(calls.length,2);
 assert.equal(calls[0].name,'mobility_stage_g42_session_active');
 assert.deepEqual(calls[0].args,{_user:sub,_session:sessionId,_iat_ms:at-60000});
 for(const output of [null,{data:'true'}, {error:{code:'DENIED'}},{data:null}]){
  const bad=createG42PrivateGrantReader({rpc:async()=>output});
  await assert.rejects(()=>bad({userId:sub,sessionId,tokenIatMs:at}));
 }
 const denied=createG42PrivateGrantReader({rpc:async()=>({data:false})});
 assert.equal(await denied({userId:sub,sessionId,tokenIatMs:at}),false);
 assert.throws(()=>createG42PrivateGrantReader({}),/required/);
});
test('G42 JWT + provider MFA + private grant can feed G41 QA, never LIVE',async()=>{
 const auth=setup();
 const row={incidentId:'22222222-2222-4222-8222-222222222222',
  category:'SAFETY',severity:'CRITICAL',status:'OPEN',
  createdAt:at-3000,revision:1};
 const calls=[];
 const gateway=createG41AdminTriageQa({
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  projectRef:'staging1234567890abcd',
  cursorSecrets:{current:'g42-composition-isolated-cursor-secret-32bytes-minimum'},
  now:()=>at,...auth.adapters,
  loadExclusiveBackofficeRole:async id=>id===sub?'admin':null,
  authorizePermission:async({scope})=>scope==='admin.incidents.read',
  allowRequest:()=>true,
  rpc:async(name,args)=>{calls.push({name,args});
   return {data:{revision:1,items:[row],hasMore:false}};}
 });
 const result=await gateway({bearer});
 assert.equal(result.status,200);
 assert.deepEqual(result.body.items,[row]);
 assert.equal(result.body.productionEnabled,false);
 assert.equal(calls.length,1);
 const denied=createG41AdminTriageQa({
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  projectRef:'staging1234567890abcd',
  cursorSecrets:{current:'g42-composition-isolated-cursor-secret-32bytes-minimum'},
  now:()=>at,...setup({readPrivateSessionGrant:async()=>false}).adapters,
  loadExclusiveBackofficeRole:async()=> 'admin',
  authorizePermission:async()=>true,allowRequest:()=>true,
  rpc:async()=>{throw Error('database should not be reached');}
 });
 assert.equal((await denied({bearer})).status,401);
});
test('G42 cannot instantiate server authority for production or absent independent sources',()=>{
 const base={environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  verifyJwt:verifier(),readProviderUser:async()=>{},
  readProviderSession:async()=>{},readPrivateSessionGrant:async()=>{}};
 for(const patch of [
  {environment:'production'},{liveEnabled:true},{localQaOnly:false},
  {verifyJwt:null},{readProviderUser:null},{readProviderSession:null},
  {readPrivateSessionGrant:null}
 ])assert.throws(()=>createG42ProviderSessionAdapters({...base,...patch}),/required/);
});
