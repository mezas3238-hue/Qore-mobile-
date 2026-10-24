import test from 'node:test';
import assert from 'node:assert/strict';
import {pollQoreRadar,type RadarRequest} from './qore-radar-polling.ts';
import {initialRiderRadar} from './qore-radar-feed.ts';

const trip='11111111-1111-4111-8111-111111111111';
const passenger='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
const token='synthetic_qa_access_token_never_live';
const origin='https://staging-api.example.test';
const state=initialRiderRadar(trip,passenger);
const base={source:'server',tripId:trip,passengerId:passenger,
 serverRevision:1,trackingSequence:0,status:'searching'};
const driver={name:'Conductor QA',vehicleKind:'AUTO',model:'Toyota Vitz',
 color:'gris',plate:'TEST777',rating:4.7};
const accepted={...base,status:'accepted',serverRevision:2,trackingSequence:1,
 acceptedDriver:driver,tracking:{
  lat:-25.3,lng:-57.6,roadMeters:2300,etaSeconds:480,
  locationUpdatedAtMs:10_000,routeUpdatedAtMs:10_000,
  trafficAware:true,fallbackUsed:false
 }};
const wrap=(event:unknown,opts:Record<string,unknown>={})=>({
 mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,event,...opts
});
function remote(result:unknown,code=200){
 let calls=0,init:unknown,url='';
 const request:RadarRequest=async(u,o)=>{
  calls++;url=u;init=o;return {status:code,json:async()=>result};
 };
 return {request,details:()=>({calls,url,init})};
}
const poll=(args:Record<string,unknown>={})=>
 pollQoreRadar({
  state,apiOrigin:origin,pinnedApiOrigin:origin,accessToken:token,now:()=>15_000,
  ...args
 });
