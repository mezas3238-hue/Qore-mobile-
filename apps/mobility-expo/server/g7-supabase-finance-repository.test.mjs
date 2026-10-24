import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStagingFinanceRepository,SUPABASE_FINANCE_LIVE_ENABLED}
 from './g7-supabase-finance-repository.mjs';

const actor='11111111-1111-4111-8111-111111111111';
const subject='22222222-2222-4222-8222-222222222222';
const requestKey='33333333-3333-4333-8333-333333333333';
const quoteId='44444444-4444-4444-8444-444444444444';
const paymentId='55555555-5555-4555-8555-555555555555';
const eventId='66666666-6666-4666-8666-666666666666';
const base={modeGuard:'SYNTHETIC_STAGING',liveEnabled:false,actorId:actor};
function fixture(){
 const state={calls:[]};
 const quote={id:quoteId,customer_id:actor,mode:'MERCHANT_DELIVERY',
  subject_kind:'MERCHANT_ORDER',subject_id:subject,subtotal_pyg:13000,
  tolls_pyg:2000,total_pyg:15000,commission_bps:1000,
  commission_pyg:1300,provider_pyg:13700,expires_at:'2026-10-22T12:05:00Z',
  mobility_stage_fare_rules:{rule_key:'merchant-staging-v1'}};
 const payment={id:paymentId,quote_id:quoteId,customer_id:actor,
  method:'SIMULATED_CARD',amount_pyg:15000,status:'authorized',revision:1};
 const client={
  async rpc(name,params){state.calls.push({name,params});return {
   data:name==='mobility_stage_fare_quote'?quoteId:
    name==='mobility_stage_payment_authorize'?paymentId:eventId,error:null};},
  from(table){
   const filter={};
   const row=table==='mobility_stage_fare_quotes'?quote:payment;
   const chain={select(){return chain;},eq(k,v){filter[k]=v;return chain;},
    async maybeSingle(){return {data:filter.customer_id===actor&&filter.id===row.id?
     {...row}:null,error:null};}};
   return chain;
  },
 };
 return {client,state,quote,payment};
}

test('finance repository is server-only and permanently non-live',()=>{
 assert.equal(SUPABASE_FINANCE_LIVE_ENABLED,false);
 assert.throws(()=>createSupabaseStagingFinanceRepository({}),/server-only/i);
});

test('quote passes only trusted route metrics and returns immutable integer split',async()=>{
 const f=fixture(),repo=createSupabaseStagingFinanceRepository(f.client);
 const result=await repo.quote({...base,requestKey,fareMode:'MERCHANT_DELIVERY',
  subjectKind:'MERCHANT_ORDER',subjectId:subject,zoneTag:'ASUNCION_FIXTURE',
  distanceMeters:5000,durationSeconds:900,tollsPyg:2000});
 assert.equal(result.quote.totalPyg,15000);
 assert.equal(result.quote.providerPyg,13700);
 assert.deepEqual(f.state.calls[0],{name:'mobility_stage_fare_quote',params:{
  _customer_id:actor,_request_key:requestKey,_mode:'MERCHANT_DELIVERY',
  _subject_kind:'MERCHANT_ORDER',_subject_id:subject,_zone_tag:'ASUNCION_FIXTURE',
  _distance_meters:5000,_duration_seconds:900,_tolls_pyg:2000,
 }});
 f.quote.provider_pyg=1;
 await assert.rejects(repo.quote({...base,requestKey,fareMode:'MERCHANT_DELIVERY',
  subjectKind:'MERCHANT_ORDER',subjectId:subject,zoneTag:'ASUNCION_FIXTURE',
  distanceMeters:5000,durationSeconds:900,tollsPyg:2000}),/malformed/i);
 await assert.rejects(repo.quote({...base,requestKey,fareMode:'AUTO',
  subjectKind:'MERCHANT_ORDER',subjectId:subject,zoneTag:'ASUNCION_FIXTURE',
  distanceMeters:5000,durationSeconds:900,tollsPyg:2000}),/invalid/i);
});

test('authorization, transition and owner-only snapshot bind verified actor',async()=>{
 const f=fixture(),repo=createSupabaseStagingFinanceRepository(f.client);
 assert.deepEqual(await repo.authorize({...base,quoteId,method:'SIMULATED_CARD',requestKey}),
  {ok:true,liveEnabled:false,paymentId});
 assert.deepEqual(await repo.transition({...base,paymentId,event:'capture',eventKey:requestKey}),
  {ok:true,liveEnabled:false,eventId});
 const snapshot=await repo.paymentSnapshot({...base,paymentId});
 assert.equal(snapshot.payment.amountPyg,15000);
 assert.equal(f.state.calls[0].params._customer_id,actor);
 assert.equal(f.state.calls[1].params._actor_id,actor);
 await assert.rejects(repo.authorize({...base,quoteId,method:'CARD',requestKey}),/invalid/i);
});

test('repository rejects live mode, malformed totals and cross-owner data',async()=>{
 const f=fixture(),repo=createSupabaseStagingFinanceRepository(f.client);
 await assert.rejects(repo.paymentSnapshot({...base,liveEnabled:true,paymentId}),/invalid/i);
 f.payment.customer_id='99999999-9999-4999-8999-999999999999';
 await assert.rejects(repo.paymentSnapshot({...base,paymentId}),/malformed/i);
});
