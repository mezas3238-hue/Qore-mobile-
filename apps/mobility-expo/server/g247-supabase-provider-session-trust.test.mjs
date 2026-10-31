import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG247ProviderSessionTrust} from './g247-supabase-provider-session-trust.mjs';

const REF='mrjzxftsdxzepzbcuids';
const USER='24700000-0000-4247-8247-000000000001';
const SESSION='24700000-0000-4247-8247-000000000002';
const NOW=1793448000000;
const jwt=(changes={})=>{
 const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const p=Buffer.from(JSON.stringify({
  iss:'https://'+REF+'.supabase.co/auth/v1',
  role:'authenticated',aud:'authenticated',sub:USER,session_id:SESSION,
  iat:Math.floor(NOW/1000)-60,exp:Math.floor(NOW/1000)+3600,
  ...changes
 })).toString('base64url');
 // Deliberately NOT a cryptographic signature. A mocked independent provider
 // authorizes only the test token; no test JWT is valid in real Supabase.
 return h+'.'+p+'.'+'A'.repeat(48);
};
const confirmed={id:USER,is_anonymous:false,email_confirmed_at:'2026-10-30T00:00:00Z'};
function providers({allow=true,provider=confirmed,providerError=false,sqlError=false}={}){
 let read=0,authCalls=0;
 const db={rpc:async(name,params)=>{
  read++;
  assert.equal(name,'mobility_stage_g42_session_active');
  assert.equal(params._user,USER);
  assert.equal(params._session,SESSION);
  return {data:allow,error:sqlError?new Error('DB unavailable'):null};
 }};
 const auth={getUser:async()=>{
  authCalls++;
  return {data:{user:provider},error:providerError?new Error('not verified'):null};
 }};
 const create=()=>createQoreG247ProviderSessionTrust({
  projectRef:REF,auth,db,now:()=>NOW,allowedByOwner:true,liveEnabled:false
 });
 return {create,calls:()=>({read,authCalls}),db,auth};
}
test('G247 refuses unapproved runtime, LIVE or untrusted database adapter',()=>{
 const p=providers();
 for(const o of [{allowedByOwner:false},{liveEnabled:true},
  {projectRef:'evil'},{db:{}},{auth:{}}]){
  assert.throws(()=>createQoreG247ProviderSessionTrust({
   projectRef:REF,auth:p.auth,db:p.db,now:()=>NOW,allowedByOwner:true,liveEnabled:false,...o
  }));
 }
});
test('G247 verified external provider, JWT cross-match and real-session RPC',async()=>{
 const p=providers();
 const v=await p.create().verifyParticipantSession(jwt());
 assert.deepEqual(v,{
  id:USER,sessionId:SESSION,tokenIatMs:NOW-60000,
  expiresAtMs:NOW+3600000,is_anonymous:false
 });
 assert.deepEqual(p.calls(),{read:1,authCalls:1});
 assert.equal(await p.create().verifySessionNotRevoked({
  userId:USER,sessionId:SESSION,tokenIatMs:NOW-60000
 }),true);
 assert.deepEqual(p.calls(),{read:2,authCalls:1});
});
test('G247 malformed unsigned/wrong-issuer JWT rejected BEFORE any provider/SQL reads',async()=>{
 const p=providers();
 for(const token of [
  '', 'garbage',jwt().replace(/\.A+$/,'.'),
  jwt({iss:'https://attacker.example.org/auth/v1'}),
  jwt({sub:'24700000-0000-4247-8247-000000000003'}),
  jwt({role:'service_role'}),jwt({aud:'anon'}),
  jwt({exp:Math.floor(NOW/1000)-1}),
  jwt({session_id:'broken'}),
  jwt({iat:Math.floor(NOW/1000)+3600})
 ]){
  await assert.rejects(()=>p.create().verifyParticipantSession(token),/G247 provider session not verified/);
 }
 assert.deepEqual(p.calls(),{read:0,authCalls:0});
});
test('G247 even syntactically acceptable JWT cannot bypass getUser or revoked SQL session',async()=>{
 for(const opts of [
  {allow:false},{sqlError:true},{providerError:true},
  {provider:{...confirmed,id:'24700000-0000-4247-8247-000000000003'}},
  {provider:{...confirmed,is_anonymous:true}},
  {provider:{id:USER,is_anonymous:false}}
 ]){
  const p=providers(opts);
  await assert.rejects(()=>p.create().verifyParticipantSession(jwt()),
   /G247 provider session not verified/);
 }
});
test('G247 session revocation preflight fails closed and never reports success on missing actor fields',async()=>{
 const p=providers({allow:false});
 const g=p.create();
 assert.equal(await g.verifySessionNotRevoked({userId:USER,sessionId:SESSION,tokenIatMs:NOW-60000}),false);
 assert.equal(await g.verifySessionNotRevoked({userId:USER,sessionId:SESSION}),false);
 assert.equal(await g.verifySessionNotRevoked({userId:'attacker',sessionId:SESSION,tokenIatMs:NOW}),false);
 assert.equal(await g.verifySessionNotRevoked(),false);
 assert.deepEqual(p.calls(),{read:1,authCalls:0});
});
