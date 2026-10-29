/**
 * G169 PG16 disposable-only integrated Driver MOTO read, AFTER G119's
 * explicitly QA-seeded preaccepted fixture has reached completed.
 * This cannot prove a legal offer or physical MOTO ride. The only
 * production-safe authority is G118 lawful offer+accept, which remains off.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createG169DriverMotoJourneyGateway} from './g169-driver-moto-journey-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G169 refuses non-disposable PostgreSQL target');
const driver='11900000-0000-4119-8119-000000000003';
const passenger='11900000-0000-4119-8119-000000000001';
const booking='11900000-0000-4119-8119-000000000020';
const activeToken='verified-moto-driver-169-abcdefghijklmnop';
const otherToken='verified-other-role-169-abcdefghijklmnop';
const pathname='/v1/staging/driver/moto/bookings/'+booking+'/status';
const now=1900000000000;
const sql=q=>execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',q],
 {encoding:'utf8',timeout:15000,maxBuffer:500000}).trim().split('\n').at(-1)?.trim()??'';
const raw=sql('SET ROLE service_role; SELECT public.'+
 "mobility_stage_g169_driver_moto_status_qa('"+driver+"','"+booking+"')::text");
const original=JSON.parse(raw);
assert.equal(original.serviceKind,'MOTO_RIDE');
assert.equal(original.tripState,'completed');
assert.equal(original.tripRevision,5);
assert.equal(original.driverId,driver);
assert.equal(sql('SET ROLE service_role; SELECT public.'+
 "mobility_stage_g169_driver_moto_status_qa('"+passenger+"','"+booking+"') IS NULL"),'t');
assert.equal(sql("SELECT has_function_privilege('service_role',"+
 "'public.mobility_stage_g169_driver_moto_status_qa(uuid,uuid)','EXECUTE')"),'t');
assert.equal(sql("SELECT has_function_privilege('authenticated',"+
 "'public.mobility_stage_g169_driver_moto_status_qa(uuid,uuid)','EXECUTE')"),'f');
let reads=0,steps=0;
const gateway=createG169DriverMotoJourneyGateway({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 now:()=>now,
 verifyAccessToken:async token=>token===activeToken||token===otherToken?{
  id:token===activeToken?driver:passenger,
  sessionId:'16900000-0000-4169-8169-000000000006',
  is_anonymous:false,expiresAtMs:now+600000
 }:Promise.reject(Error('Untrusted token')),
 verifySessionNotRevoked:async()=>true,
 resolveExclusiveRole:async id=>id===driver?'driver':'passenger',
 allowRequest:()=>true,
 readMoto:async({driverId,bookingKey})=>{
  reads++;
  if(!/^[0-9a-f-]{36}$/.test(driverId)||!/^[0-9a-f-]{36}$/.test(bookingKey))
   throw Error('G169 server-only parameters');
  const value=sql('SET ROLE service_role; SELECT public.'+
   "mobility_stage_g169_driver_moto_status_qa('"+driverId+"','"+bookingKey+"')::text");
  return value&&value!=='null'?JSON.parse(value):null;
 },
 readCurrentMoto:async({driverId})=>{
  const data=sql('SET ROLE service_role; SELECT public.'+
   "mobility_stage_g189_driver_moto_current_qa('"+driverId+"')::text");
  return data&&data!=='null'?JSON.parse(data):null;
 },
 advanceMoto:async()=>{steps++;throw Error('Never advance synthetic completed fixture');}
});
const noop=async()=>({status:404,body:{error:'Not found'}});
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
 driverMotoJourneyHandler:gateway
});
const base=await listenQoreRadarLoopback(server);
async function read(token=activeToken,method='GET',body){
 const response=await fetch(base+pathname.replace(/status$/i,
  method==='POST'?'advance':'status'),{
  method,headers:{authorization:'Bearer '+token,
   ...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 return {status:response.status,data:await response.json()};
}
try{
 const ok=await read();
 assert.equal(ok.status,200,JSON.stringify(ok.data));
 assert.equal(ok.data.tripId,original.tripId);
 assert.equal(ok.data.bookingKey,booking);
 assert.equal(ok.data.tripRevision,5);
 assert.equal(ok.data.nextState,null);
 assert.equal(ok.data.qaOnly,true);
 assert.equal(ok.data.gpsVerified,false);
 assert.equal(ok.data.pspCollected,false);
 assert(!JSON.stringify(ok.data).includes(passenger));
 assert.equal((await read(otherToken)).status,403);
 assert.equal((await read('untrusted-123')).status,401);
 assert.equal((await read(activeToken,'POST',{
  expectedRevision:4,nextState:'completed',
  commandKey:'16900000-0000-4169-8169-000000000005'
 })).status,409);
 assert.equal(steps,0);
 assert.equal(reads,2);
 // G188: the actual Driver C native HTTP decoder must read this EXACT
 // PostgreSQL G119 booking, not a copied fixture or a second trip. A
 // completed QA booking is not a new legally authorized MOTO acceptance.
 const {readDriverMotoJourney,advanceDriverMotoJourney}=await import(
  '../../movete-driver/src/domain/driver-moto-journey-http.mjs');
 const native=await readDriverMotoJourney({
  apiOrigin:base,bookingKey:booking,accessToken:activeToken,request:fetch
 });
 assert.equal(native.bookingKey,booking);
 assert.equal(native.tripId,original.tripId);
 assert.equal(native.status,'completed');
 assert.equal(native.revision,5);
 assert.equal(native.nextState,null);
 assert.equal(native.productionEnabled,false);
 assert.equal(native.qaOnly,true);
 assert(!JSON.stringify(native).includes(passenger));
 await assert.rejects(readDriverMotoJourney({
  apiOrigin:base,bookingKey:booking,accessToken:otherToken,request:fetch
 }),/unavailable/);
 // Native C cannot re-send the stale terminal command. G169 blocks it
 // transactionally and no SQL transition may be fabricated.
 await assert.rejects(advanceDriverMotoJourney({
  apiOrigin:base,bookingKey:booking,accessToken:activeToken,request:fetch,
  expectedRevision:4,nextState:'completed',
  commandKey:'16900000-0000-4169-8169-000000000008'
 }),/UNKNOWN/);
 assert.equal(steps,0,'Native Driver cannot advance a completed original MOTO booking');
 assert.equal(reads,4,'Native C reads original SQL once and stale POST is read-only at G169');
 // G189: real PG16 current owner lookup NEVER fabricates an accepted MOTO
 // service. In the terminal fixture the only active assignment is null.
 assert.equal(sql("SELECT has_function_privilege('service_role',"+
  "'public.mobility_stage_g189_driver_moto_current_qa(uuid)','EXECUTE')"),'t');
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+
  "'public.mobility_stage_g189_driver_moto_current_qa(uuid)','EXECUTE')"),'f');
 const {readCurrentDriverMoto}=await import(
  '../../movete-driver/src/domain/driver-moto-journey-http.mjs');
 const currentPath='/v1/staging/driver/moto/current';
 const getCurrent=async token=>{
  const response=await fetch(base+currentPath,{
   method:'GET',headers:{authorization:'Bearer '+token}
  });
  return {status:response.status,body:await response.json()};
 };
 const empty=await getCurrent(activeToken);
 assert.equal(empty.status,200);
 assert.equal(empty.body.activeBooking,null);
 assert.equal(await readCurrentDriverMoto({
  apiOrigin:base,accessToken:activeToken,request:fetch
 }),null);
 assert.equal((await getCurrent(otherToken)).status,403);
 assert.equal((await getCurrent('untrusted-123')).status,401);
 // An explicitly QA-seeded original completed fixture is temporarily
 // restored to its earlier accepted revision to prove the active-only owner
 // discovery through the REAL C module and REAL HTTP/SQL. This SQL edit
 // cannot authorize a new offer and is always reverted below.
 try{
  assert.equal(sql("UPDATE public.mobility_stage_g100_moto_trips "+
   "SET status='accepted',revision=2,completed_at=NULL "+
   "WHERE booking_key='"+booking+"' AND driver_id='"+driver+"' "+
   "AND status='completed'; SELECT COUNT(*) FROM "+
   "public.mobility_stage_g100_moto_trips WHERE booking_key='"+booking+
   "' AND status='accepted'"),'1');
  const current=await getCurrent(activeToken);
  assert.equal(current.status,200);
  assert.equal(current.body.activeBooking.bookingKey,booking);
  assert.equal(current.body.activeBooking.tripId,original.tripId);
  assert.equal(current.body.activeBooking.tripState,'accepted');
  assert.equal(current.body.activeBooking.tripRevision,2);
  assert(!JSON.stringify(current.body).includes(passenger));
  const resumed=await readCurrentDriverMoto({
   apiOrigin:base,accessToken:activeToken,request:fetch
  });
  assert.equal(resumed.bookingKey,booking);
  assert.equal(resumed.tripId,original.tripId);
  assert.equal(resumed.status,'accepted');
  const originalStatus=await readDriverMotoJourney({
   apiOrigin:base,bookingKey:booking,accessToken:activeToken,request:fetch
  });
  assert.equal(originalStatus.tripId,resumed.tripId);
  assert.equal(originalStatus.revision,resumed.revision);
 }finally{
  sql("UPDATE public.mobility_stage_g100_moto_trips "+
   "SET status='completed',revision=5,completed_at=pg_catalog.clock_timestamp() "+
   "WHERE booking_key='"+booking+"' AND driver_id='"+driver+"' "+
   "AND status='accepted'");
 }
 assert.equal((await getCurrent(activeToken)).body.activeBooking,null);
 assert.equal(sql("SELECT COUNT(*) FROM public.mobility_stage_g100_moto_trips "+
  "WHERE booking_key='"+booking+"'"),'1');
 console.log('G189 CROSS-APP PASS: C native current MOTO GET -> G169 revocable Driver HTTP -> G189 scoped PostgreSQL16 -> same G119 booking/revision; active-only, foreign denied, terminal null, NO synthetic new offer.');
 console.log('G188 CROSS-APP PASS: Driver native G169 HTTP contract reads same durable original completed PostgreSQL MOTO trip and fails closed on foreign or stale commands.');
 console.log('G169 PASS: original G119 MOTO SQL booking -> G169 own Driver GET -> same completed trip/revision; foreign/rejected/terminal transition denied, no legal acceptance fabricated, no PII/PSP/GPS/LIVE.');
}finally{await new Promise(resolve=>server.close(resolve));}
