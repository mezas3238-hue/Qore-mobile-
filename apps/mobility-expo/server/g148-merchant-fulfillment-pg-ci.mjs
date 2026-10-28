/**
 * G148 QA operational path: ORIGINAL B Client G139 stock reservation ->
 * authenticated Merchant staff G6 HTTP confirms, prepares and marks ready ->
 * A/G146 source SQL -> D Admin reads SAME orderId and append-only events.
 * G42 is checked twice, including within the G6 mutation SQL statement.
 * No deliveries, legal driver, payment, LIVE, merchant mobile app or PSP.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreMerchantOrderGateway} from './g6-merchant-order-gateway.mjs';
import {createG146AdminCommerceTraceGateway} from './g146-admin-commerce-trace-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {createServiceTraceGateway} from '../../movete-admin/src/service-trace-gateway.mjs';
import {createServiceTraceIntegrityFence} from '../../movete-admin/src/service-trace-integrity-fence.mjs';

if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G148 is confined to disposable CI PG16 only');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const owner='13800000-0000-4138-8138-000000000002';
const merchant='13800000-0000-4138-8138-000000000020';
const item='13800000-0000-4138-8138-000000000040';
const key='13800000-0000-4138-8138-000000000242';
const admin='14600000-0000-4146-8146-000000000002';
const sellerSession='14800000-0000-4148-8148-000000000001';
const adminSession='14800000-0000-4148-8148-000000000002';
const sellerToken='g148-verified-seller-mfa-private-token-000000000001';
const adminToken='g148-private-verified-admin-token-00000000000002';
const at=Date.now(),sellerIat=at-60000;
const qs=x=>"'"+x+"'";
function sql(statement){
 return execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',statement],{
  encoding:'utf8',timeout:15000,maxBuffer:1000000,stdio:['ignore','pipe','pipe']
 }).trim().split('\n').at(-1)?.trim()??'';
}
const read=x=>JSON.parse(sql(x));
assert.equal(sql("SELECT (current_database()='qore_disposable_chain' AND current_setting('application_name')='qore_ci_disposable_chain')::text"),'true');
const saved=read("SELECT jsonb_build_object('id',o.id,'key',r.request_key,"+
 "'branchId',o.branch_id,'vehicle',o.requested_vehicle_kind,'subtotal',o.subtotal_pyg,'status',o.status,'revision',o.revision) "+
 "FROM public.mobility_stage_merchant_orders o JOIN public.mobility_stage_g45_order_receipts r ON r.order_id=o.id "+
 "WHERE r.request_key="+qs(key));
assert(UUID.test(saved.id)&&UUID.test(saved.branchId));
assert.equal(saved.vehicle,'MOTO');assert.equal(saved.subtotal,25000);
assert.equal(saved.status,'requested');assert.equal(saved.revision,1);
const orderId=saved.id;
assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+qs(item)),'1');
sql("INSERT INTO public.mobility_stage_merchant_staff(merchant_id,user_id,staff_role,active) "+
 "VALUES ("+qs(merchant)+","+qs(owner)+",'manager',true) ON CONFLICT DO NOTHING");
sql("INSERT INTO public.mobility_stage_g42_provider_session_grants("+
 "user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind) "+
 "VALUES ("+qs(owner)+","+qs(sellerSession)+",clock_timestamp()-interval '1 hour',"+
 "clock_timestamp()-interval '2 minutes',clock_timestamp()+interval '1 hour',"+
 "'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')");
const active=()=>sql("SELECT public.mobility_stage_g42_session_active("+
 qs(owner)+","+qs(sellerSession)+","+sellerIat+")::text")==='true';

const merchantGateway=createQoreMerchantOrderGateway({
 projectRef:'staging1234567890abcd',
 verifyAccessToken:async token=>{
  if(token!==sellerToken||!active())throw Error('G42 provider session absent or revoked');
  return {id:owner,is_anonymous:false,email_confirmed_at:'2026-10-28T00:00:00Z'};
 },
 authorizeBuyer:async()=>false,
 authorizeMerchantOrder:async({actorId,orderId:requested})=>
  sql("SELECT EXISTS(SELECT 1 FROM public.mobility_stage_merchant_orders o "+
   "JOIN public.mobility_stage_merchant_staff s ON s.merchant_id=o.merchant_id "+
   "WHERE o.id="+qs(requested)+" AND s.user_id="+qs(actorId)+
   " AND s.active)::text")==='true',
 allowRequest:()=>true,
 requestOrder:async()=>{throw Error('G148 does not issue Buyer bookings');},
 transitionOrder:async({actorId,orderId:target,event,eventKey})=>{
  if(actorId!==owner||!UUID.test(target)||!UUID.test(eventKey)||
   !['confirm','start_preparing','ready'].includes(event))
   throw Error('G148 invalid seller transition');
  const result=sql("SELECT CASE WHEN public.mobility_stage_g42_lock_session("+
   qs(owner)+","+qs(sellerSession)+","+sellerIat+") THEN "+
   "public.mobility_stage_merchant_order_transition("+
    qs(target)+","+qs(actorId)+","+qs(event)+","+qs(eventKey)+
   ")::text ELSE NULL END");
  if(!UUID.test(result))throw Error('G148 G42 atomic session fence rejected');
  return {ok:true,liveEnabled:false,eventId:result};
 },
 attachDelivery:async()=>{throw Error('G148 no legal courier / no delivery attachment');},
 loadOrder:async()=>{throw Error('G148 independent Admin trace only');}
});
const adminGateway=createG146AdminCommerceTraceGateway({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 now:()=>Date.now(),
 verifyAccessToken:async token=>{
  if(token!==adminToken)throw Error('untrusted Admin');
  return {id:admin,sessionId:adminSession,expiresAtMs:Date.now()+60000,
   is_anonymous:false};
 },
 verifySessionNotRevoked:async()=>true,
 loadExclusiveBackofficeRole:async id=>
  id===admin?sql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_role_of("+qs(admin)+")::text"):null,
 verifyBackofficeMfa:async({userId,sessionId})=>({
  verifiedByProvider:true,assuranceLevel:'aal2',userId,sessionId,
  verifiedAtMs:Date.now()-1000,expiresAtMs:Date.now()+30000
 }),
 allowRequest:()=>true,
 loadCommerceTraceReceipt:async({actorId,orderId:target})=>{
  if(actorId!==admin||!UUID.test(target))throw Error('G148 SQL Admin scope invalid');
  return read("SET ROLE service_role; SELECT COALESCE(public.mobility_stage_g146_commerce_trace_qa("+
   qs(actorId)+","+qs(target)+"),'null'::jsonb)::text");
 }
});
const noop=async()=>({status:404,body:{error:'unavailable'}});
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:merchantGateway,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
 adminCommerceTraceHandler:adminGateway
});
const base=await listenQoreRadarLoopback(server);
const origin='https://g148-commerce-ci.onrender.com';
const path='/v1/staging/admin/services/COMMERCE/'+orderId+'/trace';
const dClient=createServiceTraceGateway({
 enabled:true,contractCertified:true,origin,pinnedOrigin:origin,
 now:()=>Date.now(),
 getSession:async()=>({role:'admin',mfaVerified:true,subject:admin,
  authRevision:1,token:adminToken,expiresAt:at+60000}),
 fetchImpl:(url,opts)=>{
  const u=new URL(url);
  assert.equal(u.origin,origin);
  assert.equal(u.pathname,path);
  return fetch(base+u.pathname,{...opts,redirect:'error'});
 }
});
const observed=createServiceTraceIntegrityFence();
const sellerPath='/v1/staging/merchant/orders/'+orderId+'/transition';
async function send(event,eventKey,bearer=sellerToken){
 const resp=await fetch(base+sellerPath,{method:'POST',
  headers:{authorization:'Bearer '+bearer,'content-type':'application/json'},
  body:JSON.stringify({event,eventKey})});
 return {status:resp.status,body:await resp.json()};
}
async function check(status,revision){
 const got=await dClient.read('COMMERCE',orderId);
 assert.equal(got.ok,true,JSON.stringify(got));
 const d=got.data;
 assert.equal(d.serviceId,orderId);assert.equal(d.bookingRequestKey,key);
 assert.equal(d.branchId,saved.branchId);assert.equal(d.vehicleKind,'MOTO');
 assert.equal(d.orderSubtotalGs,25000);assert.equal(d.quoteId,null);
 assert.equal(d.status,status);assert.equal(d.revision,revision);
 assert.equal(d.ledger,null);assert.equal(d.assignment.legalGate,'G38_BLOCKED');
 assert.equal(d.assignment.state,'NOT_ASSIGNABLE');
 assert.equal(d.events.length,revision);
 assert.deepEqual(d.events.map(e=>e.status),['requested','confirmed','preparing','ready'].slice(0,revision));
 assert(d.events.every(e=>e.serviceId===orderId));
 assert.equal(observed.observe(d).ok,true);
 assert.equal(sql("SELECT status FROM public.mobility_stage_merchant_orders WHERE id="+qs(orderId)),status);
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+qs(item)),'1');
}
try{
 await check('requested',1);
 assert.equal((await send('confirm','14800000-0000-4148-8148-000000000011','x'.repeat(30))).status,401);
 assert.equal((await send('ready','14800000-0000-4148-8148-000000000020')).status,409,
  'Merchant cannot bypass confirmed/preparing stages');
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_merchant_order_events WHERE order_id="+qs(orderId)),'0');
 for(const [event,eventKey,status,revision] of [
  ['confirm','14800000-0000-4148-8148-000000000011','confirmed',2],
  ['start_preparing','14800000-0000-4148-8148-000000000012','preparing',3],
  ['ready','14800000-0000-4148-8148-000000000013','ready',4]
 ]){
  const response=await send(event,eventKey);
  assert.equal(response.status,200,JSON.stringify(response.body));
  assert.equal(response.body.event,event);
  assert(UUID.test(response.body.eventId));
  const replay=await send(event,eventKey);
  assert.equal(replay.status,200,'Same merchant event key must be idempotent');
  assert.equal(replay.body.eventId,response.body.eventId);
  await check(status,revision);
 }
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_merchant_order_events WHERE order_id="+qs(orderId)),'3',
  'Three durable G6 events, no duplicate transition');
 const countBefore=sql("SELECT count(*) FROM public.mobility_stage_merchant_order_events WHERE order_id="+qs(orderId));
 sql("UPDATE public.mobility_stage_g42_provider_session_grants SET revoked_at=clock_timestamp() "+
  "WHERE user_id="+qs(owner)+" AND session_id="+qs(sellerSession));
 assert.equal(active(),false);
 assert.equal((await send('ready','14800000-0000-4148-8148-000000000014')).status,401);
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_merchant_order_events WHERE order_id="+qs(orderId)),countBefore);
 assert.equal(sql("SELECT delivery_id IS NULL FROM public.mobility_stage_merchant_orders WHERE id="+qs(orderId)),'t');
 console.log('G148 PASS: real B/G139 G45 original MOTO stock order -> A/G6 Merchant staff confirmed/preparing/ready via HTTP and G42 -> D/G146 AAL2 same order + original subtotal, three durable events, replay/revocation fenced, no delivery/PSP.');
} finally {
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
}
