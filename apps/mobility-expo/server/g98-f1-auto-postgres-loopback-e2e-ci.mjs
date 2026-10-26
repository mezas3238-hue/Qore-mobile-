/**
 * G98 real HTTP -> Node gateway -> SQL RPC -> persistent PG16 chain, CI ONLY.
 * No mocked SQL, no real map/GPS/Driver acceptance and no PSP money.
 * Authoritative role, same trip, campaign accounting and cancellation are
 * asserted from disposable PostgreSQL; NEVER target external databases.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
import {createQoreG73AutoRepository} from './g73-auto-f1-repository.mjs';
import {createQoreRiderStatusGateway} from './g4-rider-status-gateway.mjs';
import {createG75AdminF1AuditGateway} from './g75-f1-admin-audit-gateway.mjs';
import {createG75AdminF1Repository} from './g75-f1-admin-audit-repository.mjs';
import {createG65PrivateDriverTripStatusQa} from './g65-driver-trip-status-qa.mjs';
import {createG106PrivateDriverCurrentTripQa} from './g106-driver-current-trip-qa.mjs';
import {createQoreTripCommandGateway} from './g4-trip-command-gateway.mjs';

if(process.env.PGHOST!=='localhost'||
 process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain'||
 !/^\d{4,5}$/.test(process.env.PGPORT??''))
 throw Error('G98 forbidden outside disposable localhost PostgreSQL16 CI');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const p='98980000-0000-4989-8989-000000000001';
const owner='98980000-0000-4989-8989-000000000002';
const outsider='98980000-0000-4989-8989-000000000003';
const adminId='98980000-0000-4989-8989-000000000004';
const adminSessionId='98980000-0000-4989-8989-000000000005';
const driverId='98980000-0000-4989-8989-000000000006';
const driverSessionId='98980000-0000-4989-8989-000000000007';
const forgedDriverTransitionKey='98980000-0000-4989-8989-000000000026';
const campaign='98980000-0000-4989-8989-000000000020';
const routeKey='98980000-0000-4989-8989-000000000010';
const quoteKey='98980000-0000-4989-8989-000000000011';
const bookingKey='98980000-0000-4989-8989-000000000012';
const cancelKey='98980000-0000-4989-8989-000000000013';
const token='g98-verified-qa-session-'+p.replaceAll('-','');
const otherToken='g98-verified-qa-session-'+outsider.replaceAll('-','');
const adminToken='g99-admin-aal2-qa-'+adminId.replaceAll('-','');
const driverToken='g105-private-driver-session-'+driverId.replaceAll('-','');
const f1='/v1/staging/rider/auto';
const noop=async()=>({status:404,body:{error:'Not found'}});
function psql(script){
 const out=execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',script],
  {encoding:'utf8',timeout:12000,maxBuffer:4_000_000,stdio:['ignore','pipe','pipe']});
 return out.trim().split('\n').at(-1)?.trim()??'';
}
function sqlArg(v){
 if(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=100000000)
  return String(v);
 if(typeof v==='string'&&(/^[A-Z_]{3,40}$/.test(v)||uuid.test(v)||
  ['economico','confort','xl'].includes(v)))return "'"+v+"'";
 throw Error('G98 SQL fixture refused unsafe parameter');
}
const methods={
 mobility_stage_g73_route:['_passenger_id','_request_key','_service',
  '_origin_tag','_destination_tag','_zone_tag','_distance_meters',
  '_duration_seconds','_tolls_pyg'],
 mobility_stage_g73_route_receipt:['_passenger_id','_route_id'],
 mobility_stage_g73_quote:['_passenger_id','_route_id','_quote_request_key'],
 mobility_stage_g73_quote_receipt:['_passenger_id','_quote_id'],
 mobility_stage_g73_book:['_passenger_id','_quote_id','_request_key'],
 mobility_stage_g73_booking_receipt:['_passenger_id','_request_key'],
 mobility_stage_g90_passenger_dispatch_status_qa:['_passenger_id','_booking_key'],
 mobility_stage_g93_preview_auto_qa:['_passenger_id','_quote_id'],
 mobility_stage_g94_auto_financial_state_qa:['_passenger_id','_booking_key'],
 mobility_stage_g95_cancel_booked_auto_qa:['_passenger_id','_booking_key','_cancellation_key'],
 mobility_stage_g95_cancel_receipt_qa:['_passenger_id','_booking_key'],
 mobility_stage_g75_admin_f1_receipt:['_admin_id','_trip_id']
};
async function rpc(name,args){
 const keys=methods[name];
 if(!keys||Object.keys(args).length!==keys.length||
  !keys.every(k=>Object.hasOwn(args,k)))
  throw Error('G98 unrecognized private RPC');
 const sql='SET ROLE service_role; SELECT public.'+name+'('+
  keys.map(k=>sqlArg(args[k])).join(',')+')::text;';
 const raw=psql(sql);
 return {data:raw===''?null:raw.startsWith('{')?JSON.parse(raw):raw,error:null};
}
function sqlJson(script){
 const raw=psql(script);
 return raw===''?null:JSON.parse(raw);
}
const assertLocalDatabase=()=>{
 const guard=psql("SELECT (current_database()='qore_disposable_chain' AND current_setting('application_name')='qore_ci_disposable_chain')::text");
 assert.equal(guard,'true');
};
async function http(base,path,{method='GET',body,auth=token}={}){
 const headers={authorization:'Bearer '+auth};
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(base+path,{
  method,headers,
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  redirect:'error'
 });
 const data=await r.json();
 assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0');
 return {status:r.status,data};
}
async function main(){
 assertLocalDatabase();
 psql("DO $g$ BEGIN IF current_database()<>'qore_disposable_chain' OR current_setting('application_name')<>'qore_ci_disposable_chain' THEN RAISE EXCEPTION 'G98 refusal'; END IF; END $g$;"+
  "INSERT INTO auth.users(id) VALUES ('"+p+"'),('"+owner+"'),('"+outsider+"'),('"+adminId+"'),('"+driverId+"');"+
  "DELETE FROM public.user_roles WHERE user_id='"+driverId+"';"+
  "INSERT INTO public.user_roles(user_id,role) VALUES ('"+driverId+"','driver');"+
  "DELETE FROM public.user_roles WHERE user_id IN ('"+owner+"','"+adminId+"');"+
  "INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by) VALUES('"+owner+"','owner','active','"+owner+"');"+
  "INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by) VALUES('"+adminId+"','admin','active','"+owner+"');"+
  "INSERT INTO public.mobility_stage_g93_ride_campaigns(id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days) VALUES('"+campaign+"','AUTO_RIDE','G98_AUTO_60_QA','"+owner+"',true,pg_catalog.transaction_timestamp()-interval '1 hour',pg_catalog.transaction_timestamp()-interval '1 hour'+interval '60 days',60);");
 const db=createQoreG73AutoRepository({rpc});
 const gateway=createQoreG73AutoGateway({
  projectRef:'staging1234567890abcd',now:Date.now,
  verifyAccessToken:async value=>{
   const id=value===token?p:value===otherToken?outsider:null;
   if(!id)throw Error('Unknown synthetic CI Auth token');
   return {id,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'};
  },
  authorizePassenger:async id=>id===p||id===outsider,
  allowRequest:()=>true,
  // Synthetic independently attested route exclusively in disposable QA.
  // This is NOT a real Google Maps, road/coverage or GPS verification.
  resolveVerifiedRoute:async()=>({
   routingVerified:true,coverageVerified:true,trafficAware:true,
   fallbackUsed:false,originTag:'CENTRO_FIXTURE',
   destinationTag:'AEROPUERTO',zoneTag:'ASUNCION_FIXTURE',
   distanceMeters:5000,durationSeconds:600,tollsPyg:0}),
  registerRoute:x=>db.registerRoute(x),
  loadRoute:x=>db.routeReceipt(x),
  quoteRoute:x=>db.quote(x),
  loadQuote:x=>db.quoteReceipt(x),
  bookQuote:x=>db.book(x),
  reconcileBooking:x=>db.bookingReceipt(x),
  readDispatchStatus:x=>db.dispatchStatus(x),
  readSubsidyPreview:x=>db.previewAutoSubsidy(x),
  readAutoFinancialState:x=>db.autoFinancialState(x),
  cancelBookedAuto:x=>db.cancelBookedAuto(x),
  readCancellation:x=>db.cancellationReceipt(x),
 });
 // G99: Client state reads the exact G3 row in real PG16, scoped by the
 // server-verified synthetic Passenger. No event or Driver profile is forged.
 const rider=createQoreRiderStatusGateway({
  projectRef:'staging1234567890abcd',now:Date.now,
  verifyAccessToken:async value=>{
   const id=value===token?p:value===otherToken?outsider:null;
   if(!id)throw Error('Unknown Passenger session in disposable QA');
   return {id,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'};
  },
  authorizePassenger:async id=>id===p||id===outsider,allowRequest:()=>true,
  loadOwnTrip:async({tripId,passengerId})=>{
   if(!uuid.test(tripId)||!uuid.test(passengerId))return null;
   return sqlJson("SET ROLE service_role; SELECT COALESCE((SELECT pg_catalog.jsonb_build_object("+
    "'id',t.id,'passengerId',t.passenger_id,'driverId',t.driver_id,"+
    "'vehicleId',t.vehicle_id,'status',t.status,'revision',t.revision,"+
    "'trackingSequence',0) FROM public.mobility_stage_auto_demo_trips t "+
    "WHERE t.id='"+tripId+"' AND t.passenger_id='"+passengerId+"'),"+
    "'null'::jsonb)::text;");
  },
  loadArrivalEvidence:async()=>{throw Error('Real GPS/Driver identity deliberately unavailable');}
 });
 // G99: Admin receives only private source SQL G75 after independently
 // simulated AAL2 IdP grant and revocation checks. This is disposable QA:
 // no externally certified MFA provider or installed Admin deployment.
 const adminSql=createG75AdminF1Repository({rpc});
 let adminSessionRevoked=false;
 const adminGateway=createG75AdminF1AuditGateway({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  projectRef:'staging1234567890abcd',now:Date.now,
  verifyAccessToken:async value=>{
   if(value!==adminToken)throw Error('Unverified Admin synthetic session');
   return {id:adminId,sessionId:adminSessionId,is_anonymous:false,
    email_confirmed_at:'2026-10-25T00:00:00Z',
    expiresAtMs:Date.now()+600000};
  },
  verifySessionNotRevoked:async x=>!adminSessionRevoked&&
   x.userId===adminId&&x.sessionId===adminSessionId,
  loadExclusiveBackofficeRole:async id=>{
   if(!uuid.test(id))throw Error('Invalid private Admin ID');
   const role=psql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_role_of('"+id+"')");
   return role===''?null:role;
  },
  verifyBackofficeMfa:async x=>({
   verifiedByProvider:true,userId:x.userId,sessionId:x.sessionId,
   assuranceLevel:'aal2',verifiedAtMs:Date.now()-1000,
   expiresAtMs:Date.now()+300000}),
  allowRequest:()=>true,
  loadAdminRideReceipt:x=>adminSql.read(x)
 });

 // G105: Driver is a distinct, server-verified actor reading the SAME
 // persistent G73 booking as Passenger and Admin. No fake assignment.
 const driverIdentity=async value=>{
  if(value!==driverToken)throw Error('G105 untrusted synthetic Driver token');
  return {id:driverId,is_anonymous:false,
   email_confirmed_at:'2026-10-26T00:00:00Z'};
 };
 const resolveDbRole=async id=>{
  if(!uuid.test(id))throw Error('Invalid SQL actor');
  const result=psql("SET ROLE service_role; SELECT CASE WHEN "+
   "count(*) FILTER (WHERE role='driver')=1 AND count(*)=1 THEN 'driver' "+
   "WHEN count(*) FILTER (WHERE role='passenger')=1 AND count(*)=1 THEN 'passenger' "+
   "ELSE 'none' END FROM public.user_roles WHERE user_id='"+id+"'");
  return result==='none'?null:result;
 };
 const driverStatus=createG65PrivateDriverTripStatusQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  verifyAccessToken:async value=>{
   const actor=await driverIdentity(value);
   const now=Date.now();
   return {id:actor.id,sessionId:driverSessionId,
    tokenIatMs:now-60000,expiresAtMs:now+600000,is_anonymous:false};
  },
  verifySessionNotRevoked:async ({userId,sessionId})=>
   userId===driverId&&sessionId===driverSessionId,
  resolveExclusiveRole:resolveDbRole,allowRequest:()=>true,
  loadAssignedTrip:async ({actorId,tripId})=>{
   if(!uuid.test(actorId)||!uuid.test(tripId))return null;
   // Query is constrained by BOTH original trip ID and SQL-assigned Driver.
   // No unassigned Passenger details reach the phone.
   return sqlJson("SET ROLE service_role; SELECT COALESCE((SELECT "+
    "pg_catalog.jsonb_build_object('tripId',t.id,'driverId',t.driver_id,"+
    "'vehicleId',t.vehicle_id,'passengerId',t.passenger_id,"+
    "'status',t.status,'revision',t.revision,'service',t.service) "+
    "FROM public.mobility_stage_auto_demo_trips t WHERE t.id='"+
    tripId+"' AND t.driver_id='"+actorId+"'),'null'::jsonb)::text;");
  }
 });
 // G106: restart recovery resolves ONLY server-verified Driver assignment
 // from the same durable G3 table; no client-provided trip ID or PII.
 const driverCurrent=createG106PrivateDriverCurrentTripQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  verifyAccessToken:async value=>{
   const actor=await driverIdentity(value);
   const now=Date.now();
   return {id:actor.id,sessionId:driverSessionId,
    tokenIatMs:now-60000,expiresAtMs:now+600000,is_anonymous:false};
  },
  verifySessionNotRevoked:async ({userId,sessionId})=>
   userId===driverId&&sessionId===driverSessionId,
  resolveExclusiveRole:resolveDbRole,allowRequest:()=>true,
  loadCurrentAssignedTrip:async ({actorId})=>{
   if(!uuid.test(actorId))return null;
   return sqlJson("SET ROLE service_role; SELECT COALESCE((SELECT "+
    "pg_catalog.jsonb_build_object('tripId',t.id,'driverId',t.driver_id,"+
    "'status',t.status,'revision',t.revision) FROM "+
    "public.mobility_stage_auto_demo_trips t WHERE t.driver_id='"+
    actorId+"' AND t.status IN ('accepted','arriving','in_progress') "+
    "LIMIT 1),'null'::jsonb)::text;");
  }
 });
 const tripCommands=createQoreTripCommandGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:driverIdentity,
  resolveRole:resolveDbRole,allowRequest:()=>true,
  requestTrip:async()=>{throw Error('G105 Driver cannot create Passenger booking');},
  transitionTrip:async ({actorId,tripId,event,eventKey})=>{
   if(![actorId,tripId,eventKey].every(x=>uuid.test(x)))
    throw Error('G105 invalid SQL actor/trip/event');
   const next={arrive:'arriving',pickup:'in_progress',complete:'completed'}[event];
   if(!next)throw Error('G105 forbidden transition');
   const eventId=psql("SET ROLE service_role; SELECT "+
    "public.mobility_stage_auto_demo_transition('"+tripId+"','"+
    actorId+"','"+next+"'::public.mobility_stage_trip_status,'"+
    eventKey+"')::text");
   return {ok:true,liveEnabled:false,eventId};
  }
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:rider,adminF1AuditHandler:adminGateway,
  offerHandler:noop,tripCommandHandler:tripCommands,
  driverTripStatusHandler:driverStatus,
  driverCurrentTripHandler:driverCurrent,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  f1AutoHandler:gateway
 });
 let base;
 try{
  base=await listenQoreRadarLoopback(server);
  const r=await http(base,f1+'/routes',{method:'POST',
   body:{quoteRequestKey:routeKey,origin:'Centro, Asunción',
    destination:'Aeropuerto, Asunción',service:'economico'}});
  assert.equal(r.status,200,JSON.stringify(r.data));
  assert.ok(uuid.test(r.data.routeId));
  const q=await http(base,f1+'/prequote',{method:'POST',
   body:{requestKey:quoteKey,routeId:r.data.routeId}});
  assert.equal(q.status,200,JSON.stringify(q.data));
  assert.ok(uuid.test(q.data.quoteId));
  assert.equal(q.data.currency,'PYG');
  assert.ok(q.data.amountGs>0);
  const preview=await http(base,f1+'/prequotes/'+q.data.quoteId+'/subsidy',
   {method:'POST'});
  assert.equal(preview.status,200,JSON.stringify(preview.data));
  assert.equal(preview.data.originalFareGs,q.data.amountGs);
  assert.equal(preview.data.commissionBps,1500);
  assert.equal(preview.data.subsidyBps,1000);
  assert.equal(preview.data.customerPaysGs,
   preview.data.driverReceivesGs+preview.data.platformRetainsGs);
  // G93 deliberately throws on foreign preview rather than revealing the
  // existence of another Passenger's quoted price. HTTP maps it to 503.
  const foreignQuote=await http(base,f1+'/prequotes/'+q.data.quoteId+'/subsidy',
   {method:'POST',auth:otherToken});
  assert.equal(foreignQuote.status,503);
  assert.doesNotMatch(JSON.stringify(foreignQuote.data),/amountGs|commission|subsidy|15200/);
  const booked=await http(base,f1+'/book',{method:'POST',
   body:{requestKey:bookingKey,quoteId:q.data.quoteId,accepted:true}});
  assert.equal(booked.status,201,JSON.stringify(booked.data));
  assert.ok(uuid.test(booked.data.tripId));
  const tripId=booked.data.tripId;
  // G104: full Driver assignment is NOT an authorized QA outcome.
  // G71 requires an independently attested eight-document dossier and
  // G38 blocks zones without real legal evidence. Do not weaken either.
  // Exercise the actual service-role offer RPC, not a mocked JavaScript gate.
  const candidateDriver='00000000-0000-4000-8000-000000000181';
  const candidateVehicle='00000000-0000-4000-8000-000000000184';
  const deniedOfferKey='98980000-0000-4989-8989-000000000025';
  assert.throws(()=>psql("SET ROLE service_role; SELECT "+
   "public.mobility_stage_auto_demo_offer('"+tripId+"',"+
   "'"+candidateDriver+"','"+candidateVehicle+"',"+
   "'"+deniedOfferKey+"',30)"),
   /KYC offer denied|Driver not eligible|G38|G36/i,
   'Unauthorized Driver offer must be refused by real PostgreSQL');
  const deniedState=sqlJson("SELECT pg_catalog.jsonb_build_object("+
   "'tripId',t.id,'tripState',t.status,'revision',t.revision,"+
   "'driverId',t.driver_id,'offers',"+
   "(SELECT count(*) FROM public.mobility_stage_auto_demo_offers o"+
   " WHERE o.trip_id=t.id))::text "+
   "FROM public.mobility_stage_auto_demo_trips t WHERE t.id='"+tripId+"'");
  assert.equal(deniedState.tripId,tripId);
  assert.equal(deniedState.tripState,'searching');
  assert.equal(deniedState.revision,1);
  assert.equal(deniedState.driverId,null);
  assert.equal(Number(deniedState.offers),0);
  // G106 crash recovery GET is scoped by SQL Driver and must show no
  // assignment for a just-booked but unaccepted (G38 fenced) Passenger trip.
  const recoveryPath='/v1/staging/driver/trips/current';
  const recoveredBefore=await http(base,recoveryPath,{auth:driverToken});
  assert.equal(recoveredBefore.status,200,JSON.stringify(recoveredBefore.data));
  assert.equal(recoveredBefore.data.activeTrip,null);
  assert.equal(recoveredBefore.data.liveTripsEnabled,false);
  assert.equal((await http(base,recoveryPath,{auth:token})).status,401);
  // G105 real HTTP -> Auth -> SQL: the Driver must NOT read/advance an
  // unassigned original trip. A forged tripId or client role is not proof.
  const driverTripPath='/v1/staging/driver/trips/'+tripId+'/status';
  assert.equal((await http(base,driverTripPath,{auth:driverToken})).status,404);
  assert.equal((await http(base,driverTripPath,{auth:token})).status,401);
  const driverTransitionPath='/v1/staging/trips/'+tripId+'/transition';
  const illegalAdvance=await http(base,driverTransitionPath,{
   method:'POST',auth:driverToken,
   body:{event:'arrive',eventKey:forgedDriverTransitionKey}});
  assert.equal(illegalAdvance.status,409,JSON.stringify(illegalAdvance.data));
  assert.doesNotMatch(JSON.stringify(illegalAdvance.data),
   /passengerId|originTag|destinationTag|driverId|vehicleId/);
  assert.equal((await http(base,driverTransitionPath,{
   method:'POST',auth:driverToken,
   body:{event:'arrive',eventKey:forgedDriverTransitionKey,
    driverId,vehicleId:candidateVehicle}})).status,400);
  const deniedAfterAdvance=sqlJson("SELECT pg_catalog.jsonb_build_object("+
   "'tripState',t.status,'revision',t.revision,'driverId',t.driver_id,"+
   "'events',(SELECT count(*) FROM public.mobility_stage_auto_demo_events e"+
   " WHERE e.trip_id=t.id))::text "+
   "FROM public.mobility_stage_auto_demo_trips t WHERE t.id='"+tripId+"'");
  assert.equal(deniedAfterAdvance.tripState,'searching');
  assert.equal(deniedAfterAdvance.revision,1);
  assert.equal(deniedAfterAdvance.driverId,null);
  assert.equal(Number(deniedAfterAdvance.events),0);

  // Two distinct HTTP clients read exactly the same G73 -> G3 trip.
  const riderBefore=await http(base,
   '/v1/staging/rider/trips/'+tripId+'/status');
  assert.equal(riderBefore.status,200,JSON.stringify(riderBefore.data));
  assert.equal(riderBefore.data.tripId,tripId);
  assert.equal(riderBefore.data.state,'searching');
  assert.equal(riderBefore.data.revision,1);
  assert.equal(riderBefore.data.driver,null);
  assert.equal(riderBefore.data.location,null);
  const adminPath='/v1/staging/admin/rides/'+tripId+'/f1-verification';
  const adminBefore=await http(base,adminPath,{auth:adminToken});
  assert.equal(adminBefore.status,200,JSON.stringify(adminBefore.data));
  assert.equal(adminBefore.data.tripId,tripId);
  assert.equal(adminBefore.data.quoteId,q.data.quoteId);
  assert.equal(adminBefore.data.bookingRequestKey,bookingKey);
  assert.equal(adminBefore.data.status,riderBefore.data.state);
  assert.equal(adminBefore.data.revision,riderBefore.data.revision);
  assert.equal(adminBefore.data.passengerId,p);
  assert.equal(adminBefore.data.driverId,null);
  assert.equal(adminBefore.data.assignmentPersisted,false);
  assert.equal(adminBefore.data.amountGs,q.data.amountGs);
  assert.equal((await http(base,adminPath,{auth:token})).status,401);
  assert.equal((await http(base,
   '/v1/staging/rider/trips/'+tripId+'/status',{auth:otherToken})).status,404);
  const replay=await http(base,f1+'/bookings/'+bookingKey);
  assert.equal(replay.status,200,JSON.stringify(replay.data));
  assert.equal(replay.data.tripId,tripId);
  const reserved=await http(base,f1+'/bookings/'+bookingKey+'/financial-status');
  assert.equal(reserved.status,200,JSON.stringify(reserved.data));
  assert.equal(reserved.data.tripId,tripId);
  assert.equal(reserved.data.financialState,'RESERVED_QA');
  assert.equal(reserved.data.pspCollected,false);
  assert.equal(reserved.data.pspRefunded,false);
  const before=await http(base,f1+'/bookings/'+bookingKey+'/dispatch');
  assert.equal(before.status,200,JSON.stringify(before.data));
  assert.equal(before.data.tripId,tripId);
  assert.equal(before.data.tripState,'searching');
  assert.equal(before.data.dispatchState,'SEARCHING_DRIVER');
  assert.equal((await http(base,f1+'/bookings/'+bookingKey+'/financial-status',
   {auth:otherToken})).status,404);
  const canceled=await http(base,f1+'/bookings/'+bookingKey+'/cancel',{
   method:'POST',body:{requestKey:cancelKey,confirmed:true}});
  assert.equal(canceled.status,200,JSON.stringify(canceled.data));
  assert.equal(canceled.data.tripId,tripId);
  assert.equal(canceled.data.financialState,'VOIDED_QA');
  assert.equal(canceled.data.reversalEntriesBalanced,true);
  const recovered=await http(base,f1+'/bookings/'+bookingKey+'/cancellation');
  assert.equal(recovered.status,200,JSON.stringify(recovered.data));
  assert.deepEqual(recovered.data,canceled.data);
  const retry=await http(base,f1+'/bookings/'+bookingKey+'/cancel',{
   method:'POST',body:{requestKey:cancelKey,confirmed:true}});
  assert.equal(retry.status,200,JSON.stringify(retry.data));
  assert.deepEqual(retry.data,canceled.data);
  const voided=await http(base,f1+'/bookings/'+bookingKey+'/financial-status');
  assert.equal(voided.status,200,JSON.stringify(voided.data));
  assert.equal(voided.data.tripId,tripId);
  assert.equal(voided.data.tripState,'cancelled');
  assert.equal(voided.data.financialState,'VOIDED_QA');
  assert.equal(voided.data.reversalEntriesBalanced,true);
  assert.equal(voided.data.pspCollected,false);
  assert.equal(voided.data.pspRefunded,false);
  const closed=await http(base,f1+'/bookings/'+bookingKey+'/dispatch');
  assert.equal(closed.status,200,JSON.stringify(closed.data));
  assert.equal(closed.data.tripId,tripId);
  assert.equal(closed.data.dispatchState,'CLOSED');
  assert.equal(closed.data.offerPendingAcceptance,false);
  const riderAfter=await http(base,
   '/v1/staging/rider/trips/'+tripId+'/status');
  assert.equal(riderAfter.status,200,JSON.stringify(riderAfter.data));
  assert.equal(riderAfter.data.tripId,tripId);
  assert.equal(riderAfter.data.state,'cancelled');
  assert.equal(riderAfter.data.revision,2);
  assert.equal(riderAfter.data.driver,null);
  // An app restart cannot rediscover a canceled trip as active.
  const recoveredAfter=await http(base,recoveryPath,{auth:driverToken});
  assert.equal(recoveredAfter.status,200,JSON.stringify(recoveredAfter.data));
  assert.equal(recoveredAfter.data.activeTrip,null);
  // Driver cannot resurrect a canceled Passenger trip after G95 SQL commit.
  assert.equal((await http(base,driverTripPath,{auth:driverToken})).status,404);
  assert.equal((await http(base,driverTransitionPath,{
   method:'POST',auth:driverToken,
   body:{event:'arrive',eventKey:forgedDriverTransitionKey}})).status,409);

  const adminAfter=await http(base,adminPath,{auth:adminToken});
  assert.equal(adminAfter.status,200,JSON.stringify(adminAfter.data));
  assert.equal(adminAfter.data.tripId,tripId);
  assert.equal(adminAfter.data.status,riderAfter.data.state);
  assert.equal(adminAfter.data.revision,riderAfter.data.revision);
  assert.equal(adminAfter.data.driverId,null);
  assert.equal(adminAfter.data.assignmentPersisted,false);
  // Provider revocation and stored backoffice suspension must both deny reads.
  adminSessionRevoked=true;
  assert.equal((await http(base,adminPath,{auth:adminToken})).status,401);
  adminSessionRevoked=false;
  psql("UPDATE public.mobility_stage_backoffice_roles SET status='suspended',"+
   "revision=revision+1 WHERE user_id='"+adminId+"'");
  assert.equal((await http(base,adminPath,{auth:adminToken})).status,403);
  assert.equal((await http(base,f1+'/bookings/'+bookingKey+'/cancellation',
   {auth:otherToken})).status,404);
  assert.equal((await http(base,f1+'/bookings/'+bookingKey+'/cancel',
   {method:'POST',body:{requestKey:quoteKey,confirmed:true}})).status,503);
  const ledger=sqlJson("SELECT pg_catalog.jsonb_build_object("+
   "'tripId',t.id,'tripState',t.status,'revision',t.revision,"+
   "'cancelEvents',(SELECT count(*) FROM public.mobility_stage_auto_demo_events e WHERE e.trip_id=t.id AND e.next_status='cancelled'),"+
   "'voids',(SELECT count(*) FROM public.mobility_stage_g94_auto_voids v WHERE v.trip_id=t.id),"+
   "'offsets',(SELECT count(*) FROM public.mobility_stage_g94_auto_void_entries e JOIN public.mobility_stage_g94_auto_voids v ON v.quote_id=e.quote_id WHERE v.trip_id=t.id),"+
   "'queueState',(SELECT status FROM public.mobility_stage_g85_auto_dispatch_jobs j WHERE j.trip_id=t.id),"+
   "'outstandingOffers',(SELECT count(*) FROM public.mobility_stage_auto_demo_offers o WHERE o.trip_id=t.id AND o.status='offered'))::text "+
   "FROM public.mobility_stage_auto_demo_trips t WHERE t.id='"+tripId+"'");
  assert.equal(ledger.tripId,tripId);
  assert.equal(ledger.tripState,'cancelled');
  assert.equal(Number(ledger.cancelEvents),1);
  assert.equal(Number(ledger.voids),1);
  assert.equal(Number(ledger.offsets),4);
  assert.equal(ledger.queueState,'CLOSED');
  assert.equal(Number(ledger.outstandingOffers),0);
  console.log('G106 PASS: Driver current-trip recovery uses verified Auth and same real PostgreSQL; empty before/after cancellation, forbidden to Passenger');
  console.log('G105 PASS: Driver HTTP/Auth/real PostgreSQL denies forged advancement of the same G73 trip before and after G95 cancellation; zero assignment/forged events');
  console.log('G99 PASS: REAL local HTTP+PostgreSQL16 same G73 trip across Client+Admin before/after G95 cancellation; 4 G94 void entries, G96 dispatch CLOSED, Passenger privacy, Admin MFA/revocation QA, NO PSP / NO LIVE');
 }finally{
  if(server.listening)await new Promise((resolve,reject)=>
   server.close(err=>err?reject(err):resolve()));
 }
}
await main();
