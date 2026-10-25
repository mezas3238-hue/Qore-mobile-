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

if(process.env.PGHOST!=='localhost'||
 process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain'||
 !/^\d{4,5}$/.test(process.env.PGPORT??''))
 throw Error('G98 forbidden outside disposable localhost PostgreSQL16 CI');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const p='98980000-0000-4989-8989-000000000001';
const owner='98980000-0000-4989-8989-000000000002';
const outsider='98980000-0000-4989-8989-000000000003';
const campaign='98980000-0000-4989-8989-000000000020';
const routeKey='98980000-0000-4989-8989-000000000010';
const quoteKey='98980000-0000-4989-8989-000000000011';
const bookingKey='98980000-0000-4989-8989-000000000012';
const cancelKey='98980000-0000-4989-8989-000000000013';
const token='g98-verified-qa-session-'+p.replaceAll('-','');
const otherToken='g98-verified-qa-session-'+outsider.replaceAll('-','');
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
 mobility_stage_g95_cancel_receipt_qa:['_passenger_id','_booking_key']
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
  "INSERT INTO auth.users(id) VALUES ('"+p+"'),('"+owner+"'),('"+outsider+"');"+
  "DELETE FROM public.user_roles WHERE user_id='"+owner+"';"+
  "INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by) VALUES('"+owner+"','owner','active','"+owner+"');"+
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
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
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
  assert.equal((await http(base,f1+'/prequotes/'+q.data.quoteId+'/subsidy',
   {method:'POST',auth:otherToken})).status,404);
  const booked=await http(base,f1+'/book',{method:'POST',
   body:{requestKey:bookingKey,quoteId:q.data.quoteId,accepted:true}});
  assert.equal(booked.status,201,JSON.stringify(booked.data));
  assert.ok(uuid.test(booked.data.tripId));
  const tripId=booked.data.tripId;
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
  console.log('G98 PASS: REAL 127.0.0.1 HTTP -> real PostgreSQL16 G73/G93/G95/G94/G96; one trip, 4 voids, one cancellation, closed dispatch, actor isolation; NO PSP / NO LIVE');
 }finally{
  if(server.listening)await new Promise((resolve,reject)=>
   server.close(err=>err?reject(err):resolve()));
 }
}
await main();
