import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createQoreRiderHistoryGateway} from './g26-rider-history-gateway.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const driver='22222222-2222-4222-8222-222222222222';
const id='33333333-3333-4333-8333-333333333333';
const at=Date.parse('2026-10-23T03:00:00Z');
const token='qa_history_test_bearer_very_long_abcdef1234567890';
const history=createQoreRiderHistoryGateway({
 projectRef:'staging1234567890abcd',
 verifyAccessToken:async()=>({id:owner,is_anonymous:false,
  email_confirmed_at:'2026-10-23T02:00:00Z'}),
 authorizePassenger:async user=>user===owner,
 allowRequest:()=>true,now:()=>at,
 loadOwnHistory:async()=>[{serviceId:id,kind:'DELIVERY',status:'completed',
  createdAt:at-3000,revision:2}]
});
const deny=async()=>({status:503,body:{error:'Unconfigured QA handler'}});
function server(){
 return createQoreRadarLoopbackTransport({
  riderHandler:deny,riderHistoryHandler:history,offerHandler:deny,
  tripCommandHandler:deny,deliveryHandler:deny,merchantHandler:deny,
  financeHandler:deny,safetyHandler:deny,merchantManagementHandler:deny,
  deliveryOfferHandler:deny
 });
}
test('G26 HTTP real 127.0.0.1: private Cliente history, no-store and forbidden query injection',async t=>{
 const instance=server(),base=await listenQoreRadarLoopback(instance);
 t.after(async()=>new Promise((resolve,reject)=>
  instance.close(e=>e?reject(e):resolve())));
 const get=async (path,extra={})=>{
  const response=await fetch(base+path,{headers:{authorization:'Bearer '+token,...extra}});
  return {status:response.status,body:await response.json(),headers:response.headers};
 };
 const ok=await get('/v1/staging/rider/history');
 assert.equal(ok.status,200);
 assert.equal(ok.body.ownerId,owner);
 assert.equal(ok.body.items[0].kind,'DELIVERY');
 assert.equal(ok.body.nextCursor,null);
 assert.equal(ok.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(ok.headers.get('access-control-allow-origin'),null);
 assert.equal((await get('/v1/staging/rider/history?ownerId='+driver)).status,404);
 assert.equal((await get('/v1/staging/rider/history',{cookie:'session=forged'})).status,403);
 assert.equal((await get('/v1/staging/rider/history',{origin:'https://evil.example'})).status,403);
 const noToken=await fetch(base+'/v1/staging/rider/history');
 assert.equal(noToken.status,401);
});
