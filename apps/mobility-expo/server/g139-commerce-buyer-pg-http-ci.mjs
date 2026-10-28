/** G139 E2E: genuine Client B -> local HTTP A/G45 -> PostgreSQL16 stock,
 * immutable Buyer receipt, cancellation/restock, and revoked identity.
 * Only GitHub disposable PG16, no app, LIVE, PSP or municipal authorization.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createG45BuyerOrderReservationQa}
 from './g45-buyer-order-reservation-qa.mjs';
import {createG139CommerceQaHttpBridge}
 from './g139-commerce-qa-http-bridge.mjs';
import {createG139CommerceQaHttpGateway}
 from '../../movete-cliente/src/domain/g139-commerce-qa-http-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'
 ||process.env.PGPORT!=='5432'
 ||process.env.PGDATABASE!=='qore_disposable_chain'
 ||process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G139 refuses remote/production PG');
const ids=n=>'13800000-0000-4138-8138-'+String(n).padStart(12,'0');
const buyer=ids(1),owner=ids(2),reviewer=ids(3),session=ids(101),
 branch=ids(30),item=ids(40),zone=ids(10),merchant=ids(20),
 key=ids(201),cancelKey=ids(301),token='g139-provider-authenticated-buyer-qa';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const quote=s=>"'"+s+"'";
function sql(statement){
 const out=execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
  '-c',statement],{encoding:'utf8',maxBuffer:500000,timeout:20000});
 return out.trim().split('\n').at(-1)?.trim()??'';
}
const read=s=>JSON.parse(sql(s));
assert.equal(sql("SELECT (current_database()='qore_disposable_chain'"+
 " AND current_setting('application_name')='qore_ci_disposable_chain')"),'t');
sql("INSERT INTO auth.users(id) VALUES "+[buyer,owner,reviewer].map(id=>'('+quote(id)+')').join(',')+";"+
 "INSERT INTO public.user_roles(user_id,role) VALUES("+quote(buyer)+",'passenger');"+
 "INSERT INTO public.mobility_stage_g42_provider_session_grants("+
 "user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)"+
 " VALUES("+quote(buyer)+","+quote(session)+","+
 "clock_timestamp()-interval '1 hour',clock_timestamp()-interval '2 minutes',"+
 "clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY');"+
 "INSERT INTO public.mobility_stage_g31_zone_coverage("+
 "zone_id,municipality,service_kind,coverage_status) VALUES("+
 quote(zone)+",'Asuncion','AUTO_DELIVERY','ACTIVE');"+
 "INSERT INTO public.mobility_stage_merchants("+
 "id,onboarding_key,owner_id,kind,display_tag,status,reviewed_by,reviewed_at)"+
 " VALUES("+quote(merchant)+","+quote(ids(21))+","+quote(owner)+
 ",'SUPERMARKET','G139_SHOP','approved',"+quote(reviewer)+",clock_timestamp());"+
 "INSERT INTO public.mobility_stage_merchant_branches("+
 "id,merchant_id,branch_tag,pickup_tag,preparation_minutes,active,accepting_orders)"+
 " VALUES("+quote(branch)+","+quote(merchant)+
 ",'G139_BRANCH','G139_PICKUP',10,true,true);"+
 "INSERT INTO public.mobility_stage_g44_branch_geography("+
 "branch_id,zone_id,service_kind) VALUES("+quote(branch)+","+quote(zone)+
 ",'AUTO_DELIVERY');"+
 "INSERT INTO public.mobility_stage_catalog_items("+
 "id,branch_id,sku,item_tag,item_class,unit_price_pyg,unit_grams,stock_units)"+
 " VALUES("+quote(item)+","+quote(branch)+
 ",'G139SKU','G139_ITEM','GENERAL',25000,350,2);");
const version=Number(sql("SELECT revision FROM public.mobility_stage_g44_catalog_versions WHERE branch_id="+quote(branch)));
assert(Number.isSafeInteger(version)&&version>0);
const at=Date.now(),issuedAt=at-60000,expiresAt=at+3600000;
let revoked=false;
const qa=createG45BuyerOrderReservationQa({
 environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
 projectRef:'staging1234567890abcd',
 verifyAccessToken:async t=>{
  if(t!==token)throw Error('Unknown IdP token');
  return {id:buyer,sessionId:session,tokenIatMs:issuedAt,expiresAtMs:expiresAt,
   is_anonymous:false,email_confirmed_at:'2026-10-28T00:00:00Z'};
 },
 verifySessionNotRevoked:async({userId,sessionId})=>
  revoked===false&&userId===buyer&&sessionId===session,
 loadExclusiveRole:async userId=>{
  if(!UUID.test(userId))throw Error('Invalid actor');
  return sql("SELECT role FROM public.user_roles WHERE user_id="+quote(userId));
 },
 allowRequest:()=>true,
 rpc:async(name,args)=>{
  if(name==='mobility_stage_g45_reserve_order_qa'){
   const keys=['_buyer','_session','_iat_ms','_request_key',
    '_branch','_catalog_version','_vehicle_kind','_items'];
   if(Object.keys(args).length!==keys.length
    ||!keys.every(k=>Object.hasOwn(args,k))
    ||![args._buyer,args._session,args._request_key,args._branch]
     .every(x=>UUID.test(x)))throw Error('Invalid G45 SQL scope');
   const items=JSON.stringify(args._items);
   if(!args._items.every(x=>UUID.test(x.itemId)&&
    Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=999))
    throw Error('Invalid stock request');
   return {data:read("SELECT public.mobility_stage_g45_reserve_order_qa("+
    [args._buyer,args._session].map(quote).join(',')+","+
    args._iat_ms+","+quote(args._request_key)+","+quote(args._branch)+","+
    args._catalog_version+",'AUTO',"+quote(items)+"::jsonb)::text")};
  }
  if(name==='mobility_stage_g45_cancel_order_qa'){
   if(![args._buyer,args._session,args._order_id,args._cancel_key]
    .every(x=>UUID.test(x)))throw Error('Invalid cancellation scope');
   return {data:read("SELECT public.mobility_stage_g45_cancel_order_qa("+
    [args._buyer,args._session].map(quote).join(',')+","+
    args._iat_ms+","+[args._order_id,args._cancel_key].map(quote).join(',')+
    ")::text")};
  }
  throw Error('Unapproved G45 SQL');
 }
});
const noop=async()=>({status:404,body:{error:'Unavailable'}});
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,
 deliveryOfferHandler:noop,commerceQaHandler:createG139CommerceQaHttpBridge({
  qa,environment:'isolated_staging',liveEnabled:false})
});
try{
 const base=await listenQoreRadarLoopback(server);
 const host='https://qore-g139-qa-only.invalid',sessionValue={
  role:'passenger',subject:buyer,token,sessionRevision:1,expiresAt
 };
 let posts=0;
 const B=createG139CommerceQaHttpGateway({
  enabled:true,contractCertified:true,disposableQaVerified:true,
  origin:host,pinnedOrigin:host,getSession:async()=>sessionValue,
  fetchImpl:(url,opts)=>{
   const u=new URL(url);
   assert.equal(u.origin,host);
   assert.equal(u.search,'');assert.equal(u.hash,'');
   assert(['/v1/staging/buyer/orders/qa/reserve',
    '/v1/staging/buyer/orders/qa/cancel'].includes(u.pathname));
   assert.equal(opts.method,'POST');
   assert.equal(opts.credentials,'omit');
   posts++;
   return fetch(base+u.pathname,{...opts,redirect:'error'});
  }
 });
 const request={requestKey:key,branchId:branch,catalogVersion:version,
  vehicleKind:'AUTO',items:[{itemId:item,quantity:1}]};
 assert.equal(B.isConfigured(),true);
 const first=await B.reserve(request);
 assert.equal(first.ok,true,JSON.stringify(first));
 assert.equal(first.receipt.subtotalPyg,25000);
 assert.equal(first.receipt.paymentConfirmed,false);
 const orderId=first.receipt.orderId;
 assert(UUID.test(orderId));
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'1');
 assert.equal(sql("SELECT subtotal_pyg FROM public.mobility_stage_merchant_orders WHERE id="+quote(orderId)),'25000');
 const again=await B.reserve(request);
 assert.equal(again.ok,true,JSON.stringify(again));
 assert.equal(again.receipt.orderId,orderId);
 assert.equal(again.receipt.receiptId,first.receipt.receiptId);
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'1');
 revoked=true;
 assert.equal((await B.reserve(request)).ok,false);
 revoked=false;
 const canceled=await B.cancel({orderId,cancelKey});
 assert.equal(canceled.ok,true,JSON.stringify(canceled));
 assert.equal(canceled.receipt.refundStatus,'NO_PSP_NO_FINANCIAL_REFUND');
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'2');
 assert.equal(sql("SELECT status FROM public.mobility_stage_merchant_orders WHERE id="+quote(orderId)),'cancelled');
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_merchant_order_events WHERE order_id="+quote(orderId)+" AND action='cancel'"),'1');
 const replay=await B.cancel({orderId,cancelKey});
 assert.equal(replay.ok,true);
 assert.equal(replay.receipt.eventId,canceled.receipt.eventId);
 assert.equal(posts,5);
 console.log('G139 B/A/PG16 COMMERCE PASS: authenticated original Client Buyer -> HTTP -> G45 server priced 25000 PYG catalog reserve; same order replay; revoked denied; cancel restores exact stock once; NO LIVE/PSP');
}finally{
 server.close();if(server.listening)await once(server,'close');
}
