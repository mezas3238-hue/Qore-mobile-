/**
 * G109: positive, NONCOMMERCIAL completion on an isolated QA accepted
 * PostgreSQL fixture accepted BEFORE the G38 legal/geofence fence was installed.
 *
 * This DOES NOT create an acceptance, bypass G38, activate LIVE dispatch, or
 * represent a legally approved G73 passenger booking. The purpose is to prove
 * that the existing HTTP gateways, DB state machine, Rider/Driver visibility,
 * durable event revisions and G36 driver-slot release actually work together
 * after all current safety migrations have been applied.
 * Runs ONLY after the full G103 CI chain and must never target a remote DB.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createQoreRiderStatusGateway} from './g4-rider-status-gateway.mjs';
import {createG65PrivateDriverTripStatusQa}
 from './g65-driver-trip-status-qa.mjs';
import {createG106PrivateDriverCurrentTripQa}
 from './g106-driver-current-trip-qa.mjs';
import {createQoreTripCommandGateway}
 from './g4-trip-command-gateway.mjs';

const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fixture='10900000-0000-4109-8109-000000000023';
const driver='10900000-0000-4109-8109-000000000022';
const rider='10900000-0000-4109-8109-000000000021';
const outsider='00000000-0000-4000-8000-000000000182';
const session='10900000-0000-4109-8109-000000000003';
const keys=[
 '10900000-0000-4109-8109-000000000011',
 '10900000-0000-4109-8109-000000000012',
 '10900000-0000-4109-8109-000000000013',
 '10900000-0000-4109-8109-000000000014'
];
const driverToken='g109-verified-synthetic-driver-token-000000000001';
const riderToken='g109-verified-synthetic-rider-token-000000000001';
const foreignToken='g109-verified-synthetic-foreign-token-000000000001';
const NOOP=async()=>({status:404,body:{error:'Not found'}});
if(process.env.PGHOST!=='localhost'||process.env.PGPORT!=='5432'||
 process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain'||
 process.env.CI!=='true')
 throw Error('G109 refuses anything except isolated GitHub PostgreSQL16');

function psql(command){
 const out=execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',command],
  {encoding:'utf8',timeout:15000,maxBuffer:1000000,
   stdio:['ignore','pipe','pipe']});
 return out.trim().split('\n').at(-1)?.trim()??'';
}
function read(query){const result=psql(query);return result?JSON.parse(result):null;}
const role=async actor=>{
 if(!UUID.test(actor))throw Error('No verified role source');
 const result=psql("SET ROLE service_role; SELECT CASE WHEN count(*)=1 "+
  "THEN min(role::text) ELSE 'none' END FROM public.user_roles "+
  "WHERE user_id='"+actor+"'");
 return result==='none'?null:result;
};
async function http(origin,path,{auth=driverToken,method='GET',body}={}){
 const headers={authorization:'Bearer '+auth};
 if(body!==undefined)headers['content-type']='application/json';
 const response=await fetch(origin+path,{method,headers,redirect:'error',
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal(response.headers.get('cache-control'),
  'private, no-store, max-age=0');
 return {status:response.status,data:await response.json()};
}
async function main(){
 assert.equal(psql("SELECT (current_database()='qore_disposable_chain' AND "+
  "current_setting('application_name')='qore_ci_disposable_chain')::text"),'true');
 // This independent QA trip was accepted before G38 with a synthetic G20-reviewed license.
 // G38 is installed NOW and MUST remain installed while completing it.
 assert.equal(psql("SELECT (to_regclass('public.mobility_stage_g38_trusted_offer_proofs') "+
  "IS NOT NULL AND to_regclass('public.mobility_stage_g36_driver_slots') "+
  "IS NOT NULL)::text"),'true');
 const tripId=psql("SET ROLE service_role; SELECT id::text "+
  "FROM public.mobility_stage_auto_demo_trips WHERE request_key='"+fixture+"'");
 assert(UUID.test(tripId),'G109 independent QA fixture missing');
 // Auditor-only CI snapshot: G36 slot registry is intentionally denied to
 // service_role. The synthetic database owner inspects it here, while every
 // HTTP endpoint and Driver mutation continues through service_role RPCs.
 const snapshot=()=>read("SELECT jsonb_build_object("+
  "'tripId',t.id,'status',t.status,'revision',t.revision,"+
  "'driverId',t.driver_id,'passengerId',t.passenger_id,"+
  "'events',(SELECT count(*) FROM public.mobility_stage_auto_demo_events e "+
  "WHERE e.trip_id=t.id),'slot',(SELECT count(*) "+
  "FROM public.mobility_stage_g36_driver_slots s WHERE s.driver_id=t.driver_id "+
  "AND s.assignment_id=t.id AND s.assignment_kind='AUTO_RIDE'))::text "+
  "FROM public.mobility_stage_auto_demo_trips t WHERE t.id='"+tripId+"'");
 const before=snapshot();
 assert.equal(before.status,'accepted','G109 must not create an acceptance after G38');
 assert.equal(before.revision,2);
 assert.equal(before.driverId,driver);assert.equal(before.passengerId,rider);
 assert.equal(Number(before.events),1);
 assert.equal(Number(before.slot),1);

 const confirmedDriver=async token=>{
  if(token!==driverToken)throw Error('Unverified Driver');
  return {id:driver,is_anonymous:false,
   email_confirmed_at:'2026-10-26T12:00:00Z'};
 };
 const verifiedRider=async token=>{
  const id=token===riderToken?rider:token===foreignToken?outsider:null;
  if(!id)throw Error('Unverified Passenger');
  return {id,is_anonymous:false,email_confirmed_at:'2026-10-26T12:00:00Z'};
 };
 const driverJwt=async token=>{
  const identity=await confirmedDriver(token);
  const at=Date.now();
  return {id:identity.id,sessionId:session,tokenIatMs:at-1000,
   expiresAtMs:at+300000,is_anonymous:false};
 };
 const sessionLive=async x=>x.userId===driver&&x.sessionId===session;
 const getDriverRow=async({actorId,tripId:requested})=>{
  if(!UUID.test(actorId)||!UUID.test(requested))return null;
  return read("SET ROLE service_role; SELECT COALESCE((SELECT "+
   "jsonb_build_object('tripId',t.id,'driverId',t.driver_id,"+
   "'vehicleId',t.vehicle_id,'passengerId',t.passenger_id,"+
   "'status',t.status,'revision',t.revision,'service',t.service) "+
   "FROM public.mobility_stage_auto_demo_trips t "+
   "WHERE t.id='"+requested+"' AND t.driver_id='"+actorId+"'),"+
   "'null'::jsonb)::text");
 };
 const getActive=async({actorId})=>{
  if(!UUID.test(actorId))return null;
  return read("SET ROLE service_role; SELECT COALESCE((SELECT "+
   "jsonb_build_object('tripId',t.id,'driverId',t.driver_id,"+
   "'status',t.status,'revision',t.revision) "+
   "FROM public.mobility_stage_auto_demo_trips t "+
   "WHERE t.driver_id='"+actorId+"' "+
   "AND t.status IN ('accepted','arriving','in_progress') LIMIT 1),"+
   "'null'::jsonb)::text");
 };
 const riderStatus=createQoreRiderStatusGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:verifiedRider,
  authorizePassenger:async id=>await role(id)==='passenger',
  allowRequest:()=>true,
  loadOwnTrip:async({tripId:requested,passengerId})=>{
   if(!UUID.test(requested)||!UUID.test(passengerId))return null;
   return read("SET ROLE service_role; SELECT COALESCE((SELECT "+
    "jsonb_build_object('id',t.id,'passengerId',t.passenger_id,"+
    "'driverId',t.driver_id,'vehicleId',t.vehicle_id,'status',t.status,"+
    "'revision',t.revision,'trackingSequence',0) "+
    "FROM public.mobility_stage_auto_demo_trips t "+
    "WHERE t.id='"+requested+"' AND t.passenger_id='"+passengerId+"'),"+
    "'null'::jsonb)::text");
  },
  // No real GPS, identity or ETA provider is connected in this CI.
  loadArrivalEvidence:async()=>{throw Error('No independently verified GPS');}
 });
 const driverStatus=createG65PrivateDriverTripStatusQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  verifyAccessToken:driverJwt,verifySessionNotRevoked:sessionLive,
  resolveExclusiveRole:role,allowRequest:()=>true,
  loadAssignedTrip:getDriverRow
 });
 const driverCurrent=createG106PrivateDriverCurrentTripQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  verifyAccessToken:driverJwt,verifySessionNotRevoked:sessionLive,
  resolveExclusiveRole:role,allowRequest:()=>true,
  loadCurrentAssignedTrip:getActive
 });
 const commands=createQoreTripCommandGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async token=>token===driverToken?
   confirmedDriver(token):verifiedRider(token),
  resolveRole:role,allowRequest:()=>true,
  requestTrip:async()=>{throw Error('No new ride creation in G109');},
  transitionTrip:async({actorId,tripId:requested,event,eventKey})=>{
   if(![actorId,requested,eventKey].every(x=>UUID.test(x)))
    throw Error('No unverified Driver mutation');
   const next={arrive:'arriving',pickup:'in_progress',complete:'completed',
    cancel:'cancelled'}[event];
   if(!next)throw Error('Unsupported transition');
   const eventId=psql("SET ROLE service_role; SELECT "+
    "public.mobility_stage_auto_demo_transition('"+requested+"','"+
    actorId+"','"+next+"'::public.mobility_stage_trip_status,'"+
    eventKey+"')::text");
   return {ok:true,liveEnabled:false,eventId};
  }
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:riderStatus,tripCommandHandler:commands,
  driverTripStatusHandler:driverStatus,
  driverCurrentTripHandler:driverCurrent,offerHandler:NOOP,
  deliveryHandler:NOOP,merchantHandler:NOOP,financeHandler:NOOP,
  safetyHandler:NOOP,merchantManagementHandler:NOOP,
  deliveryOfferHandler:NOOP
 });
 try{
  const origin=await listenQoreRadarLoopback(server);
  const dr='/v1/staging/driver/trips/'+tripId+'/status';
  const cl='/v1/staging/rider/trips/'+tripId+'/status';
  const transition='/v1/staging/trips/'+tripId+'/transition';
  const current='/v1/staging/driver/trips/current';
  const states=[
   ['accepted','assigned',2,'arrive'],
   ['arriving','arriving',3,'pickup'],
   ['in_progress','in_progress',4,'complete'],
   ['completed','completed',5,null]
  ];
  async function verify(stage){
   const [persisted,riderState,revision,event]=states[stage];
   const [d,c,active]=await Promise.all([
    http(origin,dr),http(origin,cl,{auth:riderToken}),http(origin,current)]);
   assert.equal(d.status,200,JSON.stringify(d.data));
   assert.equal(c.status,200,JSON.stringify(c.data));
   assert.equal(active.status,200,JSON.stringify(active.data));
   assert.equal(d.data.tripId,tripId);
   assert.equal(d.data.state,persisted);
   assert.equal(d.data.revision,revision);
   assert.equal(d.data.nextEvent,event);
   assert.equal(c.data.tripId,tripId);
   assert.equal(c.data.state,riderState);
   assert.equal(c.data.revision,revision);
   assert.equal(c.data.driver,null,'No fabricated Driver profile');
   assert.equal(c.data.location,null,'No fabricated GPS');
   assert.equal(c.data.etaMinutes,null,'No fabricated ETA');
   assert.equal(c.data.commercialRidesEnabled,false);
   assert.equal(active.data.activeTrip?.tripId,
    stage===3?undefined:tripId);
   assert.equal(active.data.liveTripsEnabled,false);
   const s=snapshot();
   assert.equal(s.status,persisted);
   assert.equal(s.revision,revision);
   assert.equal(Number(s.events),revision-1);
   assert.equal(Number(s.slot),stage===3?0:1,
    'G36 occupied only during the active AUTO journey');
  }
  await verify(0);
  assert.equal((await http(origin,cl,{auth:foreignToken})).status,404);
  assert.equal((await http(origin,dr,{auth:riderToken})).status,401);
  assert.equal((await http(origin,transition,{
   method:'POST',auth:foreignToken,
   body:{event:'arrive',eventKey:keys[0]}})).status,403);
  const events=['arrive','pickup','complete'];
  for(let i=0;i<events.length;i++){
   const body={event:events[i],eventKey:keys[i]};
   const command=await http(origin,transition,{method:'POST',body});
   assert.equal(command.status,200,JSON.stringify(command.data));
   assert.equal(command.data.serverPersisted,true);
   assert.equal(command.data.commercialRidesEnabled,false);
   // Same key must return the same SQL event, never double increment.
   const replay=await http(origin,transition,{method:'POST',body});
   assert.equal(replay.status,200,JSON.stringify(replay.data));
   assert.equal(replay.data.eventId,command.data.eventId);
   await verify(i+1);
   if(i===1){
    assert.equal((await http(origin,'/v1/staging/rider/trips/'+
     tripId+'/cancel',{method:'POST',auth:riderToken,
      body:{requestKey:keys[3]}})).status,409,
     'Passenger cannot cancel an in-progress journey');
   }
  }
  assert.equal((await http(origin,transition,{
   method:'POST',body:{event:'arrive',eventKey:keys[3]}})).status,409);
  assert.equal((await http(origin,transition,{
   method:'POST',auth:riderToken,
   body:{event:'complete',eventKey:keys[3]}})).status,403);
  assert.equal((await http(origin,current,{auth:foreignToken})).status,401);
  const terminal=snapshot();
  assert.equal(terminal.status,'completed');
  assert.equal(terminal.revision,5);
  assert.equal(Number(terminal.events),4);
  assert.equal(Number(terminal.slot),0);
  console.log('G109 PASS: real HTTP + PostgreSQL16 independently isolated pre-G38 QA acceptance -> arriving -> in_progress -> completed; Driver/Rider same persisted revision; G36 slot released; idempotent keys; no GPS, payments, new legal assignment or LIVE.');
 }finally{
  server.close();
  if(server.listening)await once(server,'close');
 }
}
await main();
