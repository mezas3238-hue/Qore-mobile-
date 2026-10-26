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
import {createQoreOfferGateway} from './g4-offer-gateway.mjs';
import {createQoreTripCommandGateway} from './g4-trip-command-gateway.mjs';
import {createG65PrivateDriverTripStatusQa} from './g65-driver-trip-status-qa.mjs';
import {createDriverPrivateInboxGateway} from './g16-driver-private-inbox-gateway.mjs';

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
const campaign='98980000-0000-4989-8989-000000000020';
const routeKey='98980000-0000-4989-8989-000000000010';
const quoteKey='98980000-0000-4989-8989-000000000011';
const bookingKey='98980000-0000-4989-8989-000000000012';
const cancelKey='98980000-0000-4989-8989-000000000013';
const token='g98-verified-qa-session-'+p.replaceAll('-','');
const otherToken='g98-verified-qa-session-'+outsider.replaceAll('-','');
const adminToken='g99-admin-aal2-qa-'+adminId.replaceAll('-','');
const f1='/v1/staging/rider/auto';
// Dedicated G104 synthetic Driver: no real identity, map, phone or payments.
const drv='98980000-0000-4989-8989-000000000006';
const veh='98980000-0000-4989-8989-000000000007';
const drvSess='98980000-0000-4989-8989-000000000008';
const drvToken='g104-driver-synthetic-'+drv.replaceAll('-','');
const newIds={
 route:'98980000-0000-4989-8989-000000000016',
 quote:'98980000-0000-4989-8989-000000000017',
 book:'98980000-0000-4989-8989-000000000018',
 offer:'98980000-0000-4989-8989-000000000019',
 accept:'98980000-0000-4989-8989-000000000021',
 arrive:'98980000-0000-4989-8989-000000000022',
 pickup:'98980000-0000-4989-8989-000000000023',
 complete:'98980000-0000-4989-8989-000000000024'
};
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
  "INSERT INTO auth.users(id) VALUES ('"+p+"'),('"+owner+"'),('"+outsider+"'),('"+adminId+"');"+
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
 // A real G2/G17/G20 preflight, but every Driver fixture is fictitious.
 psql("INSERT INTO auth.users(id) VALUES('"+drv+"');"+
  "DELETE FROM public.user_roles WHERE user_id='"+drv+"';"+
  "INSERT INTO public.user_roles(user_id,role) VALUES('"+drv+"','driver');"+
  "INSERT INTO public.mobility_vehicles"+
  "(id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,"+
  "plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status)"+
  " VALUES('"+veh+"','"+drv+"','AUTO','economico','PY',"+
  "'ASUNCION','G104QA1','DEMO','SEDAN',2024,4,'approved');"+
  "INSERT INTO public.mobility_driver_compliance"+
  "(driver_id,license_class,license_valid_through,license_verified_at,"+
  "license_verified_by,driver_review_status) VALUES('"+drv+"','B',"+
  "CURRENT_DATE+90,clock_timestamp()-interval '1 day',"+
  "'00000000-0000-4000-8000-000000000101','approved');"+
  "INSERT INTO public.mobility_vehicle_compliance"+
  "(vehicle_id,registration_valid_through,registration_verified_at,"+
  "insurance_valid_through,insurance_verified_at,paid_passenger_insurance_covered,"+
  "inspection_valid_through,inspection_verified_at,"+
  "municipal_authorization_valid_through,municipal_authorization_verified_at,"+
  "reviewed_by,reviewed_at) VALUES('"+veh+"',"+
  "CURRENT_DATE+90,clock_timestamp()-interval '1 day',"+
  "CURRENT_DATE+90,clock_timestamp()-interval '1 day',true,"+
  "CURRENT_DATE+90,clock_timestamp()-interval '1 day',"+
  "CURRENT_DATE+90,clock_timestamp()-interval '1 day',"+
  "'00000000-0000-4000-8000-000000000101',clock_timestamp()-interval '2 minutes');"+
  "INSERT INTO public.driver_locations(driver_id,available,lat,lng,updated_at)"+
  " VALUES('"+drv+"',true,-25.3,-57.57,clock_timestamp()-interval '5 seconds');"+
  "INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)"+
  " VALUES('"+drv+"',clock_timestamp()-interval '1 day');");
 psql("SET ROLE service_role; WITH d AS (SELECT "+
  "public.mobility_stage_register_driver_document('"+drv+"',"+
  "'98980000-0000-4989-8989-000000000026','licencia',"+
  "'"+drv+"/licencia-G104Qa1234567890.jpg',"+
  "'image/jpeg',9200,repeat('e',64)) AS id)"+
  " SELECT public.mobility_stage_review_driver_document(d.id,"+
  "'00000000-0000-4000-8000-000000000101',true,'DOCUMENT_VALID',"+
  "'98980000-0000-4989-8989-000000000027') FROM d;");
 assert.equal(psql("SET ROLE service_role; SELECT public.mobility_vehicle_preflight("+
  "'"+drv+"','"+veh+"','economico')::text"),'true');
 const verifyDriver=async value=>{
  if(value!==drvToken)throw Error('Only fixture Driver token allowed');
  return {id:drv,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'};
 };
 const driverTrip=createG65PrivateDriverTripStatusQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  verifyAccessToken:async value=>{
   const u=await verifyDriver(value);
   return {id:u.id,sessionId:drvSess,is_anonymous:false,
    tokenIatMs:Date.now()-1000,expiresAtMs:Date.now()+120000};
  },
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async id=>id===drv?'driver':null,
  allowRequest:()=>true,
  loadAssignedTrip:async({actorId,tripId})=>{
   if(actorId!==drv||!uuid.test(tripId))return null;
   return sqlJson("SET ROLE service_role; SELECT COALESCE((SELECT "+
    "jsonb_build_object('tripId',t.id,'driverId',t.driver_id,"+
    "'vehicleId',t.vehicle_id,'passengerId',t.passenger_id,"+
    "'status',t.status,'revision',t.revision,'service',t.service)"+
    " FROM public.mobility_stage_auto_demo_trips t WHERE t.id='"+tripId+"'"+
    " AND t.driver_id='"+drv+"'),'null'::jsonb)::text;");
  }
 });
 const driverOffer=createQoreOfferGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:verifyDriver,
  authorizeDriver:async id=>id===drv,allowRequest:()=>true,
  loadOfferForDriver:async({driverId,offerId})=>{
   if(driverId!==drv||!uuid.test(offerId))return null;
   return sqlJson("SET ROLE service_role; SELECT COALESCE((SELECT "+
    "jsonb_build_object('offerId',o.id,'driverId',o.driver_id,"+
    "'tripId',o.trip_id,'status',o.status,"+
    "'expiresAtMs',(extract(epoch from o.expires_at)*1000)::bigint,"+
    "'service',t.service,'originTag',t.origin_tag,"+
    "'destinationTag',t.destination_tag)"+
    " FROM public.mobility_stage_auto_demo_offers o"+
    " JOIN public.mobility_stage_auto_demo_trips t ON t.id=o.trip_id"+
    " WHERE o.id='"+offerId+"' AND o.driver_id='"+drv+"'),"+
    "'null'::jsonb)::text;");
  },
  acceptOffer:async x=>psql("SET ROLE service_role; SELECT "+
   "public.mobility_stage_auto_demo_accept_offer('"+x._offer_id+"',"+
   "'"+x._driver_id+"','"+x._decision_key+"')"),
  declineOffer:async()=>{throw Error('Not used in G104');}
 });
 const driverInbox=createDriverPrivateInboxGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:verifyDriver,
  authorizeDriver:async id=>id===drv,allowRequest:()=>true,
  listForDriver:async({driverId})=>{
   if(driverId!==drv)throw Error('Foreign Driver');
   const offers=sqlJson("SET ROLE service_role; SELECT COALESCE("+
    "jsonb_agg(jsonb_build_object('kind','AUTO_RIDE',"+
    "'offerId',q.offer_id,'serviceId',q.trip_id,"+
    "'expiresAtMs',(extract(epoch from q.expires_at)*1000)::bigint)),"+
    "'[]'::jsonb)::text FROM public.mobility_stage_poll_driver_auto_offers("+
    "'"+drv+"') q;");
   return {ok:true,liveEnabled:false,offers};
  }
 });
 const driverCommand=createQoreTripCommandGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:verifyDriver,
  resolveRole:async id=>id===drv?'driver':null,allowRequest:()=>true,
  requestTrip:async()=>{throw Error('Passenger must use G73 PG booking');},
  transitionTrip:async({actorId,tripId,event,eventKey})=>{
   const next={arrive:'arriving',pickup:'in_progress',complete:'completed'}[event];
   if(actorId!==drv||!uuid.test(tripId)||!uuid.test(eventKey)||!next)
    throw Error('Wrong actor or event');
   const eventId=psql("SET ROLE service_role; SELECT "+
    "public.mobility_stage_auto_demo_transition('"+tripId+"',"+
    "'"+drv+"','"+next+"'::public.mobility_stage_trip_status,"+
    "'"+eventKey+"')");
   return {ok:true,liveEnabled:false,eventId};
  }
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:rider,adminF1AuditHandler:adminGateway,
  offerHandler:driverOffer,tripCommandHandler:driverCommand,
  driverInboxHandler:driverInbox,driverTripStatusHandler:driverTrip,
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
  const adminAfter=await http(base,adminPath,{auth:adminToken});
  assert.equal(adminAfter.status,200,JSON.stringify(adminAfter.data));
  assert.equal(adminAfter.data.tripId,tripId);
  assert.equal(adminAfter.data.status,riderAfter.data.state);
  assert.equal(adminAfter.data.revision,riderAfter.data.revision);
  assert.equal(adminAfter.data.driverId,null);
  assert.equal(adminAfter.data.assignmentPersisted,false);
  // G104: same persisted AUTO trip from passenger booking through Driver
  // acceptance + all three transitions, with both Client and Admin verifying.
  const route2=await http(base,f1+'/routes',{method:'POST',
   body:{quoteRequestKey:newIds.route,origin:'Centro, Asunción',
    destination:'Aeropuerto, Asunción',service:'economico'}});
  assert.equal(route2.status,200,JSON.stringify(route2.data));
  const quote2=await http(base,f1+'/prequote',{method:'POST',
   body:{requestKey:newIds.quote,routeId:route2.data.routeId}});
  assert.equal(quote2.status,200,JSON.stringify(quote2.data));
  const subsidy2=await http(base,f1+'/prequotes/'+quote2.data.quoteId+'/subsidy',
   {method:'POST'});
  assert.equal(subsidy2.status,200,JSON.stringify(subsidy2.data));
  assert.equal(subsidy2.data.commissionBps,1500);
  assert.equal(subsidy2.data.subsidyBps,1000);
  const booked2=await http(base,f1+'/book',{method:'POST',
   body:{requestKey:newIds.book,quoteId:quote2.data.quoteId,accepted:true}});
  assert.equal(booked2.status,201,JSON.stringify(booked2.data));
  const secondTrip=booked2.data.tripId;
  assert.ok(uuid.test(secondTrip)&&secondTrip!==tripId);
  assert.equal((await http(base,'/v1/staging/driver/trips/'+secondTrip+'/status',
   {auth:drvToken})).status,404);
  assert.equal((await http(base,'/v1/staging/driver/inbox',
   {auth:token})).status,401);
  const offerId=psql("SET ROLE service_role; SELECT "+
   "public.mobility_stage_auto_demo_offer('"+secondTrip+"','"+drv+"',"+
   "'"+veh+"','"+newIds.offer+"',30)");
  assert.ok(uuid.test(offerId));
  const inbox=await http(base,'/v1/staging/driver/inbox',{auth:drvToken});
  assert.equal(inbox.status,200,JSON.stringify(inbox.data));
  assert.ok(inbox.data.offers.some(x=>x.offerId===offerId&&x.serviceId===secondTrip));
  const received=await http(base,'/v1/staging/driver/offers/'+offerId,
   {auth:drvToken});
  assert.equal(received.status,200,JSON.stringify(received.data));
  assert.equal(received.data.tripId,secondTrip);
  assert.equal((await http(base,'/v1/staging/driver/offers/accept',{
   method:'POST',auth:token,body:{offerId,requestKey:newIds.accept}
  })).status,401);
  const a=await http(base,'/v1/staging/driver/offers/accept',{
   method:'POST',auth:drvToken,body:{offerId,requestKey:newIds.accept}});
  assert.equal(a.status,200,JSON.stringify(a.data));
  assert.equal(a.data.outcome,'accepted');
  const replay=await http(base,'/v1/staging/driver/offers/accept',{
   method:'POST',auth:drvToken,body:{offerId,requestKey:newIds.accept}});
  assert.equal(replay.status,200,JSON.stringify(replay.data));
  assert.equal(replay.data.eventId,a.data.eventId);
  const assigned=await http(base,'/v1/staging/rider/trips/'+secondTrip+'/status');
  assert.equal(assigned.status,200);
  assert.equal(assigned.data.state,'assigned');
  assert.equal(assigned.data.revision,2);
  assert.equal(assigned.data.assignmentPersisted,true);
  assert.equal(assigned.data.driver,null);
  assert.equal(assigned.data.location,null);
  const adminSecond='/v1/staging/admin/rides/'+secondTrip+'/f1-verification';
  const admAccepted=await http(base,adminSecond,{auth:adminToken});
  assert.equal(admAccepted.status,200,JSON.stringify(admAccepted.data));
  assert.equal(admAccepted.data.driverId,drv);
  assert.equal(admAccepted.data.status,'accepted');
  assert.equal(admAccepted.data.amountGs,quote2.data.amountGs);
  for(const [i,event,next] of [
   [0,'arrive','arriving'],[1,'pickup','in_progress'],[2,'complete','completed']
  ]){
   const changed=await http(base,'/v1/staging/trips/'+secondTrip+'/transition',{
    method:'POST',auth:drvToken,body:{event,eventKey:newIds[event]}});
   assert.equal(changed.status,200,JSON.stringify(changed.data));
   const driver=await http(base,'/v1/staging/driver/trips/'+secondTrip+'/status',
    {auth:drvToken});
   const client=await http(base,'/v1/staging/rider/trips/'+secondTrip+'/status');
   const admin=await http(base,adminSecond,{auth:adminToken});
   assert.equal(driver.status,200);
   assert.equal(client.status,200);
   assert.equal(admin.status,200);
   assert.equal(driver.data.state,next);
   assert.equal(client.data.state,next);
   assert.equal(admin.data.status,next);
   assert.equal(driver.data.revision,i+3);
   assert.equal(client.data.revision,i+3);
   assert.equal(admin.data.revision,i+3);
   assert.equal(admin.data.driverId,drv);
   assert.equal(admin.data.tripId,secondTrip);
   assert.equal(client.data.location,null,'No GPS evidence exists');
  }
  const financial2=await http(base,f1+'/bookings/'+newIds.book+'/financial-status');
  assert.equal(financial2.status,200,JSON.stringify(financial2.data));
  assert.equal(financial2.data.tripId,secondTrip);
  assert.equal(financial2.data.tripState,'completed');
  assert.equal(financial2.data.financialState,'COMPLETED_UNSETTLED_QA');
  assert.equal(financial2.data.pspCollected,false);
  assert.equal(financial2.data.pspRefunded,false);
  const dbTrip=sqlJson("SET ROLE service_role; SELECT "+
   "jsonb_build_object('tripId',t.id,'state',t.status,'revision',t.revision,"+
   "'driverId',t.driver_id,'events',(SELECT count(*) "+
   "FROM public.mobility_stage_auto_demo_events e WHERE e.trip_id=t.id),"+
   "'acceptedOffers',(SELECT count(*) FROM public.mobility_stage_auto_demo_offers o"+
   " WHERE o.trip_id=t.id AND o.status='accepted'))::text"+
   " FROM public.mobility_stage_auto_demo_trips t WHERE t.id='"+secondTrip+"'");
  assert.equal(dbTrip.tripId,secondTrip);
  assert.equal(dbTrip.state,'completed');
  assert.equal(dbTrip.revision,5);
  assert.equal(dbTrip.driverId,drv);
  assert.equal(Number(dbTrip.events),4);
  assert.equal(Number(dbTrip.acceptedOffers),1);
  console.log('G104 PASS: disposable PG16 booking -> Driver private inbox/accept -> 3 Driver state changes -> passenger/admin same trip/revision + G94 completed unsettled; NO real GPS or payments');
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
  console.log('G99 PASS: REAL local HTTP+PostgreSQL16 same G73 trip across Client+Admin before/after G95 cancellation; 4 G94 void entries, G96 dispatch CLOSED, Passenger privacy, Admin MFA/revocation QA, NO PSP / NO LIVE');
 }finally{
  if(server.listening)await new Promise((resolve,reject)=>
   server.close(err=>err?reject(err):resolve()));
 }
}
await main();
