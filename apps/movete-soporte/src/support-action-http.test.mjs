import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupportActionHandler} from './support-action-http.mjs';
const ticket='11111111-1111-4111-8111-111111111111';
const agent='22222222-2222-4222-8222-222222222222';
const session='33333333-3333-4333-8333-333333333333';
const key='44444444-4444-4444-8444-444444444444';
const intent={ticket_id:ticket,expected_status:'OPEN',
 action:'ESCALATE_SAFETY',idempotency_key:key};
const token='test-token-but-pure-handler-does-not-decode-or-trust-it';
const allowedOrigin='https://soporte.qa.movetefacil.test';
function req(body=intent,{method='POST',origin=allowedOrigin,headers={}}={}){
 const h={'origin':origin,'content-type':'application/json',
  'authorization':'Bearer '+token,...headers};
 return new Request('https://ignored-function-host.test/',{
  method,headers:h,...(method==='POST'?{body:JSON.stringify(body)}:{})
 });
}
const identity={userId:agent,sessionId:session,role:'authenticated',
 aal:'aal2',isAnonymous:false};
const receipt={request_id:'55555555-5555-4555-8555-555555555555',
 ticket_id:ticket,action:'ESCALATE_SAFETY',outcome:'QUEUED'};
function fixture({enabled=true,allowed=allowedOrigin,user=identity,
 data=receipt,throwIdentity=false,throwEnqueue=false}={}){
 const calls=[];
 const handler=createSupportActionHandler({
  enabled,allowedOrigin:allowed,
  resolveIdentity:async jwt=>{
   calls.push(['identity',jwt]);
   if(throwIdentity)throw new Error('private auth failure');
   return user;
  },
  enqueue:async(auth,request)=>{
   calls.push(['enqueue',auth,request]);
   if(throwEnqueue)throw new Error('private DB failure');
   return data;
  }
 });
 return {handler,calls};
}
test('G314 disabled gate performs zero verification and never enqueues',async()=>{
 const f=fixture({enabled:false});
 const response=await f.handler(req());
 assert.equal(response.status,503);
 assert.equal((await response.json()).code,'SUPPORT_BACKEND_DISABLED');
 assert.deepEqual(f.calls,[]);
 assert.equal(response.headers.get('access-control-allow-origin'),null);
});
test('G314 exact-origin CORS: no wildcard, reject forged origin and methods',async()=>{
 const f=fixture();
 const preflight=await f.handler(req(undefined,{method:'OPTIONS'}));
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('access-control-allow-origin'),allowedOrigin);
 assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
 const wrong=await f.handler(req(intent,{origin:'https://evil.test'}));
 assert.equal(wrong.status,403);
 assert.equal(wrong.headers.get('access-control-allow-origin'),null);
 const noOrigin=await f.handler(req(intent,{origin:''}));
 assert.equal(noOrigin.status,403);
 const get=await f.handler(req(undefined,{method:'GET'}));
 assert.equal(get.status,405);
 assert.deepEqual(f.calls,[]);
});
test('G314 rejects oversized, non-JSON, injected money/identity fields before Auth',async()=>{
 const f=fixture();
 const invalid=[
  req({...intent,actor_id:agent}),
  req({...intent,amount_pyg:10}),
  req({...intent,bank_account:'private'}),
  req({...intent,action:'APPROVE_KYC'}),
  req({...intent,ticket_id:'bad'}),
  req({...intent,session_id:session})
 ];
 for(const request of invalid)assert.equal((await f.handler(request)).status,400);
 assert.equal((await f.handler(req(intent,{headers:{'content-type':'text/plain'}}))).status,415);
 assert.equal((await f.handler(req(intent,{headers:{'content-length':'2000'}}))).status,413);
 assert.deepEqual(f.calls,[]);
});
test('G314 uses independently verified identity, cannot take actor or session from user body',async()=>{
 const f=fixture();
 const response=await f.handler(req());
 assert.equal(response.status,202);
 assert.deepEqual(await response.json(),receipt);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(f.calls[0],['identity',token]);
 assert.deepEqual(f.calls[1],['enqueue',identity,intent]);
 const body=JSON.stringify(f.calls[1][2]);
 assert.equal(body.includes('session_id'),false);
 assert.equal(body.includes('actor_id'),false);
});
test('G314 fail closed on missing token, AAL1, anonymous, owner, stale role, revoked session',async()=>{
 for(const person of [
  {...identity,aal:'aal1'},
  {...identity,role:'anon'},
  {...identity,isAnonymous:true},
  {...identity,sessionId:'not-valid'},
  {...identity,userId:'bad'},
  null
 ]){
  const f=fixture({user:person});
  const response=await f.handler(req());
  assert.equal(response.status,401);
  assert.equal(f.calls.some(x=>x[0]==='enqueue'),false);
 }
 const missing=fixture();
 assert.equal((await missing.handler(req(intent,{headers:{authorization:'Bearer bad'}}))).status,401);
 assert.deepEqual(missing.calls,[]);
 const authFailed=fixture({throwIdentity:true});
 assert.equal((await authFailed.handler(req())).status,401);
 assert.equal(authFailed.calls.some(x=>x[0]==='enqueue'),false);
});
test('G314 hides SQL errors and invalid receipts without exposing case existence',async()=>{
 const denied=fixture({throwEnqueue:true});
 const response=await denied.handler(req());
 assert.equal(response.status,403);
 assert.deepEqual(await response.json(),{ok:false,code:'ACTION_NOT_AUTHORIZED'});
 const invalid=fixture({data:{...receipt,customer_phone:'secret'}});
 const wrong=await invalid.handler(req());
 assert.equal(wrong.status,503);
 assert.equal((await wrong.text()).includes('secret'),false);
 const fake=fixture({data:{...receipt,outcome:'PAID'}});
 assert.equal((await fake.handler(req())).status,503);
});
