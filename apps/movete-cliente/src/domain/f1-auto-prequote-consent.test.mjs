import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1AutoPrequoteConsent} from './f1-auto-prequote-consent.mjs';

const ID=n=>'f1000000-0000-4100-8100-'+String(n).padStart(12,'0');
const owner=ID(1),foreign=ID(2),routeId=ID(3),quoteId=ID(4);
const quoteKey=ID(5),bookingKey=ID(6),tripId=ID(7);
let time;
const quote=(x={})=>({
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
 routeId,quoteId,quoteRequestKey:quoteKey,fareMode:'AUTO',
 service:'economico',currency:'PYG',amountGs:19500,
 fareVersion:'auto-qa-v1',expiresAt:time+120000,
 serverPriced:true,routingVerified:true,status:'QUOTED_QA',...x
});
const receipt=(x={})=>({
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,
 requestKey:bookingKey,quoteId,routeId,tripId,revision:1,
 serverPersisted:true,status:'ACCEPTED_QA',...x
});
function setup(overrides={}){
 time=1800000000000;
 let actor={role:'passenger',subject:owner,sessionRevision:1};
 let quotes=0,posts=0,reads=0;
 const gate=createF1AutoPrequoteConsent({
  enabled:true,quoteContractCertified:true,bookingContractCertified:true,
  reconciliationContractCertified:true,stagingRuntimeVerified:true,
  now:()=>time,getActor:async()=>actor,
  quoteGateway:async()=>{quotes++;return {ok:true,status:200,data:quote()};},
  bookingGateway:async()=>{posts++;return {ok:true,status:201,data:receipt()};},
  reconciliationGateway:async()=>{reads++;return {ok:true,status:200,data:receipt()};},
  ...overrides
 });
 return {gate,quotes:()=>quotes,posts:()=>posts,reads:()=>reads,
  setActor:a=>actor=a,advance:ms=>time+=ms};
}
const scope={routeId,service:'economico',quoteRequestKey:quoteKey,ownerId:owner,sessionRevision:1};
async function reviewed(f){
 assert.equal(f.gate.prepare(scope).ok,true);
 assert.equal((await f.gate.load()).ok,true);
}
async function accepted(f){
 await reviewed(f);
 assert.equal(f.gate.accept({quoteId,amountGs:19500,fareVersion:'auto-qa-v1'}).ok,true);
}
test('disabled by default: neither quote nor booking can run without separately certified A contracts',async()=>{
 const gate=createF1AutoPrequoteConsent();
 assert.equal(gate.snapshot().quoteAvailable,false);
 assert.equal(gate.prepare(scope).code,'PREQUOTE_BACKEND_NOT_CERTIFIED');
 assert.equal((await gate.reserve({requestKey:bookingKey})).ok,false);
 assert.equal(gate.snapshot().tripId,null);
});
test('safe quote then explicit matching amount/version acceptance then one quote-bound POST',async()=>{
 const f=setup();await reviewed(f);
 assert.deepEqual(f.gate.snapshot().quote,{quoteId,amountGs:19500,currency:'PYG',
  fareVersion:'auto-qa-v1',expiresAt:time+120000});
 assert.equal(f.posts(),0);
 assert.equal((await f.gate.reserve({requestKey:bookingKey})).code,'PREQUOTE_NOT_ACCEPTED');
 assert.equal(f.gate.accept({quoteId,amountGs:19501,fareVersion:'auto-qa-v1'}).code,'PRICE_OR_QUOTE_CHANGED');
 assert.equal(f.posts(),0);
 assert.equal(f.gate.accept({quoteId,amountGs:19500,fareVersion:'auto-qa-v1'}).ok,true);
 const r=await f.gate.reserve({requestKey:bookingKey});
 assert.equal(r.ok,true);assert.equal(r.tripId,tripId);
 assert.equal(r.productionEnabled,false);assert.equal(f.posts(),1);
 assert.equal(f.gate.snapshot().phase,'confirmed');
 assert.equal((await f.gate.reserve({requestKey:ID(10)})).code,'PREQUOTE_NOT_ACCEPTED');
 assert.equal(f.posts(),1);
});
test('reject freeform unverified human address as route identifier and unscoped intent',async()=>{
 const f=setup();
 assert.equal(f.gate.prepare({...scope,routeId:'Centro, Asunción'}).code,'INVALID_PREQUOTE_SCOPE');
 assert.equal(f.gate.prepare({...scope,ownerId:foreign,sessionRevision:-1}).code,'INVALID_PREQUOTE_SCOPE');
 assert.equal(f.quotes(),0);assert.equal(f.posts(),0);
});
test('server quote must have exact fields, ownership, currency PYG, route provenance and TTL',async()=>{
 for(const patch of [{ownerId:foreign},{routeId:foreign},{quoteRequestKey:bookingKey},
  {currency:'USD'},{amountGs:1.5},{serverPriced:false},
  {routingVerified:false},{commercialEnabled:true},{status:'CONFIRMED'},
  {expiresAt:time},{expiresAt:time+7200000},{extra:'driver?'}]){
  const f=setup({quoteGateway:async()=>({ok:true,status:200,data:quote(patch)})});
  f.gate.prepare(scope);
  assert.equal((await f.gate.load()).code,'PREQUOTE_NOT_VERIFIED',JSON.stringify(patch));
  assert.equal(f.gate.snapshot().quote,null);
  assert.equal(f.gate.snapshot().canReserve,false);
 }
});
test('reject expiration between display, explicit consent and the POST',async()=>{
 const f=setup();await reviewed(f);
 f.advance(120000);
 assert.equal(f.gate.accept({quoteId,amountGs:19500,fareVersion:'auto-qa-v1'}).ok,false);
 assert.equal(f.gate.snapshot().quote,null);assert.equal(f.posts(),0);
 const g=setup();await accepted(g);
 g.advance(120000);
 assert.equal((await g.gate.reserve({requestKey:bookingKey})).code,'PREQUOTE_NOT_ACCEPTED');
 assert.equal(g.posts(),0);
});
test('quote credential changes mid-flight cannot reappear or be accepted',async()=>{
 let release;
 const pending=new Promise(r=>release=r);
 const f=setup({quoteGateway:async()=>pending});
 f.gate.prepare(scope);
 const task=f.gate.load();
 await Promise.resolve();await Promise.resolve();
 f.setActor({role:'passenger',subject:foreign,sessionRevision:2});
 release({ok:true,status:200,data:quote()});
 assert.equal((await task).code,'SESSION_CHANGED');
 assert.equal(f.gate.snapshot().quote,null);
});
test('clear during pending load invalidates its response and private quote',async()=>{
 let release;
 const pending=new Promise(r=>release=r);
 const f=setup({quoteGateway:async()=>pending});
 f.gate.prepare(scope);
 const task=f.gate.load();
 await Promise.resolve();await Promise.resolve();
 f.gate.clear();release({ok:true,status:200,data:quote()});
 assert.equal((await task).code,'STALE_RESPONSE');
 assert.equal(f.gate.snapshot().quote,null);
});
test('ambiguous POST is latched; GET reconcilies same booking without second POST',async()=>{
 let posts=0,reads=0;
 const f=setup({bookingGateway:async()=>{posts++;throw Error('lost ACK');},
  reconciliationGateway:async()=>{reads++;return {ok:true,status:200,data:receipt()};}});
 await accepted(f);
 assert.equal((await f.gate.reserve({requestKey:bookingKey})).code,'BOOKING_RECONCILIATION_REQUIRED');
 assert.equal(f.gate.snapshot().requiresReconciliation,true);
 assert.equal((await f.gate.reserve({requestKey:ID(9)})).code,'PREQUOTE_NOT_ACCEPTED');
 assert.equal(posts,1);
 assert.equal((await f.gate.reconcile()).recoveredWithoutPost,true);
 assert.equal(reads,1);assert.equal(posts,1);
 assert.equal(f.gate.snapshot().tripId,tripId);
});
test('ambiguous GET 404, foreign receipt or stale revision cannot unblock fresh POST',async()=>{
 for(const answer of [{ok:false,status:404},{ok:true,status:200,data:receipt({ownerId:foreign})},
  {ok:true,status:200,data:receipt({revision:0})}]){
  let posts=0;
  const f=setup({bookingGateway:async()=>{posts++;return {ok:false,status:503};},
   reconciliationGateway:async()=>answer});
  await accepted(f);
  await f.gate.reserve({requestKey:bookingKey});
  assert.equal((await f.gate.reconcile()).code,'BOOKING_STILL_UNCONFIRMED');
  assert.equal(f.gate.snapshot().requiresReconciliation,true);
  assert.equal(f.gate.snapshot().tripId,null);
  assert.equal((await f.gate.reserve({requestKey:ID(11)})).ok,false);
  assert.equal(posts,1);
 }
});
test('generic 201, mismatched route/quote and a claimed live receipt cannot prove booking',async()=>{
 for(const patch of [{quoteId:foreign},{routeId:foreign},{requestKey:foreign},
  {commercialEnabled:true},{tripId:undefined},{extra:'unsafe'}]){
  const f=setup({bookingGateway:async()=>({ok:true,status:201,data:receipt(patch)})});
  await accepted(f);
  assert.equal((await f.gate.reserve({requestKey:bookingKey})).code,
   'BOOKING_RECONCILIATION_REQUIRED');
  assert.equal(f.gate.snapshot().tripId,null);
 }
});
test('quote, booking and reconciliation require distinct certification independently',async()=>{
 const noBook=setup({bookingContractCertified:false});
 await accepted(noBook);
 assert.equal(noBook.gate.snapshot().bookingAvailable,false);
 assert.equal((await noBook.gate.reserve({requestKey:bookingKey})).code,
  'QUOTE_BOUND_BOOKING_NOT_CERTIFIED');
 assert.equal(noBook.posts(),0);
 const noGet=setup({reconciliationContractCertified:false,
  bookingGateway:async()=>({ok:false,status:503})});
 await accepted(noGet);await noGet.gate.reserve({requestKey:bookingKey});
 assert.equal((await noGet.gate.reconcile()).code,'RECONCILIATION_NOT_CERTIFIED');
 assert.equal(noGet.gate.snapshot().requiresReconciliation,true);
});

test('an ambiguous dispatch cannot be discarded locally to generate a new booking key',async()=>{
 let posts=0;
 const f=setup({bookingGateway:async()=>{posts++;return {ok:false,status:503};}});
 await accepted(f);
 assert.equal((await f.gate.reserve({requestKey:bookingKey})).code,
  'BOOKING_RECONCILIATION_REQUIRED');
 assert.equal(f.gate.discard().code,'BOOKING_RECONCILIATION_REQUIRED');
 assert.equal(f.gate.prepare({...scope,quoteRequestKey:ID(13)}).code,
  'PREQUOTE_ALREADY_ACTIVE');
 assert.equal(posts,1);
});
