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
 console.log('G169 PASS: original G119 MOTO SQL booking -> G169 own Driver GET -> same completed trip/revision; foreign/rejected/terminal transition denied, no legal acceptance fabricated, no PII/PSP/GPS/LIVE.');
}finally{await new Promise(resolve=>server.close(resolve));}
