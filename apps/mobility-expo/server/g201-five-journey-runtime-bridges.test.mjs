import test from 'node:test';
import assert from 'node:assert/strict';
import {createG201FiveJourneyRuntimeBridges,validG201IndependentTrust}
 from './g201-five-journey-runtime-bridges.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';

const passenger='20100000-0000-4201-8201-000000000001';
const driver='20100000-0000-4201-8201-000000000002';
const session='20100000-0000-4201-8201-000000000003';
const trip='20100000-0000-4201-8201-000000000004';
const c='20100000-0000-4201-8201-000000000005';
const req='20100000-0000-4201-8201-000000000006';
const now=1800000000000;
const tokenPassenger='g201-passenger-session-token-1234567890';
const tokenDriver='g201-driver-session-token-1234567890123';
const noop=async()=>({status:404,body:{error:'Not found'}});
const common=(actor)=>({
 id:actor,sessionId:session,tokenIatMs:now-1000,
 expiresAtMs:now+60000,is_anonymous:false
});
const receipt=(extra)=>({
 mode:'STAGING_DEMO_ONLY',qaOnly:true,productionEnabled:false,...extra
});
const reply=(kind)=>({caseId:c,tripId:trip,state:'OPEN',
 expiresAtMs:now+40000,...(kind==='open'?{}:{canSend:true,messages:[]})});
const path=(kind)=>kind==='AUTO'?
 '/v1/staging/rider/trips/'+trip+'/lost-items':
 '/v1/staging/rider/moto/trips/'+trip+'/lost-items';
