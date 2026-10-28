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
import {createClientExperience}
 from '../../movete-cliente/src/domain/client-experience.mjs';
import {createG148CommerceDurableOrder}
 from '../../movete-cliente/src/domain/g148-commerce-durable-order.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'
 ||process.env.PGPORT!=='5432'
 ||process.env.PGDATABASE!=='qore_disposable_chain'
 ||process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G139 refuses remote/production PG');
const ids=n=>'13800000-0000-4138-8138-'+String(n).padStart(12,'0');
const buyer=ids(1),owner=ids(2),reviewer=ids(3),stranger=ids(4),session=ids(101),otherSession=ids(102),
 branch=ids(30),item=ids(40),zone=ids(10),merchant=ids(20),
 key=ids(201),cancelKey=ids(301),token='g139-provider-authenticated-buyer-qa',otherToken='g144-provider-other-buyer-qa-123';
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
sql("INSERT INTO auth.users(id) VALUES "+[buyer,owner,reviewer,stranger].map(id=>'('+quote(id)+')').join(',')+";"+
 "INSERT INTO public.user_roles(user_id,role) VALUES("+quote(buyer)+",'passenger'),("+quote(stranger)+",'passenger') ON CONFLICT DO NOTHING;"+
 "INSERT INTO public.mobility_stage_g42_provider_session_grants("+
 "user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)"+
 " VALUES("+quote(buyer)+","+quote(session)+","+
 "clock_timestamp()-interval '1 hour',clock_timestamp()-interval '2 minutes',"+
 "clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),("+
 "'"+stranger+"','"+otherSession+"',clock_timestamp()-interval '1 hour',"+
 "clock_timestamp()-interval '2 minutes',clock_timestamp()+interval '1 hour',"+
 "'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');"+
 "INSERT INTO public.mobility_stage_g31_zone_coverage("+
 "zone_id,municipality,service_kind,coverage_status) VALUES("+
 quote(zone)+",'Asuncion','AUTO_DELIVERY','ACTIVE');"+
 "INSERT INTO public.mobility_stage_merchants("+
 "id,onboarding_key,owner_id,kind,display_tag,status,reviewed_by,reviewed_at)"+
 " VALUES("+quote(merchant)+","+quote(ids(21))+","+quote(owner)+
 ",'SUPERMARKET','QA_SHOP','approved',"+quote(reviewer)+",clock_timestamp());"+
 "INSERT INTO public.mobility_stage_merchant_branches("+
 "id,merchant_id,branch_tag,pickup_tag,preparation_minutes,active,accepting_orders)"+
 " VALUES("+quote(branch)+","+quote(merchant)+
 ",'QA_BRANCH','QA_PICKUP',10,true,true);"+
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
  if(t!==token&&t!==otherToken)throw Error('Unknown IdP token');
  return {id:t===token?buyer:stranger,sessionId:t===token?session:otherSession,tokenIatMs:issuedAt,expiresAtMs:expiresAt,
   is_anonymous:false,email_confirmed_at:'2026-10-28T00:00:00Z'};
 },
 verifySessionNotRevoked:async({userId,sessionId})=>
  revoked===false&&((userId===buyer&&sessionId===session)||
   (userId===stranger&&sessionId===otherSession)),
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
     .every(x=>UUID.test(x))||!['AUTO','MOTO'].includes(args._vehicle_kind))
    throw Error('Invalid G45 SQL scope');
   const items=JSON.stringify(args._items);
   if(!args._items.every(x=>UUID.test(x.itemId)&&
    Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=999))
    throw Error('Invalid stock request');
   return {data:read("SELECT public.mobility_stage_g45_reserve_order_qa("+
    [args._buyer,args._session].map(quote).join(',')+","+
    args._iat_ms+","+quote(args._request_key)+","+quote(args._branch)+","+
    args._catalog_version+","+quote(args._vehicle_kind)+","+quote(items)+"::jsonb)::text")};
  }
  if(name==='mobility_stage_g45_cancel_order_qa'){
   if(![args._buyer,args._session,args._order_id,args._cancel_key]
    .every(x=>UUID.test(x)))throw Error('Invalid cancellation scope');
   return {data:read("SELECT public.mobility_stage_g45_cancel_order_qa("+
    [args._buyer,args._session].map(quote).join(',')+","+
    args._iat_ms+","+[args._order_id,args._cancel_key].map(quote).join(',')+
    ")::text")};
  }
  if(name==='mobility_stage_g144_recover_order_qa'){
   if(![args._buyer,args._session,args._request_key].every(x=>UUID.test(x))
    ||!Number.isSafeInteger(args._iat_ms))throw Error('Invalid G144 recovery scope');
   return {data:read("SELECT COALESCE(public.mobility_stage_g144_recover_order_qa("+
    [args._buyer,args._session].map(quote).join(',')+","+
    args._iat_ms+","+quote(args._request_key)+"),'null'::jsonb)::text")};
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
 const host='https://qore-g139-qa-only.invalid';
 let posts=0;
 const BExperience=createClientExperience({
  authProvider:{readSession:async()=>({role:'passenger',subject:buyer,
   token,expiresAt}),signOut:async()=>{}},
  commerceQaHttpOptions:{
   enabled:true,contractCertified:true,disposableQaVerified:true,
   origin:host,pinnedOrigin:host,
   fetchImpl:(url,opts)=>{
   const u=new URL(url);
   assert.equal(u.origin,host);
   assert.equal(u.search,'');assert.equal(u.hash,'');
   assert(['/v1/staging/buyer/orders/qa/reserve',
    '/v1/staging/buyer/orders/qa/cancel',
    '/v1/staging/buyer/orders/qa/requests/'+key,
    '/v1/staging/buyer/orders/qa/requests/'+ids(212)].includes(u.pathname));
   assert(['POST','GET'].includes(opts.method));
   assert.equal(opts.credentials,'omit');
   if(opts.method==='POST')posts++;
   return fetch(base+u.pathname,{...opts,redirect:'error'});
   }
  }
 });
 assert.equal((await BExperience.refreshSession()).ok,true);
 const B={reserve:body=>BExperience.reserveCommerceQa(body),
  cancel:body=>BExperience.cancelCommerceQa(body),
  recover:requestKey=>BExperience.recoverCommerceQa(requestKey)};
 const request={requestKey:key,branchId:branch,catalogVersion:version,
  vehicleKind:'AUTO',items:[{itemId:item,quantity:1}]};
 assert.equal(BExperience.snapshot().authenticated,true);
 const first=await B.reserve(request);
 assert.equal(first.ok,true,JSON.stringify(first));
 assert.equal(first.receipt.subtotalPyg,25000);
 assert.equal(first.receipt.paymentConfirmed,false);
 const orderId=first.receipt.orderId;
 assert(UUID.test(orderId));
 const beforeRecovery=await B.recover(key);
 assert.equal(beforeRecovery.ok,true,JSON.stringify(beforeRecovery));
 assert.equal(beforeRecovery.receipt.orderId,orderId);
 assert.equal(beforeRecovery.receipt.status,'requested');
 assert.equal(beforeRecovery.receipt.revision,1);
 assert.equal(beforeRecovery.receipt.paymentConfirmed,false);
 const strangerRead=await qa.recover({bearer:otherToken,requestKey:key});
 assert.equal(strangerRead.status,404,'valid foreign Buyer denied');
 assert.equal((await qa.recover({bearer:token,requestKey:ids(999)})).status,404);
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'1');
 assert.equal(sql("SELECT subtotal_pyg FROM public.mobility_stage_merchant_orders WHERE id="+quote(orderId)),'25000');
 const again=await B.reserve(request);
 assert.equal(again.ok,true,JSON.stringify(again));
 assert.equal(again.receipt.orderId,orderId);
 assert.equal(again.receipt.receiptId,first.receipt.receiptId);
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'1');
 revoked=true;
 assert.equal((await B.recover(key)).ok,false);
 assert.equal((await B.reserve(request)).ok,false);
 revoked=false;
 const canceled=await B.cancel({orderId,cancelKey});
 assert.equal(canceled.ok,true,JSON.stringify(canceled));
 assert.equal(canceled.receipt.refundStatus,'NO_PSP_NO_FINANCIAL_REFUND');
 const afterCancel=await B.recover(key);
 assert.equal(afterCancel.ok,true,JSON.stringify(afterCancel));
 assert.equal(afterCancel.receipt.status,'cancelled');
 assert.equal(afterCancel.receipt.revision,2);
 assert.equal(afterCancel.receipt.orderId,orderId);
 assert.equal(afterCancel.receipt.paymentConfirmed,false);
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'2');
 assert.equal(sql("SELECT status FROM public.mobility_stage_merchant_orders WHERE id="+quote(orderId)),'cancelled');
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_merchant_order_events WHERE order_id="+quote(orderId)+" AND action='cancel'"),'1');
 const replay=await B.cancel({orderId,cancelKey});
 assert.equal(replay.ok,true);
 assert.equal(replay.receipt.eventId,canceled.receipt.eventId);
 // G140: original Cliente B HTTP client chooses vehicle. SQL enforces
 // G44 branch geography; switching coverage invalidates catalog revision.
 const invalidMoto={...request,requestKey:ids(211),vehicleKind:'MOTO'};
 assert.equal((await B.reserve(invalidMoto)).ok,false,
  'MOTO booking cannot use AUTO-only branch');
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'2');
 sql("INSERT INTO public.mobility_stage_g31_zone_coverage("+
  "zone_id,municipality,service_kind,coverage_status) VALUES("+
  quote(zone)+",'Asuncion','MOTO_DELIVERY','ACTIVE');"+
  "UPDATE public.mobility_stage_g44_branch_geography SET service_kind='MOTO_DELIVERY'"+
  " WHERE branch_id="+quote(branch));
 const motoVersion=Number(sql("SELECT revision FROM public.mobility_stage_g44_catalog_versions WHERE branch_id="+quote(branch)));
 assert(motoVersion>version);
 const invalidAuto={...request,requestKey:ids(213),catalogVersion:motoVersion};
 assert.equal((await B.reserve(invalidAuto)).ok,false,
  'AUTO booking cannot use MOTO-only branch');
 const motoRequest={...request,requestKey:ids(212),vehicleKind:'MOTO',
  catalogVersion:motoVersion};
 const moto=await B.reserve(motoRequest);
 assert.equal(moto.ok,true,JSON.stringify(moto));
 assert.equal(moto.receipt.subtotalPyg,25000);
 assert.equal(moto.receipt.paymentConfirmed,false);
 const motoId=moto.receipt.orderId;
 assert.notEqual(motoId,orderId);
 assert.equal(sql("SELECT requested_vehicle_kind FROM public.mobility_stage_merchant_orders WHERE id="+quote(motoId)),'MOTO');
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'1');
 const motoRetry=await B.reserve(motoRequest);
 assert.equal(motoRetry.ok,true);
 assert.equal(motoRetry.receipt.receiptId,moto.receipt.receiptId);
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'1');
 const motoCancel=await B.cancel({orderId:motoId,cancelKey:ids(312)});
 assert.equal(motoCancel.ok,true,JSON.stringify(motoCancel));
 assert.equal(motoCancel.receipt.refundStatus,'NO_PSP_NO_FINANCIAL_REFUND');
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'2');
 const motoCancelReplay=await B.cancel({orderId:motoId,cancelKey:ids(312)});
 assert.equal(motoCancelReplay.ok,true);
 assert.equal(motoCancelReplay.receipt.eventId,motoCancel.receipt.eventId);
 const recoveredMoto=await B.recover(motoRequest.requestKey);
 assert.equal(recoveredMoto.ok,true,JSON.stringify(recoveredMoto));
 assert.equal(recoveredMoto.receipt.orderId,motoId);
 assert.equal(recoveredMoto.receipt.status,'cancelled');

 // G148: original Client -> native-equivalent durable key -> A HTTP -> PG16.
 // Simulate a LOST 201 ACK after the SQL reserve already consumed stock.
 let saved=null;
 const secureStore={
  read:async owner=>saved?.ownerId===owner?saved:null,
  write:async row=>{
   assert.equal(saved,null,'never overwrite unresolved original');
   saved=Object.freeze({...row});
  },
  markCancel:async(ownerId,requestKey,key)=>{
   assert.equal(saved?.ownerId,ownerId);
   assert.equal(saved?.requestKey,requestKey);
   assert(saved.cancelKey===null||saved.cancelKey===key);
   saved=Object.freeze({...saved,cancelKey:key});
  },
  clearMatching:async(ownerId,requestKey)=>{
   assert.equal(saved?.ownerId,ownerId);assert.equal(saved?.requestKey,requestKey);
   saved=null;return true;
  }
 };
 const g148=createG148CommerceDurableOrder({
  store:secureStore,
  api:{
   isCommerceQaReady:()=>BExperience.isCommerceQaReady(),
   snapshot:()=>BExperience.snapshot(),
   reserveCommerceQa:async body=>{
    const persisted=await BExperience.reserveCommerceQa(body);
    assert.equal(persisted.ok,true,JSON.stringify(persisted));
    throw Error('Synthetic dropped HTTP ACK AFTER G45 SQL committed');
   },
   recoverCommerceQa:key=>BExperience.recoverCommerceQa(key),
   cancelCommerceQa:body=>BExperience.cancelCommerceQa(body)
  }
 });
 assert.equal(g148.isConfigured(),true);
 const freshVersion=Number(sql("SELECT revision FROM public.mobility_stage_g44_catalog_versions WHERE branch_id="+quote(branch)));
 const third={...motoRequest,requestKey:ids(240),catalogVersion:freshVersion};
 const unknown=await g148.reserve(third);
 assert.equal(unknown.ok,false);
 assert.equal(unknown.code,'POST_RESULT_UNKNOWN_RECOVER_ORIGINAL');
 assert.equal(saved.requestKey,third.requestKey,'original key secured before POST');
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'1');
 const original=await g148.recover();
 assert.equal(original.ok,true,JSON.stringify(original));
 assert.equal(original.receipt.requestKey,third.requestKey);
 assert.equal(original.receipt.status,'requested');
 assert.equal(original.receipt.paymentConfirmed,false);
 const refused=await g148.reserve({...third,requestKey:ids(241)});
 assert.equal(refused.code,'ORIGINAL_ORDER_RECOVERY_REQUIRED');
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'1');
 const cancelG148=await g148.cancel(ids(340));
 assert.equal(cancelG148.ok,true,JSON.stringify(cancelG148));
 const recoveredCancel=await g148.recover();
 assert.equal(recoveredCancel.ok,true);
 assert.equal(recoveredCancel.receipt.status,'cancelled');
 const released=await g148.releaseCancelled();
 assert.equal(released.ok,true);
 assert.equal(saved,null,'only verified terminal cancellation releases the key');
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'2');
 assert.equal(posts,13);
 // G149: fourth original request is durable on the client, the 201 ACK
 // disappears, and original G45 PostgreSQL booking survives for Merchant staff.
 const staffKey=ids(242);
 const readyVersion=Number(sql("SELECT revision FROM public.mobility_stage_g44_catalog_versions WHERE branch_id="+quote(branch)));
 const staffRequest={...third,requestKey:staffKey,catalogVersion:readyVersion};
 const staffUnknown=await g148.reserve(staffRequest);
 assert.equal(staffUnknown.code,'POST_RESULT_UNKNOWN_RECOVER_ORIGINAL');
 const staffRecovered=await g148.recover();
 assert.equal(staffRecovered.ok,true,JSON.stringify(staffRecovered));
 assert.equal(staffRecovered.receipt.requestKey,staffKey);
 assert.equal(staffRecovered.receipt.status,'requested');
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id="+quote(item)),'1');
 assert.equal(posts,14);
 console.log('G148 PASS: Buyer durably records original request before HTTP, lost ACK recovery by same G45 PostgreSQL order, duplicate reserve blocked, cancel restores stock exactly once, terminal releases key');
 console.log('G144 COMMERCE: B -> A HTTP GET -> original PostgreSQL G45 orderId, current state, foreign/revoked denied, no duplicate stock or payment');
 console.log('G140 COMMERCE MOTO E2E PASS: original B Client -> A HTTP -> G44 vehicle matching -> G45 PG16 stock; wrong vehicle denied, MOTO receipt replay and exact restock; no LIVE/PSP');
 console.log('G139 B/A/PG16 COMMERCE PASS: authenticated original Client Buyer -> HTTP -> G45 server priced 25000 PYG catalog reserve; same order replay; revoked denied; cancel restores exact stock once; NO LIVE/PSP');
}finally{
 server.close();if(server.listening)await once(server,'close');
}
