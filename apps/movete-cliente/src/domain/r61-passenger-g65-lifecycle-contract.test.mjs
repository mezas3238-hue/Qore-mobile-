/**
 * R61 — contract QA: Passenger G11 read model vs G65 Driver lifecycle.
 * Synthetic HTTP only. This does NOT mean a real STAGING server exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRiderStatusGateway} from './ride-status-gateway.mjs';
import {createRiderPollingCoordinator} from './rider-polling.mjs';
import {createRiderStatusStore} from './rider-status.mjs';

const clock=1800000000000;
const uuid=n=>'65652000-0000-4656-8656-'+String(n).padStart(12,'0');
const passenger=uuid(1),driver=uuid(2),trip=uuid(3),outsider=uuid(4);
const eventStatus={searching:'searching',assigned:'accepted',
 arriving:'at_pickup',in_progress:'in_progress',completed:'completed',
 cancelled:'cancelled'};
const steps=['searching','assigned','arriving','in_progress','completed'];
const passSession=()=>({subject:passenger,role:'passenger',authRevision:4,
 token:'synthetic-passenger-jwt-long-token-qa',expiresAt:clock+90000});
const response=payload=>({status:200,ok:true,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(payload)});
function snapshot(state,revision,extra={}){
 const active=['assigned','arriving','in_progress'].includes(state);
 return {
  tripId:trip,ownerId:passenger,revision,state,
  assignmentPersisted:state!=='searching',
  driver:active?{verified:true,displayName:'Conductor QA'}:null,
  vehicle:active?{kind:'AUTO',plate:'QA-1234'}:null,
  gpsConsent:false,location:null,etaVerified:false,etaMinutes:null,
  mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
  locationVisible:false,deliveryConfirmed:false,
  event:{source:'server',tripId:trip,passengerId:passenger,
   serverRevision:revision,trackingSequence:revision,status:eventStatus[state],
   acceptedDriver:null,tracking:null},
  ...extra
 };
}
function harness(fetchImpl){
 const status=createRiderStatusGateway({
  enabled:true,contractCertified:true,
  origin:'https://qa.staging.example.invalid',
  pinnedOrigin:'https://qa.staging.example.invalid',
  getSession:async()=>passSession(),fetchImpl,now:()=>clock
 });
 const poll=createRiderPollingCoordinator({
  gateway:{send:(op,args)=>op==='rideStatus'
   ?status.fetchStatus(args.id):{ok:false,code:'OPERATION_DENIED'}},
  getSession:async()=>({role:'passenger',subject:passenger}),
  store:createRiderStatusStore({now:()=>clock}),now:()=>clock
 });
 assert.equal(poll.begin(trip,passenger).ok,true);
 return poll;
}
test('R61 lifecycle searching -> accepted/assigned -> arriving -> in progress -> completed',async()=>{
 let index=0;
 const poll=harness(async(url,req)=>{
  assert.equal(req.method,'GET');
  assert.equal(req.headers.Authorization,'Bearer '+passSession().token);
  assert.equal(url,
   'https://qa.staging.example.invalid/v1/staging/rider/trips/'+trip+'/status');
  return response(snapshot(steps[index],index+1));
 });
 for(let i=0;i<steps.length;i++){
  index=i;
  const r=await poll.tick();
  assert.equal(r.ok,true,steps[i]);
  assert.equal(r.applied,true,steps[i]);
  assert.equal(poll.snapshot().state,steps[i]);
  assert.equal(poll.snapshot().revision,i+1);
  const driverVisible=['assigned','arriving','in_progress'].includes(steps[i]);
  assert.equal(Boolean(poll.snapshot().assignedDriver),driverVisible);
  assert.equal(poll.snapshot().position,null);
  assert.equal(poll.snapshot().etaMinutes,null);
  assert.equal(poll.snapshot().liveEnabled,false);
 }
 assert.equal(poll.snapshot().subscriptionActive,true);
 assert.equal(poll.snapshot().assignedDriver,null);
});
test('R61 cancellation terminal removes driver and GPS on authoritative revision',async()=>{
 const states=['searching','assigned','cancelled'];let step=0;
 const poll=harness(async()=>response(snapshot(states[step],step+1)));
 for(step=0;step<states.length;step++){
  assert.equal((await poll.tick()).ok,true);
 }
 assert.equal(poll.snapshot().state,'cancelled');
 assert.equal(poll.snapshot().assignedDriver,null);
 assert.equal(poll.snapshot().position,null);
 assert.equal(poll.snapshot().etaMinutes,null);
});
test('R61 out-of-sequence driver stage does not reach Passenger render',async()=>{
 const poll=harness(async()=>response(snapshot('assigned',2,{
  event:{...snapshot('assigned',2).event,status:'completed'}
 })));
 assert.equal((await poll.tick()).code,'INVALID_SERVER_SNAPSHOT');
 assert.equal(poll.snapshot().tripId,null);
 assert.equal(poll.snapshot().position,null);
});
test('R61 cross-tenant status cannot turn into assigned Driver',async()=>{
 const poll=harness(async()=>response(snapshot('assigned',2,{ownerId:outsider})));
 assert.equal((await poll.tick()).code,'INVALID_SERVER_SNAPSHOT');
 assert.equal(poll.snapshot().assignedDriver,null);
});
test('R61 stale revision cannot undo completed trip or refresh GPS freshness',async()=>{
 let step=0;
 const rows=[snapshot('assigned',2),snapshot('completed',5),snapshot('arriving',4)];
 const poll=harness(async()=>response(rows[step++]));
 assert.equal((await poll.tick()).ok,true);
 assert.equal((await poll.tick()).ok,true);
 assert.equal(poll.snapshot().state,'completed');
 assert.equal((await poll.tick()).code,'STALE_SERVER_REVISION');
 assert.equal(poll.snapshot().state,'completed');
 assert.equal(poll.snapshot().lastFetchedAt,null);
 assert.equal(poll.snapshot().lastError,'STALE_SERVER_REVISION');
 assert.equal(poll.snapshot().assignedDriver,null);
});
test('R61 invalid role on Passenger server request prevents network fetch',async()=>{
 let hits=0;
 const status=createRiderStatusGateway({
  enabled:true,contractCertified:true,origin:'https://qa.staging.example.invalid',
  pinnedOrigin:'https://qa.staging.example.invalid',
  getSession:async()=>({...passSession(),role:'driver'}),
  fetchImpl:async()=>{hits++;return response(snapshot('assigned',2));},
  now:()=>clock
 });
 assert.equal((await status.fetchStatus(trip)).code,'AUTH_REQUIRED');
 assert.equal(hits,0);
});
