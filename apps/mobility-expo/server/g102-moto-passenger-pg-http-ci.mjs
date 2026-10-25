/**
 * G102 CI ONLY: real authenticated loopback HTTP -> exact G100 MOTO
 * passenger PostgreSQL quote/book/cancel/reconcile functions.
 * Trusted route and Auth are synthetic QA adapters, explicitly NOT a
 * commercial Maps provider, insured Driver, PSP or deployment.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createG101MotoPassengerGateway,createG101MotoPassengerRepository}
 from './g101-moto-passenger-gateway.mjs';
if(process.env.PGHOST!=='localhost'||
 process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G102 disallows remote or persistent database connection');
const root='/v1/staging/rider/moto';
const p='10200000-0000-4102-8102-000000000001';
const owner='10200000-0000-4102-8102-000000000002';
const stranger='10200000-0000-4102-8102-000000000003';
const campaign='10200000-0000-4102-8102-000000000020';
const routeKey='10200000-0000-4102-8102-000000000010';
const bookingKey='10200000-0000-4102-8102-000000000012';
const cancelKey='10200000-0000-4102-8102-000000000013';
const token='qa-verified-moto-'+p.replaceAll('-','');
const foreignToken='qa-verified-moto-'+stranger.replaceAll('-','');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function sql(s){
 return execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',s],
 {timeout:18000,maxBuffer:4000000,encoding:'utf8'}).trim().split('\n').at(-1)?.trim()??'';
}
const accept=x=>typeof x==='string'&&
 (UUID.test(x)||/^[A-Z_]{3,40}$/.test(x));
async function rpc(name,args){
 const signature={
  mobility_stage_g100_moto_quote_qa:[
   '_passenger','_request','_origin','_destination','_zone','_distance','_seconds'],
  mobility_stage_g100_moto_book_qa:['_passenger','_quote','_booking'],
  mobility_stage_g100_moto_booking_receipt_qa:['_passenger','_booking'],
  mobility_stage_g100_moto_cancel_qa:['_passenger','_booking','_decision']
 };
 const keys=signature[name];
 if(!keys||Object.keys(args).length!==keys.length||
  !keys.every(k=>Object.hasOwn(args,k)))throw Error('Disallowed SQL RPC');
 const vals=keys.map(k=>{
  const v=args[k];
  if(Number.isSafeInteger(v)&&v>=0&&v<=100000000)return String(v);
  if(accept(v))return "'"+v+"'";
  throw Error('Unsafe private SQL input');
 }).join(',');
 const result=sql('SET ROLE service_role; SELECT public.'+name+'('+vals+')::text;');
 return {data:result===''?null:JSON.parse(result),error:null};
}
function fixture(){
 const guard=sql("SELECT (current_database()='qore_disposable_chain'"+
 " AND current_setting('application_name')='qore_ci_disposable_chain')::text");
 assert.equal(guard,'true');
 sql("INSERT INTO auth.users(id) VALUES ('"+p+"'),('"+owner+"'),('"+stranger+"');"+
  "DELETE FROM public.user_roles WHERE user_id='"+owner+"';"+
  "INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by) "+
  "VALUES('"+owner+"','owner','active','"+owner+"');"+
  "INSERT INTO public.mobility_stage_fare_rules(rule_key,mode,zone_tag,base_pyg,per_km_pyg,per_minute_pyg,minimum_pyg,commission_bps,valid_from,valid_until,active,approved_by,approved_at) VALUES"+
  "('G102_MOTO_HTTP_QA','MOTO','MOTO_TEST_ZONE',4000,1000,200,4000,1200,"+
  "clock_timestamp()-interval '1 hour',clock_timestamp()+interval '60 days',true,'"+owner+"',clock_timestamp()-interval '2 hours');"+
  "INSERT INTO public.mobility_stage_g93_ride_campaigns(id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)"+
  " VALUES('"+campaign+"','MOTO_RIDE','G102_MOTO_60D_QA','"+owner+"',true,"+
  "transaction_timestamp()-interval '1 hour',transaction_timestamp()-interval '1 hour'+interval '60 days',60);");
}
async function http(base,path,{method='GET',body,accessToken=token}={}){
 const r=await fetch(base+path,{method,
  headers:{authorization:'Bearer '+accessToken,
   ...(body===undefined?{}:{'content-type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error'});
 assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0');
 return {status:r.status,body:await r.json()};
}
const noop=async()=>({status:404,body:{error:'Not found'}});
async function main(){
 fixture();
 const repo=createG101MotoPassengerRepository({rpc});
 const gateway=createG101MotoPassengerGateway({
  projectRef:'staging1234567890abcd',now:Date.now,
  verifyAccessToken:async value=>{
   const id=value===token?p:value===foreignToken?stranger:null;
   if(!id)throw Error('Unknown synthetic IdP');
   return {id,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'};
  },
  authorizePassenger:async id=>id===p||id===stranger,allowRequest:()=>true,
  resolveVerifiedMotoRoute:async({service})=>{
   assert.equal(service,'moto_pasajero');
   // Test-only route proof. No external provider or real motorcycle zone.
   return {routingVerified:true,coverageVerified:true,trafficAware:true,
    fallbackUsed:false,originTag:'CENTRO_FIXTURE',destinationTag:'AEROPUERTO',
    zoneTag:'MOTO_TEST_ZONE',distanceMeters:5000,durationSeconds:600};
  },repository:repo
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  motoHandler:gateway
 });
 try{
  const base=await listenQoreRadarLoopback(server);
  const quote=await http(base,root+'/quotes',{method:'POST',
   body:{requestKey:routeKey,origin:'Centro Asuncion',destination:'Aeropuerto Asuncion'}});
  assert.equal(quote.status,200,JSON.stringify(quote.body));
  assert.equal(quote.body.serviceKind,'MOTO_RIDE');
  assert.equal(quote.body.amountGs,11000);
  assert.equal(quote.body.commissionBps,1200);
  assert.equal(quote.body.subsidyBps,1000);
  assert.equal(quote.body.customerPaysGs,9900);
  assert.equal(quote.body.driverReceivesGs,9680);
  assert.equal(quote.body.platformRetainsGs,220);
  const booking=await http(base,root+'/book',{method:'POST',body:{
   requestKey:bookingKey,quoteId:quote.body.quoteId,accepted:true}});
  assert.equal(booking.status,201,JSON.stringify(booking.body));
  assert.equal(booking.body.service,'moto_pasajero');
  assert.equal(booking.body.tripState,'searching');
  assert.equal(booking.body.financialState,'RESERVED_QA');
  assert.equal(booking.body.driverAssigned,false);
  assert.ok(UUID.test(booking.body.tripId));
  const read=await http(base,root+'/bookings/'+bookingKey);
  assert.deepEqual(read.body,booking.body);
  assert.equal((await http(base,root+'/bookings/'+bookingKey,
   {accessToken:foreignToken})).status,404);
  const cancel=await http(base,root+'/bookings/'+bookingKey+'/cancel',
   {method:'POST',body:{requestKey:cancelKey,confirmed:true}});
  assert.equal(cancel.status,200,JSON.stringify(cancel.body));
  assert.equal(cancel.body.tripId,booking.body.tripId);
  assert.equal(cancel.body.financialState,'VOIDED_QA');
  assert.equal(cancel.body.reversalEntriesBalanced,true);
  assert.equal(cancel.body.pspRefunded,false);
  assert.deepEqual((await http(base,root+'/bookings/'+bookingKey+'/cancellation')).body,cancel.body);
  assert.deepEqual((await http(base,root+'/bookings/'+bookingKey+'/cancel',
   {method:'POST',body:{requestKey:cancelKey,confirmed:true}})).body,cancel.body);
  assert.equal((await http(base,root+'/bookings/'+bookingKey+'/cancel',
   {method:'POST',body:{requestKey:routeKey,confirmed:true}})).status,503);
  const check=JSON.parse(sql(
   "SELECT jsonb_build_object('motoTrips',(SELECT count(*) FROM public.mobility_stage_g100_moto_trips t WHERE t.id='"+booking.body.tripId+"'),"+
   "'reserve',(SELECT count(*) FROM public.mobility_stage_g100_moto_entries e WHERE e.quote_id='"+quote.body.quoteId+"' AND phase='reserve'),"+
   "'reverse',(SELECT count(*) FROM public.mobility_stage_g100_moto_entries e WHERE e.quote_id='"+quote.body.quoteId+"' AND phase='reverse'),"+
   "'auto',(SELECT count(*) FROM public.mobility_stage_auto_demo_trips WHERE passenger_id='"+p+"'),"+
   "'delivery',(SELECT count(*) FROM public.mobility_stage_deliveries WHERE sender_id='"+p+"'))::text"));
  assert.deepEqual(check,{motoTrips:1,reserve:4,reverse:4,auto:0,delivery:0});
  console.log('G102 PASS: real PG16 MOTO Passenger quoted -> booked -> cancellation and 4+4 money entries via localhost HTTP; same trip, 12/10/2 %, no AUTO/ENVÍOS crossover, no PSP, no Driver assignment');
 }finally{
  if(server.listening)await new Promise((resolve,reject)=>
   server.close(error=>error?reject(error):resolve()));
 }
}
await main();
