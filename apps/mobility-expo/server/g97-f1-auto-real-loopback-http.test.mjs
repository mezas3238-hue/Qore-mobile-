/**
 * G97: real Node HTTP transport to the same G73 gateway and G93/G94/G95
 * private SQL repository interface. Bind ONLY 127.0.0.1; no remote DB, no
 * actual map/provider, no real Driver acceptance, no charge or refund.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
import {createQoreG73AutoRepository} from './g73-auto-f1-repository.mjs';

const uid='97970000-0000-4979-8979-000000000001';
const unknown='97970000-0000-4979-8979-000000000099';
const bookKey='97970000-0000-4979-8979-000000000010';
const cancelKey='97970000-0000-4979-8979-000000000011';
const quoteId='97970000-0000-4979-8979-000000000012';
const tripId='97970000-0000-4979-8979-000000000013';
const eventId='97970000-0000-4979-8979-000000000014';
const campaignId='97970000-0000-4979-8979-000000000015';
const CLOCK=1900000000000;
const subsidy={
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:uid,
 quoteId,campaignId,serviceKind:'AUTO_RIDE',currency:'PYG',
 originalFareGs:15200,commissionBps:1500,subsidyBps:1000,
 nominalCommissionGs:2280,customerSubsidyGs:1520,customerPaysGs:13680,
 driverReceivesGs:12920,platformRetainsGs:760,
 fareVersion:'PY_OWNER_AUTO_QA',expiresAt:CLOCK+120000,serverPersisted:true,
};
const settled={
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:uid,
 bookingKey,tripId,quoteId,tripState:'cancelled',tripRevision:2,
 financialState:'VOIDED_QA',customerPaysGs:13680,driverReceivesGs:12920,
 customerSubsidyGs:1520,platformRetainsGs:760,originalEntriesBalanced:true,
 reversalEntriesBalanced:true,pspCollected:false,pspRefunded:false,serverPersisted:true
};
const cancelled={
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:uid,
 bookingKey,cancellationKey:cancelKey,eventId,tripId,quoteId,
 tripState:'cancelled',tripRevision:2,financialState:'VOIDED_QA',
 reversalEntriesBalanced:true,pspCollected:false,pspRefunded:false,
 serverPersisted:true
};
const noop=async()=>({status:404,body:{error:'Not found'}});
const auth={'authorization':'Bearer '+'x'.repeat(40)};
const f1='/v1/staging/rider/auto';
async function makeServer({rpcError=false,forged=false}={}){
 const calls=[];
 const repository=createQoreG73AutoRepository({
  async rpc(name,params){
   calls.push({name,params});
   if(rpcError) return {data:null,error:{message:'secret DB URL NEVER ECHO'}};
   if(params?._passenger_id!==uid)return {data:null,error:null};
   if(name==='mobility_stage_g93_preview_auto_qa')
    return {data:forged?{...subsidy,ownerId:unknown}:subsidy,error:null};
   if(name==='mobility_stage_g94_auto_financial_state_qa')
    return {data:forged?{...settled,pspRefunded:true}:settled,error:null};
   if(name==='mobility_stage_g95_cancel_booked_auto_qa')
    return {data:forged?{...cancelled,tripId:unknown}:cancelled,error:null};
   if(name==='mobility_stage_g95_cancel_receipt_qa')
    return {data:forged?{...cancelled,commercialEnabled:true}:cancelled,error:null};
   throw Error('Non-authorized SQL RPC: '+name);
  }
 });
 const gateway=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',now:()=>CLOCK,
  verifyAccessToken:async token=>{
   if(token!=='x'.repeat(40))throw Error('Invalid provider credential');
   return {id:uid,email_confirmed_at:'2026-10-25T01:00:00Z',is_anonymous:false};
  },
  authorizePassenger:async owner=>owner===uid,
  allowRequest:()=>true,
  resolveVerifiedRoute:async()=>null,registerRoute:async()=>null,
  loadRoute:async()=>null,quoteRoute:async()=>null,loadQuote:async()=>null,
  bookQuote:async()=>null,reconcileBooking:async()=>null,
  readSubsidyPreview:p=>repository.previewAutoSubsidy(p),
  readAutoFinancialState:p=>repository.autoFinancialState(p),
  cancelBookedAuto:p=>repository.cancelBookedAuto(p),
  readCancellation:p=>repository.cancellationReceipt(p)
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  f1AutoHandler:gateway
 });
 const base=await listenQoreRadarLoopback(server);
 return {server,base,calls};
}
async function call(base,path,{method='GET',body,headers={}}={}){
 const r=await fetch(base+path,{method,
  headers:{...auth,...headers,...(body===undefined?{}:{'content-type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  redirect:'error'});
 return {status:r.status,headers:r.headers,body:await r.json()};
}
const close=server=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
test('G97 actual loopback HTTP routes G93 preview without body and finance + cancel + recovery',async t=>{
 const f=await makeServer();t.after(()=>close(f.server));
 const before=await call(f.base,f1+'/prequotes/'+quoteId+'/subsidy',{method:'POST'});
 assert.equal(before.status,200);assert.deepEqual(before.body,subsidy);
 const receipt=await call(f.base,f1+'/bookings/'+bookKey+'/cancel',{
  method:'POST',body:{requestKey:cancelKey,confirmed:true}});
 assert.equal(receipt.status,200);assert.deepEqual(receipt.body,cancelled);
 const replay=await call(f.base,f1+'/bookings/'+bookKey+'/cancellation');
 assert.equal(replay.status,200);assert.deepEqual(replay.body,receipt.body);
 const balance=await call(f.base,f1+'/bookings/'+bookKey+'/financial-status');
 assert.equal(balance.status,200);assert.deepEqual(balance.body,settled);
 assert.deepEqual(f.calls.map(x=>x.name),[
  'mobility_stage_g93_preview_auto_qa',
  'mobility_stage_g95_cancel_booked_auto_qa',
  'mobility_stage_g95_cancel_receipt_qa',
  'mobility_stage_g94_auto_financial_state_qa'
 ]);
 assert.deepEqual(f.calls[1].params,{
  _passenger_id:uid,_booking_key:bookKey,_cancellation_key:cancelKey});
 assert.equal(balance.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(balance.headers.get('content-security-policy'),"default-src 'none'");
});
test('G97 HTTP fail closed on unsigned, malformed, cross-origin and stale request',async t=>{
 const f=await makeServer();t.after(()=>close(f.server));
 const path=f1+'/bookings/'+bookKey+'/cancel';
 assert.equal((await call(f.base,path,{method:'POST',body:{
  requestKey:cancelKey,confirmed:false}})).status,400);
 assert.equal((await call(f.base,path,{method:'POST',body:{
  requestKey:cancelKey,confirmed:true,customerPaysGs:0}})).status,400);
 assert.equal((await call(f.base,path,{method:'POST',body:{
  requestKey:cancelKey,confirmed:true},headers:{authorization:'Bearer invalid'}})).status,401);
 assert.equal((await call(f.base,path,{method:'POST',body:{
  requestKey:cancelKey,confirmed:true},headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await call(f.base,f1+'/prequotes/'+quoteId+'/subsidy',{
  method:'POST',body:{priceGs:1}})).status,400);
 assert.equal((await call(f.base,f1+'/bookings/'+bookKey+'/financial-status',{
  body:{amountGs:0}})).status,400);
 assert.equal((await call(f.base,f1+'/bookings/'+bookKey+'/financial-status?x=1')).status,404);
 assert.equal((await call(f.base,f1+'/bookings/'+bookKey+'/cancellation',{
  headers:{cookie:'fake=1'}})).status,403);
 assert.equal(f.calls.length,0,'HTTP rejected payloads must not reach private SQL');
});
test('G97 SQL outages and forged monetary claims never escape to HTTP client',async t=>{
 const down=await makeServer({rpcError:true});t.after(()=>close(down.server));
 for(const [path,method,body] of [
  [f1+'/prequotes/'+quoteId+'/subsidy','POST',undefined],
  [f1+'/bookings/'+bookKey+'/cancel','POST',{requestKey:cancelKey,confirmed:true}],
  [f1+'/bookings/'+bookKey+'/cancellation','GET',undefined],
  [f1+'/bookings/'+bookKey+'/financial-status','GET',undefined]
 ]){
  const r=await call(down.base,path,{method,body});
  assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r.body),/secret|DB URL/i);
 }
 const forged=await makeServer({forged:true});t.after(()=>close(forged.server));
 for(const [path,method,body] of [
  [f1+'/prequotes/'+quoteId+'/subsidy','POST',undefined],
  [f1+'/bookings/'+bookKey+'/cancel','POST',{requestKey:cancelKey,confirmed:true}],
  [f1+'/bookings/'+bookKey+'/cancellation','GET',undefined],
  [f1+'/bookings/'+bookKey+'/financial-status','GET',undefined]
 ]){
  const r=await call(forged.base,path,{method,body});
  assert.equal(r.status,409);assert.doesNotMatch(JSON.stringify(r.body),/13680|12920/);
 }
});
test('G97 has no public listener, no new commercial endpoint and no live SQL migration',()=>{
 const file=readFileSync(new URL('./g4-staging-runtime.mjs',import.meta.url),'utf8');
 for(const binding of [
  'readSubsidyPreview:params=>f1AutoPersistence.previewAutoSubsidy(params)',
  'readAutoFinancialState:params=>f1AutoPersistence.autoFinancialState(params)',
  'cancelBookedAuto:params=>f1AutoPersistence.cancelBookedAuto(params)',
  'readCancellation:params=>f1AutoPersistence.cancellationReceipt(params)'
 ])assert.ok(file.includes(binding),binding);
 const spec=JSON.parse(readFileSync(
  new URL('../docs/backend/openapi/movete-facil-staging.openapi.json',import.meta.url)));
 for(const path of [
  '/v1/staging/rider/auto/prequotes/{quoteId}/subsidy',
  '/v1/staging/rider/auto/bookings/{bookingKey}/financial-status',
  '/v1/staging/rider/auto/bookings/{bookingKey}/cancel',
  '/v1/staging/rider/auto/bookings/{bookingKey}/cancellation'
 ]){
  const op=Object.values(spec.paths[path])[0];
  assert.equal(op['x-qore-external-staging-certified'],false);
  assert.equal(op['x-qore-runtime-wired'],false,'This is still only a loopback QA runtime');
 }
});
