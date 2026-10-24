import test from 'node:test';
import assert from 'node:assert/strict';
import {createG64PrivateDriverDecisionReconcileQa,
 G64_DRIVER_OFFER_RECOVERY_LIVE_ENABLED}
 from './g64-driver-offer-reconcile-qa.mjs';
const uuid=n=>'64641000-0000-4641-8641-'+String(n).padStart(12,'0');
const driver=uuid(1),session=uuid(2),offer=uuid(3),key=uuid(4),event=uuid(5);
const at=Date.parse('2026-10-24T16:00:00Z');
const bearer='private-verified-driver-bearer-000000000000';
const req=(kind='AUTO_RIDE')=>({method:'POST',path:kind==='AUTO_RIDE'?
 '/v1/staging/driver/offers/reconcile':
 '/v1/staging/courier/delivery-offers/reconcile',
 headers:{authorization:'Bearer '+bearer},
 body:{offerId:offer,requestKey:key,action:'accept'}});
const durable={state:'COMMITTED',offerId:offer,requestKey:key,kind:'AUTO_RIDE',
 action:'accept',outcome:'accepted',receiptId:event,serverPersisted:true,
 liveEnabled:false,pushDelivered:false,qaOnly:true,productionEnabled:false,
 retrySafe:false,reconcileAgain:false};
const unknown={state:'NOT_YET_OBSERVED',qaOnly:true,productionEnabled:false,
 retrySafe:false,reconcileAgain:true};
function fixture(overrides={}){
 const calls={sql:[],auth:[],role:[],rate:[]};
 const handler=createG64PrivateDriverDecisionReconcileQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>at,
  verifyAccessToken:async t=>{calls.auth.push(t);return {
   id:driver,sessionId:session,tokenIatMs:at-1000,
   expiresAtMs:at+60000,is_anonymous:false};},
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async id=>{calls.role.push(id);return 'driver';},
  allowRequest:ctx=>{calls.rate.push(ctx);return true;},
  readStoredDecision:async args=>{calls.sql.push(args);return durable;},
  ...overrides
 });
 return {handler,calls};
}
test('G64 reads durable original AUTO receipt by server identity, no second acceptance',async()=>{
 assert.equal(G64_DRIVER_OFFER_RECOVERY_LIVE_ENABLED,false);
 const x=fixture();
 const r=await x.handler(req());
 assert.equal(r.status,200);
 assert.equal(r.body.state,'COMMITTED');
 assert.equal(r.body.receiptId,event);
 assert.equal(r.body.retrySafe,false);
 assert.deepEqual(x.calls.sql,[{kind:'AUTO_RIDE',offerId:offer,
  actorId:driver,sessionId:session,tokenIatMs:at-1000,
  requestKey:key,action:'accept'}]);
 assert.deepEqual(x.calls.auth,[bearer]);
 assert(!JSON.stringify(r).includes(bearer));
 assert(!JSON.stringify(r).includes(driver));
});
test('G64 delivery and declined decision original receipt are strictly scoped',async()=>{
 const result={...durable,kind:'DELIVERY',action:'decline',
  outcome:'declined',receiptId:offer};
 const x=fixture({readStoredDecision:async()=>result});
 const q=req('DELIVERY');q.body.action='decline';
 const out=await x.handler(q);
 assert.equal(out.status,200);
 assert.equal(out.body.kind,'DELIVERY');
 assert.equal(out.body.receiptId,offer);
});
test('G64 unobserved, database outage and mismatching receipt never unlock retry',async()=>{
 for(const readStoredDecision of [
  async()=>unknown,
  async()=>{throw Error('DB after commit connection error')},
  async()=>({...durable,requestKey:uuid(99)}),
  async()=>({...durable,kind:'DELIVERY'}),
  async()=>({...durable,action:'decline'}),
  async()=>({...durable,receiptId:'bad'}),
  async()=>({...durable,retrySafe:true}),
  async()=>({...durable,productionEnabled:true}),
  async()=>({...durable,passengerPhone:'private'})
 ]){
  const x=fixture({readStoredDecision});
  const out=await x.handler(req());
  assert.equal(out.status,503);
  assert.equal(out.body.retrySafe,false);
  assert.equal(out.body.receiptId,undefined);
 }
});
test('G64 reject actor/session/role forged by caller and bad method',async()=>{
 const x=fixture();
 for(const bad of [
  {...req(),body:{...req().body,actorId:driver}},
  {...req(),body:{...req().body,sessionId:session}},
  {...req(),body:{...req().body,action:'refund'}},
  {...req(),body:{...req().body,requestKey:'not-uuid'}},
  {...req(),method:'GET'},
  {...req(),path:'/v1/staging/driver/offers/accept'},
  {...req(),headers:{authorization:'Bearer bad'}},
  {...req(),headers:{authorization:'Bearer '+bearer,cookie:'secret'}}
 ]){
  const out=await x.handler(bad);
  assert.notEqual(out.status,200);
 }
 assert.equal(x.calls.sql.length,0);
});
test('G64 revoked JWT, anonymous user, ambiguous role or unavailable rate fail closed',async()=>{
 for(const opts of [
  {verifyAccessToken:async()=>{throw Error('JWT unverified')}},
  {verifyAccessToken:async()=>({id:driver,sessionId:session,
   tokenIatMs:at-1000,expiresAtMs:at-1,is_anonymous:false})},
  {verifySessionNotRevoked:async()=>false},
  {verifySessionNotRevoked:async()=>{throw Error('provider down')}},
  {resolveExclusiveRole:async()=>['driver','passenger']},
  {resolveExclusiveRole:async()=> 'passenger'},
  {allowRequest:()=>false},
  {allowRequest:()=>{throw Error('unavailable')}}
 ]){
  const x=fixture(opts);
  const r=await x.handler(req());
  assert.notEqual(r.status,200);
  assert.equal(x.calls.sql.length,0);
 }
});
test('G64 cannot instantiate public/production or with missing independent callbacks',()=>{
 for(const o of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},{readStoredDecision:null}
 ]){
  assert.throws(()=>fixture(o));
 }
});
