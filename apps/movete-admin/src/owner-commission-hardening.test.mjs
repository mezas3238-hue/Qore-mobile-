import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerCommissionGateway} from './owner-commission-gateway.mjs';

const id='d0000000-0000-4000-8000-000000000001';
const token='owner-aal2-qa-token-abcdefghijklmnop';
const host='https://commission-admin-qa.invalid';
const policy=(service,commissionBps)=>({
 serviceKind:service,commissionBps,subsidyBps:1000,version:2,
 mode:'STAGING_DEMO_ONLY',productionEnabled:false
});
const ok=(value,headers={})=>({
 status:200,ok:true,redirected:false,
 headers:{get:name=>name==='content-type'?'application/json':
  headers[name]??null},
 text:async()=>JSON.stringify(value)
});
function create({fetchImpl,timeoutMs=1000}={}){
 let session={subject:id,role:'owner',mfaVerified:true,token,
  expiresAt:Date.now()+600000};
 const gateway=createOwnerCommissionGateway({
  enabled:true,contractCertified:true,origin:host,pinnedOrigin:host,
  now:()=>Date.now(),timeoutMs,getSession:async()=>session,
  fetchImpl:fetchImpl??(async url=>ok(policy(url.endsWith('MOTO_RIDE')
   ?'MOTO_RIDE':'AUTO_RIDE',url.endsWith('MOTO_RIDE')?1200:1500)))
 });
 return {gateway,changeSession:fn=>{session=fn(session);}};
}
test('D Owner consults AUTO and MOTO separately, retaining fixed 10% subsidy',async()=>{
 const {gateway}=create();
 const auto=await gateway.read('AUTO_RIDE'),moto=await gateway.read('MOTO_RIDE');
 assert.equal(auto.ok,true);assert.equal(auto.data.commissionBps,1500);
 assert.equal(moto.ok,true);assert.equal(moto.data.commissionBps,1200);
 assert.equal(auto.data.subsidyBps,1000);assert.equal(moto.data.subsidyBps,1000);
});
test('D role downgrade while network is pending discards Owner financial result',async()=>{
 let change;
 const f=create({fetchImpl:async()=>{change();return ok(policy('AUTO_RIDE',1500));}});
 change=()=>f.changeSession(s=>({...s,role:'admin'}));
 assert.equal((await f.gateway.read('AUTO_RIDE')).code,'STALE_OWNER_SESSION');
});
test('D MFA withdrawal while response is pending rejects session',async()=>{
 let change;
 const f=create({fetchImpl:async()=>{change();return ok(policy('AUTO_RIDE',1500));}});
 change=()=>f.changeSession(s=>({...s,mfaVerified:false}));
 assert.equal((await f.gateway.read('AUTO_RIDE')).code,'STALE_OWNER_SESSION');
});
test('D denies wrong service receipt, and body cannot change client subsidy',async()=>{
 const f=create({fetchImpl:async()=>ok(policy('MOTO_RIDE',1200))});
 assert.equal((await f.gateway.read('AUTO_RIDE')).code,'INVALID_POLICY_RECEIPT');
 const g=create();
 assert.equal((await g.gateway.change('AUTO_RIDE',{
  requestKey:id,commissionBps:1500,subsidyBps:0})).ok,false);
});
test('D rejects oversized content length before parsing a policy',async()=>{
 let textCalls=0;
 const f=create({fetchImpl:async()=>({
  ...ok(policy('AUTO_RIDE',1500),{'content-length':'100000'}),
  text:async()=>{textCalls++;return '';}
 })});
 assert.equal((await f.gateway.read('AUTO_RIDE')).code,'RESPONSE_TOO_LARGE');
 assert.equal(textCalls,0);
});
test('D rejects oversized actual body even if length header is absent',async()=>{
 const f=create({fetchImpl:async()=>({
  ...ok(policy('AUTO_RIDE',1500)),
  text:async()=>JSON.stringify(policy('AUTO_RIDE',1500))+' '.repeat(5000)
 })});
 assert.equal((await f.gateway.read('AUTO_RIDE')).code,'RESPONSE_TOO_LARGE');
});
test('D concurrent Owner requests do not duplicate financial writes',async()=>{
 let resolve;let calls=0;
 const f=create({fetchImpl:async()=>{calls++;return await new Promise(r=>{resolve=r;});}});
 const pending=f.gateway.read('AUTO_RIDE');
 const denied=await f.gateway.change('AUTO_RIDE',{requestKey:id,commissionBps:1600});
 assert.equal(denied.code,'OWNER_COMMISSION_IN_FLIGHT');
 // First read may still be collecting session when the second call happens.
 await new Promise(r=>setImmediate(r));
 assert.equal(calls,1);
 resolve(ok(policy('AUTO_RIDE',1500)));
 assert.equal((await pending).ok,true);
});
test('D aborts stuck HTTPS Owner policy reads and remains NO_GO',async()=>{
 const f=create({fetchImpl:async(_url,request)=>new Promise((_resolve,reject)=>{
  request.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
 })});
 assert.equal((await f.gateway.read('AUTO_RIDE')).code,'NETWORK_OR_TIMEOUT');
});