function scenario(){
 let revoked=false,stopped=false,sqlCalls=[],roles=0;
 const trust={
  verifyParticipantSession:async token=>common(
   token===tokenDriver?driver:passenger),
  verifySessionNotRevoked:async()=>!revoked,
  verifyDriverStopped:async()=>stopped
 };
 const admin={rpc:async(name,params)=>{
  sqlCalls.push({name,params});
  if(name==='mobility_stage_g197_read_pickup_qa')
   return {data:{mode:'STAGING_DEMO_ONLY',driverId:driver,
    preferences:[{serviceKind:'MOTO_RIDE',maximumRoadMeters:3000,revision:1}],
    liveEnabled:false,productionEnabled:false},error:null};
  if(name==='mobility_stage_g197_save_pickup_qa')
   return {data:{mode:'STAGING_DEMO_ONLY',driverId:driver,
    serviceKind:params._kind,maximumRoadMeters:params._distance_meters,
    revision:params._expected_revision+1,serverPersisted:true,
    liveEnabled:false,productionEnabled:false},error:null};
  if(name.endsWith('_open_case_qa'))
   return {data:receipt(reply('open')),error:null};
  if(name.endsWith('_read_case_qa'))
   return {data:receipt(reply('read')),error:null};
  if(name.endsWith('_driver_inbox_qa'))
   return {data:receipt({driverId:driver,cases:[{caseId:c,tripId:trip,
    state:'OPEN',expiresAtMs:now+40000}]}),error:null};
  if(name.endsWith('_send_message_qa'))
   return {data:receipt({caseId:c,messageId:req,
    requestKey:params._request,serverPersisted:true}),error:null};
  if(name==='mobility_stage_g214_close_g198_case_qa'||
     name==='mobility_stage_g214_close_g200_case_qa')
   return {data:receipt({caseId:params._case,
    state:params._block?'BLOCKED':'CLOSED'}),error:null};
  throw Error('Unexpected or unsafe SQL call '+name);
 }};
 const gateways=createG201FiveJourneyRuntimeBridges({
  independentTrust:trust,admin,now:()=>now,
  verifySupabaseUser:async token=>({
   id:token===tokenDriver?driver:passenger,
   is_anonymous:false,email_confirmed_at:'2026-10-29T14:00:00Z'
  }),
  resolveExclusiveRole:async id=>{roles++;return id===driver?'driver':'passenger'},
  allowRequest:()=>true
 });
 const header=token=>({authorization:'Bearer '+token});
 const p=(method,p,token,body)=>({method,path:p,headers:header(token),
  ...(body!==undefined?{body}:{})});
 return {gateways,p,header,sqlCalls,roles:()=>roles,
  revoke:()=>{revoked=true},stop:()=>{stopped=true}};
}
test('G201 refuses missing independent G42 IdP, motion and SQL authorities',()=>{
 assert.equal(validG201IndependentTrust({}),false);
 assert.throws(()=>createG201FiveJourneyRuntimeBridges({}),/G201/);
 assert.throws(()=>createG201FiveJourneyRuntimeBridges({
  independentTrust:{verifyParticipantSession:async()=>true}
 }),/G201/);
});
test('G201 Driver pickup of original MOTO, real per-service SQL CAS, no Passenger overwrite',async()=>{
 const s=scenario();
 const get=await s.gateways.pickupPreferenceHandler(
  s.p('GET','/v1/staging/driver/pickup-preferences',tokenDriver));
 assert.equal(get.status,200);
 assert.equal(get.body.preferences[0].serviceKind,'MOTO_RIDE');
 const put=await s.gateways.pickupPreferenceHandler(
  s.p('PUT','/v1/staging/driver/pickup-preferences',tokenDriver,
   {serviceKind:'MOTO_RIDE',maximumRoadMeters:5000,expectedRevision:1}));
 assert.equal(put.status,200);
 assert.equal(put.body.revision,2);
 assert(s.sqlCalls.some(x=>x.name==='mobility_stage_g197_save_pickup_qa'
  &&x.params._driver===driver&&x.params._kind==='MOTO_RIDE'
  &&x.params._expected_revision===1));
 const bad=await s.gateways.pickupPreferenceHandler(
  s.p('PUT','/v1/staging/driver/pickup-preferences',tokenPassenger,
   {serviceKind:'RIDE',maximumRoadMeters:2000,expectedRevision:0}));
 assert.equal(bad.status,403);
 const n=s.sqlCalls.length;s.revoke();
 const revoked=await s.gateways.pickupPreferenceHandler(
  s.p('GET','/v1/staging/driver/pickup-preferences',tokenDriver));
 assert.equal(revoked.status,401);
 assert.equal(s.sqlCalls.length,n);
});
test('G201 AUTO and MOTO forgotten objects remain separate original trip SQL cases',async()=>{
 const s=scenario();
 const openedAuto=await s.gateways.lostItemsHandler(
  s.p('POST',path('AUTO'),tokenPassenger,{}));
 const openedMoto=await s.gateways.motoLostItemsHandler(
  s.p('POST',path('MOTO'),tokenPassenger,{}));
 assert.equal(openedAuto.status,200);
 assert.equal(openedMoto.status,200);
 assert.equal(openedMoto.body.tripId,trip);
 const names=s.sqlCalls.map(x=>x.name);
 assert(names.includes('mobility_stage_g198_open_case_qa'));
 assert(names.includes('mobility_stage_g200_open_case_qa'));
 assert(s.sqlCalls.filter(x=>x.name.endsWith('_open_case_qa'))
  .every(x=>x.params._passenger===passenger&&x.params._trip===trip));
 const denied=await s.gateways.motoLostItemsHandler(
  s.p('POST',path('MOTO'),tokenDriver,{}));
 assert.equal(denied.status,403);
});
test('G201 MOTO Driver inbox and message require independent stopped evidence',async()=>{
 const s=scenario();
 const inbox=await s.gateways.motoLostItemsHandler(
  s.p('GET','/v1/staging/driver/moto/lost-items',tokenDriver));
 assert.equal(inbox.status,200);
 assert.equal(inbox.body.cases[0].tripId,trip);
 const sendPath='/v1/staging/moto/lost-items/'+c+'/messages';
 const body={requestKey:req,body:'Encontré tu casco. Contactá soporte.'};
 const denied=await s.gateways.motoLostItemsHandler(
  s.p('POST',sendPath,tokenDriver,body));
 assert.equal(denied.status,403);
 assert(!s.sqlCalls.some(x=>x.name.endsWith('_send_message_qa')));
 s.stop();
 const sent=await s.gateways.motoLostItemsHandler(
  s.p('POST',sendPath,tokenDriver,body));
 assert.equal(sent.status,200);
 assert(s.sqlCalls.some(x=>x.name==='mobility_stage_g200_send_message_qa'
  &&x.params._actor===driver&&x.params._body===body.body));
});
test('G214 both original AUTO and MOTO private cases close with read-backed SQL proof',async()=>{
 const s=scenario();
 for(const [kind,prefix] of [
  ['AUTO','g198'],['MOTO','g200']
 ]){
  const route=kind==='AUTO'
   ?'/v1/staging/lost-items/'+c+'/close'
   :'/v1/staging/moto/lost-items/'+c+'/close';
  const block=kind==='MOTO';
  const response=await (kind==='AUTO'?
   s.gateways.lostItemsHandler:s.gateways.motoLostItemsHandler)(
    s.p('POST',route,tokenPassenger,{block}));
  assert.equal(response.status,200,JSON.stringify(response.body));
  assert.equal(response.body.caseId,c);
  assert.equal(response.body.state,block?'BLOCKED':'CLOSED');
  assert.equal(response.body.productionEnabled,false);
  assert(s.sqlCalls.some(x=>x.name==='mobility_stage_g214_close_'+prefix+'_case_qa'
   &&x.params._case===c&&x.params._actor===passenger
   &&x.params._session===session&&x.params._block===block));
 }
 const count=s.sqlCalls.length;
 s.revoke();
 const denied=await s.gateways.motoLostItemsHandler(
  s.p('POST','/v1/staging/moto/lost-items/'+c+'/close',
   tokenPassenger,{block:false}));
 assert.equal(denied.status,401);
 assert.equal(s.sqlCalls.length,count);
});
test('G201 G4 loopback only mounts original PG-backed handlers when explicitly connected',async t=>{
 const s=scenario();
 const make=enabled=>createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  ...(enabled?s.gateways:{})
 });
 const server=make(true),origin=await listenQoreRadarLoopback(server);
 t.after(()=>new Promise(r=>server.close(r)));
 const response=await fetch(origin+path('MOTO'),{method:'POST',
  headers:{authorization:'Bearer '+tokenPassenger,
   'content-type':'application/json'},body:'{}'});
 assert.equal(response.status,200);
 assert.equal((await response.json()).tripId,trip);
 const closed=make(false),other=await listenQoreRadarLoopback(closed);
 t.after(()=>new Promise(r=>closed.close(r)));
 const unavailable=await fetch(other+path('MOTO'),{method:'POST',
  headers:{authorization:'Bearer '+tokenPassenger,'content-type':'application/json'},
  body:'{}'});
 assert.equal(unavailable.status,503);
});
