import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupportClaimHandler} from './support-claim-http.mjs';
const allowed='https://soporte.qa.movetefacil.test';
const id='11111111-1111-4111-8111-111111111111';
const uuid='22222222-2222-4222-8222-222222222222';
const ticket='33333333-3333-4333-8333-333333333333';
const reqBody={ticket_id:ticket,idempotency_key:uuid};
const receipt={claim_id:'44444444-4444-4444-8444-444444444444',ticket_id:ticket,outcome:'CLAIMED'};
const bearer='fixture-token-that-is-validated-by-a-fake-resolver-only';
function req(body=reqBody,{method='POST',origin=allowed,headers={}}={}){
 return new Request('https://ignored.test/claim',{method,
  headers:{origin,authorization:'Bearer '+bearer,
   'content-type':'application/json',...headers},
  ...(method==='POST'?{body:JSON.stringify(body)}:{})
 });
}
const verified={userId:id,sessionId:uuid,aal:'aal2',role:'authenticated',isAnonymous:false};
function fixture({enabled=true,identity=verified,data=receipt,error=false,origin=allowed}={}){
 const calls=[];
 const handler=createSupportClaimHandler({enabled,allowedOrigin:origin,
  resolveIdentity:async token=>{calls.push(['verify',token]);return identity;},
  claim:async(actor,payload)=>{
   calls.push(['claim',actor,payload]);
   if(error)throw Error('SQL denied');
   return data;
  }
 });
 return {handler,calls};
}
test('G320 off by default and no network/auth on disabled gate',async()=>{
 const f=fixture({enabled:false});
 const res=await f.handler(req());
 assert.equal(res.status,503);
 assert.deepEqual(f.calls,[]);
 assert.equal(res.headers.get('access-control-allow-origin'),null);
});
test('G320 cross-origin and method rejected before auth',async()=>{
 const f=fixture();
 assert.equal((await f.handler(req(reqBody,{origin:'https://evil.test'}))).status,403);
 assert.equal((await f.handler(req(reqBody,{origin:''}))).status,403);
 assert.equal((await f.handler(req(undefined,{method:'GET'}))).status,405);
 const pre=await f.handler(req(undefined,{method:'OPTIONS'}));
 assert.equal(pre.status,204);
 assert.equal(pre.headers.get('access-control-allow-origin'),allowed);
 assert.deepEqual(f.calls,[]);
});
test('G320 rejects any actor/session or forbidden body field before identity lookup',async()=>{
 const f=fixture();
 for(const key of ['actor_id','session_id','customer_phone','amount','status','owner_id','assigned_support_id']){
  const res=await f.handler(req({...reqBody,[key]:'forbidden'}));
  assert.equal(res.status,400);
 }
 assert.equal((await f.handler(req({...reqBody,idempotency_key:'bad'}))).status,400);
 assert.equal((await f.handler(req(reqBody,{headers:{'content-type':'text/html'}}))).status,415);
 assert.equal((await f.handler(req(reqBody,{headers:{'content-length':'900'}}))).status,413);
 assert.deepEqual(f.calls,[]);
});
test('G320 AAL2 is mandatory, and claims only carry verified server actor',async()=>{
 for(const identity of [null,{...verified,aal:'aal1'},
  {...verified,role:'owner'},{...verified,sessionId:'bad'},
  {...verified,isAnonymous:true},{...verified,userId:'bad'}]){
  const f=fixture({identity});
  assert.equal((await f.handler(req())).status,401);
  assert.equal(f.calls.filter(x=>x[0]==='claim').length,0);
 }
 const good=fixture();
 const response=await good.handler(req());
 assert.equal(response.status,202);
 assert.deepEqual(await response.json(),receipt);
 assert.deepEqual(good.calls[1],['claim',verified,reqBody]);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('access-control-allow-credentials'),null);
});
test('G320 refuses untrusted receipts, leaks no SQL error',async()=>{
 const f=fixture({error:true});
 const response=await f.handler(req());
 assert.equal(response.status,403);
 const body=await response.text();
 assert(!body.includes('SQL denied'));
 const bad=fixture({data:{...receipt,agent_id:id}});
 assert.equal((await bad.handler(req())).status,503);
 const paid=fixture({data:{...receipt,outcome:'PAID'}});
 assert.equal((await paid.handler(req())).status,503);
 const noAuth=fixture();
 assert.equal((await noAuth.handler(req(reqBody,{headers:{authorization:'Bearer no'}}))).status,401);
 assert.deepEqual(noAuth.calls,[]);
});
