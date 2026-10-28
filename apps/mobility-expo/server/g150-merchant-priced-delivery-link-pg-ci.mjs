/**
 * G150: ORIGINAL B Buyer G45 order already READY by G148 Merchant ->
 * G5 original Buyer MOTO delivery -> G7 fare -> G122 sender immutable consent
 * -> G6 Merchant HTTP links SAME original order/delivery -> G144 Buyer reads ID.
 * Legal courier/driver acceptance, GPS, payment & LIVE remain disabled.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreMerchantOrderGateway} from './g6-merchant-order-gateway.mjs';
import {createG45BuyerOrderReservationQa} from './g45-buyer-order-reservation-qa.mjs';
import {createG139CommerceQaHttpBridge} from './g139-commerce-qa-http-bridge.mjs';
import {createClientExperience}
 from '../../movete-cliente/src/domain/client-experience.mjs';
import {createG146AdminCommerceTraceGateway} from './g146-admin-commerce-trace-gateway.mjs';
import {createServiceTraceGateway}
 from '../../movete-admin/src/service-trace-gateway.mjs';
import {createQoreDeliveryCommandGateway} from './g5-delivery-command-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G150 only in disposable CI PG16');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const buyer='13800000-0000-4138-8138-000000000001';
const seller='13800000-0000-4138-8138-000000000002';
const key='13800000-0000-4138-8138-000000000242';
const sellerSession='15000000-0000-4150-8150-000000000001';
const admin='14600000-0000-4146-8146-000000000002';
const adminSession='15000000-0000-4150-8150-000000000003';
const adminToken='g151-verifiable-admin-private-aal2-token-0000001';
const buyerSession='15000000-0000-4150-8150-000000000002';
const sellerToken='g150-merchant-provider-session-token-0000000000001';
const buyerToken='g150-buyer-provider-session-token-0000000000000002';
const deliveryKey='15000000-0000-4150-8150-000000000011';
const underDeliveryKey='15000000-0000-4150-8150-000000000016';
const underQuoteKey='15000000-0000-4150-8150-000000000017';
const underConsentKey='15000000-0000-4150-8150-000000000018';
const underCancelKey='15000000-0000-4150-8150-000000000019';
const quoteKey='15000000-0000-4150-8150-000000000012';
const consentKey='15000000-0000-4150-8150-000000000013';
const linkKey='15000000-0000-4150-8150-000000000014';
const linkReplayOther='15000000-0000-4150-8150-000000000015';
const rule='12200000-0000-4122-8122-000000000051';
const issued=Date.now()-2000;
const qs=x=>"'"+x+"'";
function sql(statement){
 return execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',statement],{
  encoding:'utf8',timeout:15000,maxBuffer:1000000,
  stdio:['ignore','pipe','pipe']
 }).trim().split('\n').at(-1)?.trim()??'';
}
const read=statement=>JSON.parse(sql(statement));
const original=read("SELECT jsonb_build_object("+
 "'id',o.id,'key',o.request_key,'buyer',o.buyer_id,'merchant',o.merchant_id,"+
 "'status',o.status,'rev',o.revision,'vehicle',o.requested_vehicle_kind,"+
 "'pickup',b.pickup_tag,'kind',m.kind,"+
 "'grams',(SELECT sum(l.unit_grams*l.quantity) FROM public.mobility_stage_merchant_order_lines l WHERE l.order_id=o.id)) "+
 "FROM public.mobility_stage_merchant_orders o "+
 "JOIN public.mobility_stage_merchant_branches b ON b.id=o.branch_id "+
 "JOIN public.mobility_stage_merchants m ON m.id=o.merchant_id "+
 "WHERE o.request_key="+qs(key));
assert(UUID.test(original.id)&&original.key===key);
assert.equal(original.buyer,buyer);
assert.equal(original.status,'ready');
assert.equal(original.rev,4);
assert.equal(original.vehicle,'MOTO');
assert(Number.isSafeInteger(original.grams)&&original.grams>0&&original.grams<=10000);
const category={SUPERMARKET:'GROCERIES',PHARMACY:'PHARMACY_OTC',
 RESTAURANT:'RESTAURANT'}[original.kind]??'PARCEL';
assert.equal(sql("SELECT (to_regprocedure('public.mobility_stage_g122_accept_delivery_quote_qa(uuid,uuid,uuid,uuid,integer,text)') IS NOT NULL)::text"),'true');
for(const [actor,session] of [[buyer,buyerSession],[seller,sellerSession]]){
 sql("INSERT INTO public.mobility_stage_g42_provider_session_grants"+
  "(user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind) "+
  "VALUES ("+qs(actor)+","+qs(session)+",clock_timestamp()-interval '1 hour',"+
  "clock_timestamp()-interval '2 minutes',clock_timestamp()+interval '1 hour',"+
  "'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')");
}
const fresh=(actor,session)=>sql("SELECT public.mobility_stage_g42_session_active("+
 qs(actor)+","+qs(session)+","+issued+")::text")==='true';
assert(fresh(buyer,buyerSession));assert(fresh(seller,sellerSession));
const verified=async token=>{
 const actor=token===buyerToken?buyer:token===sellerToken?seller:null;
 const session=actor===buyer?buyerSession:sellerSession;
 if(!actor||!fresh(actor,session))throw Error('G150 provider session unavailable');
 return {id:actor,is_anonymous:false,email_confirmed_at:'2026-10-28T00:00:00Z'};
};
const role=async actor=>{
 if(actor!==buyer)return null;
 return sql("SET ROLE service_role; SELECT CASE WHEN count(*)=1 "+
  "THEN min(role::text) ELSE 'none' END FROM public.user_roles "+
  "WHERE user_id="+qs(actor));
};
const deliveries=createQoreDeliveryCommandGateway({
 projectRef:'staging1234567890abcd',verifyAccessToken:verified,
 resolveRole:role,allowRequest:()=>true,
 requestDelivery:async d=>{
  assert.equal(d.actorId,buyer);
  assert([deliveryKey,underDeliveryKey].includes(d.requestKey));
  assert.equal(d.pickupTag,original.pickup);
  assert.equal(d.category,category);
  return {ok:true,liveEnabled:false,deliveryId:sql("SET ROLE service_role; SELECT "+
   "public.mobility_stage_delivery_request("+qs(buyer)+","+qs(d.requestKey)+
   ",'MOTO'::public.mobility_vehicle_kind,"+qs(category)+
   "::public.mobility_stage_delivery_category,"+
   [d.grams,d.lengthCm,d.widthCm,d.heightCm].join(',')+","+
   qs(d.pickupTag)+","+qs(d.deliveryTag)+",false)::text")};
 },
 confirmQuote:async d=>{
  assert.equal(d.actorId,buyer);
  const confirmed=read("SET ROLE service_role; SELECT "+
   "public.mobility_stage_g122_accept_delivery_quote_qa("+
   qs(buyer)+","+qs(d.deliveryId)+","+qs(d.quoteId)+
   ","+qs(d.confirmationKey)+","+d.acceptedTotalGs+
   ","+qs(d.acceptedFareVersion)+")::text");
  return {ok:true,...confirmed};
 },
 acceptDelivery:async()=>{throw Error('G150 may never accept courier');},
 transitionDelivery:async()=>{throw Error('G150 may never mutate custody');},
 loadDelivery:async()=>{throw Error('G150 no fake legal courier receipt');}
});
const merchantOrders=createQoreMerchantOrderGateway({
 projectRef:'staging1234567890abcd',verifyAccessToken:verified,
 authorizeBuyer:async id=>id===buyer,
 authorizeMerchantOrder:async({actorId,orderId})=>
  actorId===seller&&orderId===original.id&&
  sql("SELECT EXISTS(SELECT 1 FROM public.mobility_stage_merchant_staff s "+
   "WHERE s.merchant_id="+qs(original.merchant)+" AND s.user_id="+qs(actorId)+
   " AND s.active)::text")==='true',
 allowRequest:()=>true,
 requestOrder:async()=>{throw Error('Existing G45 Buyer order only');},
 transitionOrder:async()=>{throw Error('No extra transition without legal custody');},
 attachDelivery:async({actorId,orderId,deliveryId,requestKey})=>{
  if(actorId!==seller||orderId!==original.id||
   ![deliveryId,requestKey].every(x=>UUID.test(x)))throw Error('Invalid link scope');
  const result=sql("SELECT CASE WHEN public.mobility_stage_g42_lock_session("+
   qs(seller)+","+qs(sellerSession)+","+issued+") THEN "+
   "public.mobility_stage_merchant_order_attach_delivery("+
    qs(orderId)+","+qs(actorId)+","+qs(deliveryId)+","+qs(requestKey)+
   ")::text ELSE NULL END");
  if(!UUID.test(result))throw Error('G150 atomic seller G42 session failed');
  return {ok:true,liveEnabled:false,eventId:result};
 },
 loadOrder:async()=>{throw Error('Admin and Buyer read independently');}
});
// Authenticated B Buyer recovery goes through A HTTP, not a direct SQL
// shortcut. G45/G144 enforce original requestKey and G42 session identity.
const qaBuyer=createG45BuyerOrderReservationQa({
 environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
 projectRef:'staging1234567890abcd',
 verifyAccessToken:async token=>{
  if(token!==buyerToken)throw Error('G152 verified Buyer token required');
  return {id:buyer,sessionId:buyerSession,tokenIatMs:issued,
   expiresAtMs:Date.now()+60000,is_anonymous:false,
   email_confirmed_at:'2026-10-28T00:00:00Z'};
 },
 verifySessionNotRevoked:async({userId,sessionId})=>
  userId===buyer&&sessionId===buyerSession&&fresh(buyer,buyerSession),
 loadExclusiveRole:async id=>
  id===buyer?sql("SELECT min(role::text) FROM public.user_roles WHERE user_id="+qs(id)):null,
 allowRequest:()=>true,
 rpc:async(name,args)=>{
  if(name!=='mobility_stage_g144_recover_order_qa'||
   args._buyer!==buyer||args._session!==buyerSession||
   args._iat_ms!==issued||args._request_key!==key)
   throw Error('G152 original Buyer private recovery only');
  return {data:read("SELECT COALESCE("+
   "public.mobility_stage_g144_recover_order_qa("+
   qs(buyer)+","+qs(buyerSession)+","+issued+","+qs(key)+
   "),'null'::jsonb)::text")};
 }
});
const buyerHttp=createG139CommerceQaHttpBridge({
 qa:qaBuyer,environment:'isolated_staging',liveEnabled:false
});
const qaAdmin=createG146AdminCommerceTraceGateway({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 now:()=>Date.now(),
 verifyAccessToken:async token=>{
  if(token!==adminToken)throw Error('Independent Admin IdP refused');
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
 loadCommerceTraceReceipt:async({actorId,orderId})=>
  read("SET ROLE service_role; SELECT COALESCE("+
   "public.mobility_stage_g146_commerce_trace_qa("+qs(actorId)+
   ","+qs(orderId)+"),'null'::jsonb)::text")
});
const noop=async()=>({status:404,body:{error:'not enabled'}});
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:deliveries,merchantHandler:merchantOrders,
 financeHandler:noop,safetyHandler:noop,
 adminCommerceTraceHandler:qaAdmin,commerceQaHandler:buyerHttp,
 merchantManagementHandler:noop,deliveryOfferHandler:noop
});
const base=await listenQoreRadarLoopback(server);
async function post(path,token,body){
 const res=await fetch(base+path,{method:'POST',redirect:'error',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify(body)});
 return {status:res.status,body:await res.json()};
}
try{
 // G153: create an immutable UNDERWEIGHT G5 cargo request through original
 // authenticated B->A HTTP, accept its genuine G122 fare, then deny link.
 assert(original.grams>1);
 const underRequest=await post('/v1/staging/sender/deliveries/request',buyerToken,{
  requestKey:underDeliveryKey,vehicleKind:'MOTO',category,grams:original.grams-1,
  lengthCm:30,widthCm:20,heightCm:10,pickupTag:original.pickup,
  deliveryTag:'BUYER_DESTINATION_QA',restrictedItemDeclared:false});
 assert.equal(underRequest.status,201,JSON.stringify(underRequest.body));
 const undersizedId=underRequest.body.deliveryId;
 assert(UUID.test(undersizedId));
 const underQuoteId=sql("SET ROLE service_role; SELECT "+
  "public.mobility_stage_fare_quote("+qs(buyer)+","+qs(underQuoteKey)+","+
  "'DELIVERY'::public.mobility_stage_fare_mode,"+
  "'DELIVERY'::public.mobility_stage_fare_subject,"+qs(undersizedId)+
  ",'CARGA_MOTO_QA',4800,750,0)::text");
 assert(UUID.test(underQuoteId));
 const underPrice=read("SELECT jsonb_build_object('amount',q.total_pyg,'fare',r.rule_key) "+
  "FROM public.mobility_stage_fare_quotes q JOIN public.mobility_stage_fare_rules r "+
  "ON r.id=q.rule_id WHERE q.id="+qs(underQuoteId));
 const underConsent=await post('/v1/staging/sender/deliveries/quotes/confirm',buyerToken,{
  deliveryId:undersizedId,quoteId:underQuoteId,confirmationKey:underConsentKey,
  acceptedTotalGs:underPrice.amount,acceptedFareVersion:underPrice.fare});
 assert.equal(underConsent.status,200,JSON.stringify(underConsent.body));
 assert.equal(underConsent.body.dispatchEnabled,false);
 const undersizedLink=await post(
  '/v1/staging/merchant/orders/'+original.id+'/attach-delivery',sellerToken,
  {deliveryId:undersizedId,requestKey:linkKey});
 assert.equal(undersizedLink.status,409,
  'Price-consented G5 parcel below original G45 merchandise mass must not link');
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_merchant_order_events WHERE order_id="+qs(original.id)),'3');
 assert.equal(sql("SELECT delivery_id IS NULL FROM public.mobility_stage_merchant_orders WHERE id="+qs(original.id)),'t');
 // Legitimate sender cancellation, not tampering with G37 immutable grams.
 const cancellation=sql("SET ROLE service_role; SELECT "+
  "public.mobility_stage_delivery_transition("+qs(undersizedId)+","+
  qs(buyer)+",'cancel',"+qs(underCancelKey)+",NULL)::text");
 assert(UUID.test(cancellation));
 assert.equal(sql("SELECT status FROM public.mobility_stage_deliveries WHERE id="+qs(undersizedId)),'cancelled');
 // Fresh original delivery after the canceled underweight request.
 const request=await post('/v1/staging/sender/deliveries/request',buyerToken,{
  requestKey:deliveryKey,vehicleKind:'MOTO',category,grams:original.grams,
  lengthCm:30,widthCm:20,heightCm:10,pickupTag:original.pickup,
  deliveryTag:'BUYER_DESTINATION_QA',restrictedItemDeclared:false});
 assert.equal(request.status,201,JSON.stringify(request.body));
 const deliveryId=request.body.deliveryId;
 assert(UUID.test(deliveryId));
 const path='/v1/staging/merchant/orders/'+original.id+'/attach-delivery';
 const draft=await post(path,sellerToken,{deliveryId,requestKey:linkKey});
 assert.equal(draft.status,409,'Unpriced matching delivery must not link');
 assert.equal(sql("SELECT delivery_id IS NULL FROM public.mobility_stage_merchant_orders WHERE id="+qs(original.id)),'t');
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_merchant_order_events WHERE order_id="+qs(original.id)),'3');
 // G7 MOTO tariff was approved and bound by independent G122 setup earlier.
 const quoteId=sql("SET ROLE service_role; SELECT "+
  "public.mobility_stage_fare_quote("+qs(buyer)+","+qs(quoteKey)+","+
  "'DELIVERY'::public.mobility_stage_fare_mode,"+
  "'DELIVERY'::public.mobility_stage_fare_subject,"+qs(deliveryId)+
  ",'CARGA_MOTO_QA',4800,750,0)::text");
 assert(UUID.test(quoteId));
 const price=read("SELECT jsonb_build_object('amount',q.total_pyg,"+
  "'fare',r.rule_key,'vehicle',v.vehicle_kind) "+
  "FROM public.mobility_stage_fare_quotes q "+
  "JOIN public.mobility_stage_fare_rules r ON r.id=q.rule_id "+
  "JOIN public.mobility_stage_g122_delivery_rate_vehicle_qa v ON v.rule_id=r.id "+
  "WHERE q.id="+qs(quoteId));
 assert.equal(price.vehicle,'MOTO');
 assert.equal(price.fare,'delivery-moto-synthetic-v1');
 const consent=await post('/v1/staging/sender/deliveries/quotes/confirm',buyerToken,{
  deliveryId,quoteId,confirmationKey:consentKey,
  acceptedTotalGs:price.amount,acceptedFareVersion:price.fare});
 assert.equal(consent.status,200,JSON.stringify(consent.body));
 assert.equal(consent.body.paymentAuthorized,false);
 assert.equal(consent.body.dispatchEnabled,false);
 const attached=await post(path,sellerToken,{deliveryId,requestKey:linkKey});
 assert.equal(attached.status,200,JSON.stringify(attached.body));
 assert.equal(attached.body.orderId,original.id);
 assert(UUID.test(attached.body.eventId));
 const replay=await post(path,sellerToken,{deliveryId,requestKey:linkKey});
 assert.equal(replay.status,200);
 assert.equal(replay.body.eventId,attached.body.eventId);
 const incompatible=await post(path,sellerToken,{deliveryId,requestKey:linkReplayOther});
 assert.equal(incompatible.status,409,'One original order may not attach twice');
 const linkage=read("SELECT jsonb_build_object('delivery',o.delivery_id,"+
  "'revision',o.revision,'state',o.status,'vehicle',d.requested_vehicle_kind,"+
  "'sender',d.sender_id,'courier',d.courier_id,'acceptedFare',c.accepted_total_gs,"+
  "'quote',c.quote_id,'eventCount',"+
   "(SELECT count(*) FROM public.mobility_stage_merchant_order_events e WHERE e.order_id=o.id)) "+
  "FROM public.mobility_stage_merchant_orders o "+
  "JOIN public.mobility_stage_deliveries d ON d.id=o.delivery_id "+
  "JOIN public.mobility_stage_g122_delivery_price_consents c ON c.delivery_id=d.id "+
  "WHERE o.id="+qs(original.id));
 assert.equal(linkage.delivery,deliveryId);
 assert.equal(linkage.revision,5);
 assert.equal(linkage.state,'ready');
 assert.equal(linkage.vehicle,'MOTO');
 assert.equal(linkage.sender,buyer);
 assert.equal(linkage.courier,null,'G150 must not invent approved Driver');
 assert.equal(linkage.quote,quoteId);
 assert.equal(linkage.acceptedFare,price.amount);
 assert.equal(linkage.eventCount,4);
 // The original Buyer recovery already carries the authoritative deliveryId
 // without a second order or another stock reservation.
 const buyerRead=read("SELECT public.mobility_stage_g144_recover_order_qa("+
  qs(buyer)+","+qs(buyerSession)+","+issued+","+qs(key)+")");
 assert.equal(buyerRead.orderId,original.id);
 assert.equal(buyerRead.deliveryId,deliveryId);
 assert.equal(buyerRead.revision,5);
 assert.equal(buyerRead.status,'ready');
 assert.equal(buyerRead.orderEnabled,false);
 // Real B Client domain -> pinned HTTPS-shaped transport proxy -> A G139
 // bearer trust -> G144 exact Buyer requestKey -> SAME PostgreSQL row.
 const clientHost='https://qore-g152-buyer-ci.onrender.com';
 const buyerExpiresAt=Date.now()+60000;
 let buyerHttpGets=0;
 const bExperience=createClientExperience({
  authProvider:{readSession:async()=>({role:'passenger',subject:buyer,
   token:buyerToken,expiresAt:buyerExpiresAt}),signOut:async()=>{}},
  commerceQaHttpOptions:{
   enabled:true,contractCertified:true,disposableQaVerified:true,
   origin:clientHost,pinnedOrigin:clientHost,
   fetchImpl:(url,opts)=>{
    const u=new URL(url);
    assert.equal(u.origin,clientHost);
    assert.equal(u.pathname,'/v1/staging/buyer/orders/qa/requests/'+key);
    assert.equal(opts.method,'GET');buyerHttpGets++;
    return fetch(base+u.pathname,{...opts,redirect:'error'});
   }
  }
 });
 assert.equal((await bExperience.refreshSession()).ok,true);
 const bRecovery=await bExperience.recoverCommerceQa(key);
 assert.equal(bRecovery.ok,true,JSON.stringify(bRecovery));
 assert.equal(bRecovery.receipt.orderId,original.id);
 assert.equal(bRecovery.receipt.requestKey,key);
 assert.equal(bRecovery.receipt.status,'ready');
 assert.equal(bRecovery.receipt.revision,5);
 assert.equal(bRecovery.receipt.deliveryId,deliveryId);
 assert.equal(bRecovery.receipt.paymentConfirmed,false);
 assert.equal(bRecovery.receipt.dispatchConfirmed,false);
 assert.equal(buyerHttpGets,1,'One owner-scoped Buyer HTTP GET; no second reservation');
 // D Admin HTTP independently reads the very same order and linked delivery.
 const origin='https://g151-admin-ci.onrender.com',expiresAt=Date.now()+60000;
 const adminClient=createServiceTraceGateway({
  enabled:true,contractCertified:true,origin,pinnedOrigin:origin,
  now:()=>Date.now(),
  getSession:async()=>({role:'admin',mfaVerified:true,subject:admin,
   authRevision:1,token:adminToken,expiresAt}),
  fetchImpl:(url,opts)=>{
   const u=new URL(url);
   assert.equal(u.origin,origin);
   return fetch(base+u.pathname,{...opts,redirect:'error'});
  }
 });
 const adminResult=await adminClient.read('COMMERCE',original.id);
 assert.equal(adminResult.ok,true,JSON.stringify(adminResult));
 assert.equal(adminResult.data.deliveryId,deliveryId);
 assert.equal(adminResult.data.serviceId,original.id);
 assert.equal(adminResult.data.revision,5);
 assert.equal(adminResult.data.events.length,5);
 assert.equal(adminResult.data.events[4].status,'ready');
 assert.equal(adminResult.data.assignment.state,'NOT_ASSIGNABLE');
 assert.equal(adminResult.data.ledger,null);
 assert.equal(sql("SELECT status FROM public.mobility_stage_deliveries WHERE id="+qs(deliveryId)),'requested');
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_delivery_events WHERE delivery_id="+qs(deliveryId)),'0');
 console.log('G153 PASS: original reserved merchandise mass cannot exceed declared G5 cargo grams, even with G122 quote consent');
 console.log('G150 PASS: ORIGINAL G139 Buyer order -> G148 Merchant ready -> Buyer G5 delivery -> G7 server MOTO quote -> G122 immutable price consent -> G6 Merchant HTTP attach same orderId/deliveryId -> Buyer B original authenticated HTTP/G144 recovery AND Admin D AAL2 same link; no driver, PSP, LIVE or fake delivery.');
} finally {
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
}