test('network bridge calls only stage HTTP endpoint with JWT and no cached credentials',async()=>{
 const fake=remote(wrap(base));
 const r=await poll({request:fake.request});
 assert.equal(r.connection,'connected');
 assert.equal(r.view.status,'searching');
 assert.equal(r.view.driver,null);
 assert.equal(r.view.etaMinutes,null);
 assert.equal(r.commercialRidesEnabled,false);
 const {calls,url,init}=fake.details();
 assert.equal(calls,1);
 assert.equal(url,origin+'/v1/staging/rider/trips/'+trip+'/status');
 const options=init as {headers:Record<string,string>;method:string;cache:string;credentials:string};
 assert.equal(options.method,'GET');
 assert.equal(options.cache,'no-store');
 assert.equal(options.credentials,'omit');
 assert.equal(options.headers.authorization,'Bearer '+token);
});
test('accepted verified snapshot is rendered with road ETA only, not on offer notification',async()=>{
 const pending=await poll({request:remote(wrap({...base,status:'offer_pending'})).request});
 assert.equal(pending.view.driver,null);
 const winning=await poll({request:remote(wrap(accepted)).request});
 assert.equal(winning.view.driver?.plate,'TEST777');
 assert.equal(winning.view.etaMinutes,8);
 assert.equal(winning.view.roadMeters,2300);
 assert.deepEqual(winning.view.driverPosition,{lat:-25.3,lng:-57.6});
 assert.equal(winning.view.isCommercialRideEnabled,false);
});
test('all denied and missing sessions fail closed, clear previous identity and never fetch without JWT',async()=>{
 let called=0;
 const request:RadarRequest=async()=>{called++;throw Error('do not call')};
 const confirmed=await poll({request:remote(wrap(accepted)).request});
 const none=await poll({state:confirmed.state,accessToken:null,request});
 assert.equal(none.connection,'no-session');
 assert.equal(none.view.driver,null);
 assert.equal(none.view.driverPosition,null);
 assert.equal(none.view.etaMinutes,null);
 assert.equal(none.state.latest,null);
 assert.equal(called,0);
 for(const code of [401,403,404]){
  const res=await poll({state:confirmed.state,request:remote(null,code).request});
  assert.equal(res.connection,'forbidden');
  assert.equal(res.state.latest,null);
  assert.equal(res.view.driver,null);
 }
});
test('outages and 500 immediately hide any previously visible ETA and GPS',async()=>{
 const confirmed=await poll({request:remote(wrap(accepted)).request});
 assert.equal(confirmed.view.etaMinutes,8);
 const failed=await poll({state:confirmed.state,
  request:async()=>{throw Error('network down')}}
 );
 assert.equal(failed.connection,'offline');
 assert.equal(failed.view.driverPosition,null);
 assert.equal(failed.view.etaMinutes,null);
 assert.equal(failed.view.freshness,'stale');
 const httpFail=await poll({state:confirmed.state,request:remote(null,502).request});
 assert.equal(httpFail.connection,'offline');
 assert.equal(httpFail.view.driverPosition,null);
 assert.equal(httpFail.commercialRidesEnabled,false);
});
test('reject server snapshot spoofed actor, passenger, wrong mode, live flag or malformed JSON',async()=>{
 const malformed=[
  {mode:'PRODUCTION',commercialRidesEnabled:false,event:accepted},
  {mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:true,event:accepted},
  wrap({...accepted,source:'phone'}),
  wrap({...accepted,passengerId:other}),
  wrap({...accepted,tripId:other}),
  wrap({...accepted,serverRevision:'999'}),
  wrap(null),
  'fake'
 ];
 for(const data of malformed){
  const res=await poll({request:remote(data).request});
  assert.equal(res.connection,'invalid-response');
  assert.equal(res.view.etaMinutes,null);
  assert.equal(res.view.driver,null);
 }
 const bad=await poll({request:async()=>({status:200,json:async()=>{throw Error('broken JSON')}})});
 assert.equal(bad.connection,'invalid-response');
});
test('replayed/out-of-order version never resets a confirmed accepted driver to searching',async()=>{
 const confirmed=await poll({request:remote(wrap(accepted)).request});
 const replay=await poll({state:confirmed.state,
  request:remote(wrap({...base,status:'searching',serverRevision:1})).request});
 assert.equal(replay.connection,'connected');
 assert.equal(replay.view.status,'accepted');
 assert.equal(replay.view.driver?.plate,'TEST777');
});
test('reject insecure/public/different environment origins before reaching fetch',async()=>{
 const request:RadarRequest=async()=>{throw Error('must not fetch')};
 for(const apiOrigin of [
  'http://example.test','http://localhost:3000',
  'http://0.0.0.0:9000','https://qdqrlgzlotnfdxzpacxs.supabase.co',
  'https://user:password@staging.example.test',
  'https://staging.example.test/path',
  'https://staging.example.test?key=1',
  'http://127.0.0.1:4141',
 ]){
  await assert.rejects(poll({apiOrigin,request}));
 }
 const acceptedLocal=await poll({
  apiOrigin:'http://127.0.0.1:4141',pinnedApiOrigin:'http://127.0.0.1:4141',enableLoopbackQA:true,
  request:remote(wrap(base)).request
 });
 assert.equal(acceptedLocal.connection,'connected');
});

test('same HTTPS scheme is not enough: pin the approved STAGING hostname before any JWT leaves',async()=>{
 let calls=0;
 const request:RadarRequest=async()=>{
  calls++;throw Error('never reached');
 };
 await assert.rejects(poll({
  apiOrigin:'https://attacker.example.test',
  pinnedApiOrigin:origin,
  request,
 }),/non-pinned/);
 await assert.rejects(poll({
  apiOrigin:origin,
  pinnedApiOrigin:'https://different.example.test',
  request,
 }),/non-pinned/);
 await assert.rejects(poll({
  apiOrigin:origin,
  pinnedApiOrigin:'http://localhost:4141',
  request,
 }));
 assert.equal(calls,0,'must not leak Auth bearer to an attacker HTTPS origin');
});
