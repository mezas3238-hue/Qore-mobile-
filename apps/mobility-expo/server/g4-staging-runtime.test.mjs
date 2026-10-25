import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareQoreG4StagingRuntime} from './g4-staging-runtime.mjs';
import {listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {request as httpRequest} from 'node:http';

const ref='staging1234567890abcd';
const anonKey='sb_publishable_abcdefghijklmnopqrstuvwxyz';
const serviceKey='sb_secret_abcdefghijklmnopqrstuvwxyz';
const historyCursorSecrets={current:'qore-QA-independent-history-signing-key-only-2026'};
const passenger='11111111-1111-4111-8111-111111111111';
const driver='22222222-2222-4222-8222-222222222222';
const stranger='33333333-3333-4333-8333-333333333333';
const ride='44444444-4444-4444-8444-444444444444';
const offer='55555555-5555-4555-8555-555555555555';
const vehicle='66666666-6666-4666-8666-666666666666';
const requestKey='77777777-7777-4777-8777-777777777777';
const deliveryId='88888888-8888-4888-8888-888888888888';
const deliveryProof='99999999-9999-4999-8999-999999999999';
const fareQuote='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const payment='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now=100_000;
const jwt={rider:'syntheticRiderBearerTokenNoRealJwt12345',
 driver:'syntheticDriverBearerTokenNoRealJwt12345',
 stranger:'syntheticStrangerBearerTokenNoRealJwt12345'};
function mockSupabase(){
 const state={policy:true,missing:null,rolesLookups:0,dualRoleDriver:false,authCalls:0,rpcs:[],clients:[],
   adminRole:null,adminReceipt:null,g77RegisteredRoute:null,
  trip:{id:ride,passenger_id:passenger,driver_id:null,vehicle_id:null,
   status:'searching',revision:1,service:'economico',
   origin_tag:'PANTEON',destination_tag:'SHOPPING'},
  offer:{id:offer,trip_id:ride,driver_id:driver,status:'offered',
   expires_at:new Date(now+20_000).toISOString()},
  delivery:null,deliveryOffer:null,quote:null,payment:null};
 const request=async(url,opt)=>{
  assert.equal(url,'https://'+ref+'.supabase.co/auth/v1/settings');
  assert.equal(opt.method,'GET');
  assert.equal(opt.headers.apikey,anonKey);
  return {ok:true,json:async()=>({disable_signup:state.policy})};
 };
 const createClient=(url,key)=>{
  assert.equal(url,'https://'+ref+'.supabase.co');
  state.clients.push(key);
  if(key===anonKey)return {auth:{getUser:async(token)=>{
   state.authCalls++;
   const id=token===jwt.rider?passenger:token===jwt.driver?driver:token===jwt.stranger?stranger:null;
   return id?{data:{user:{id,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'}}}:
    {error:{message:'Unauthorized'}};
  }}};
  if(key!==serviceKey)throw Error('Wrong server key');
  return {
   from(table){
    let filter={};
    return {
     select(cols,options){
      return {
       eq(k,v){filter[k]=v;return this;},
       or(expression){filter.$or=expression;return this;},
       async limit(n){
        if(table==='user_roles'){
         state.rolesLookups++;
         const roles=filter.user_id===passenger?['passenger']:
          filter.user_id===driver?(state.dualRoleDriver?['driver','admin']:['driver']):[];
         return {data:roles.map(role=>({role})),error:null};
        }
        assert.equal(options?.head,true);
        assert.equal(n,0);
        return {error:state.missing===table?{code:'42P01'}:null};
       },
       async maybeSingle(){
        if(table==='mobility_stage_auto_demo_offers'){
         const o=state.offer;
         return {data:o.id===filter.id&&o.driver_id===filter.driver_id?{...o}:null,error:null};
        }
        if(table==='mobility_stage_auto_demo_trips'){
         const t=state.trip;
         const actor=filter.$or?.match(/passenger_id\.eq\.([^,]+)/)?.[1];
         const ok=t.id===filter.id&&
          (filter.driver_id===undefined||t.driver_id===filter.driver_id)&&
          (!actor||t.passenger_id===actor||t.driver_id===actor);
         return {data:ok?{...t}:null,error:null};
        }
        if(table==='mobility_stage_delivery_offers'){
         const o=state.deliveryOffer;
         return {data:o&&o.id===filter.id&&o.courier_id===filter.courier_id?
          {...o}:null,error:null};
        }
        if(table==='mobility_stage_deliveries'){
         const d=state.delivery;
         const actor=filter.$or?.match(/sender_id\.eq\.([^,]+)/)?.[1];
         const ok=d&&d.id===filter.id&&(filter.status!==undefined?
          d.status===filter.status:(d.sender_id===actor||d.courier_id===actor));
         return {data:ok?{...d}:null,error:null};
        }
        if(table==='mobility_stage_fare_quotes'){
         const q=state.quote;
         const ok=q&&q.id===filter.id&&q.customer_id===filter.customer_id;
         return {data:ok?{...q}:null,error:null};
        }
        if(table==='mobility_stage_payment_intents'){
         const p=state.payment;
         const ok=p&&p.id===filter.id&&p.customer_id===filter.customer_id;
         return {data:ok?{...p}:null,error:null};
        }
        return {data:null,error:null};
       }
      };
     },
    };
   },
   async rpc(name,params){
    state.rpcs.push({name,params});
    if(name==='mobility_stage_g73_route'){
     state.g77RegisteredRoute=params;
     return {data:offer,error:null};
    }
    if(name==='mobility_stage_g73_route_receipt'){
     return {data:state.g77RegisteredRoute?{
      mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
      ownerId:passenger,routeId:offer,
      requestKey:state.g77RegisteredRoute._request_key,
      service:'economico',routingVerified:true,expiresAt:now+10000
     }:null,error:null};
    }
    if(name==='mobility_stage_g27_backoffice_role_of')
     return {data:params._user===stranger?state.adminRole:null,error:null};
    if(name==='mobility_stage_g75_admin_f1_receipt')
     return {data:params._admin_id===stranger&&params._trip_id===ride?
      state.adminReceipt:null,error:null};
    if(name==='mobility_stage_auto_demo_request'){
     if(params._passenger_id!==passenger)return {error:{message:'Wrong passenger'}};
     return {data:ride,error:null};
    }
    if(name==='mobility_stage_auto_demo_accept_offer'){
     if(state.trip.status!=='searching'||params._driver_id!==driver||
        params._offer_id!==offer||state.offer.status!=='offered')
      return {error:{message:'Already decided'}};
     state.trip={...state.trip,status:'accepted',driver_id:driver,
      vehicle_id:vehicle,revision:2};
     state.offer.status='accepted';
     return {data:requestKey,error:null};
    }
    if(name==='mobility_stage_auto_demo_transition'){
     const next={arriving:'accepted',in_progress:'arriving',completed:'in_progress',cancelled:'searching'};
     if(params._trip_id!==ride||state.trip.status!==next[params._next]||
       (params._next==='cancelled'?params._actor_id!==passenger:
        params._actor_id!==driver))return {error:{message:'Transition denied'}};
     state.trip={...state.trip,status:params._next,revision:state.trip.revision+1};
     return {data:params._request_key,error:null};
    }
    if(name==='mobility_stage_delivery_request'){
     if(params._sender_id!==passenger||state.delivery)
      return {error:{message:'Delivery request denied'}};
     state.delivery={id:deliveryId,sender_id:passenger,courier_id:null,
      vehicle_id:null,requested_vehicle_kind:params._vehicle_kind,
      category:params._category,grams:params._grams,length_cm:params._length_cm,
      width_cm:params._width_cm,height_cm:params._height_cm,
      pickup_tag:params._pickup_tag,delivery_tag:params._delivery_tag,
      restricted_item_declared:false,status:'requested',revision:1,proof_ref:null};
     return {data:deliveryId,error:null};
    }
    if(name==='mobility_stage_delivery_accept'){
     if(params._courier_id!==driver||params._delivery_id!==deliveryId||
        state.delivery?.status!=='requested')return {error:{message:'Accept denied'}};
     state.delivery={...state.delivery,courier_id:driver,vehicle_id:params._vehicle_id,
      status:'accepted',revision:2};
     return {data:params._request_key,error:null};
    }
    if(name==='mobility_stage_delivery_accept_offer'){
     if(params._courier_id!==driver||params._offer_id!==offer||
        state.delivery?.status!=='requested'||state.deliveryOffer?.status!=='offered')
      return {error:{message:'Private delivery offer denied'}};
     state.delivery={...state.delivery,courier_id:driver,vehicle_id:vehicle,
      status:'accepted',revision:2};
     state.deliveryOffer.status='accepted';
     return {data:params._decision_key,error:null};
    }
    if(name==='mobility_stage_delivery_transition'){
     const expected={pickup:'accepted',deliver:'picked_up',dispute:'delivered',
      return:'disputed',cancel:'requested'};
     const actor=params._action==='dispute'||params._action==='cancel'?passenger:driver;
     if(params._delivery_id!==deliveryId||params._actor_id!==actor||
        state.delivery?.status!==expected[params._action])
      return {error:{message:'Custody transition denied'}};
     const next={pickup:'picked_up',deliver:'delivered',dispute:'disputed',
      return:'returned',cancel:'cancelled'}[params._action];
     state.delivery={...state.delivery,status:next,revision:state.delivery.revision+1,
      proof_ref:params._action==='deliver'?params._proof_ref:state.delivery.proof_ref};
     return {data:params._request_key,error:null};
    }
    if(name==='mobility_stage_fare_quote'){
     if(params._customer_id!==passenger||params._subject_id!==ride)
      return {error:{message:'Fare subject denied'}};
     state.quote={id:fareQuote,customer_id:passenger,mode:params._mode,
      subject_kind:params._subject_kind,subject_id:params._subject_id,
      subtotal_pyg:12000,tolls_pyg:1000,total_pyg:13000,commission_bps:1000,
      commission_pyg:1200,provider_pyg:11800,
      expires_at:new Date(now+5*60_000).toISOString(),
      mobility_stage_fare_rules:{rule_key:'auto-staging-v1'}};
     return {data:fareQuote,error:null};
    }
    if(name==='mobility_stage_payment_authorize'){
     if(params._customer_id!==passenger||params._quote_id!==fareQuote)
      return {error:{message:'Quote denied'}};
     state.payment={id:payment,quote_id:fareQuote,customer_id:passenger,
      method:params._method,amount_pyg:13000,status:'authorized',revision:1};
     return {data:payment,error:null};
    }
    if(name==='mobility_stage_payment_transition'){
     if(params._actor_id!==passenger||params._payment_id!==payment)
      return {error:{message:'Payment denied'}};
     state.payment={...state.payment,status:params._action==='cancel'?'cancelled':'captured',
      revision:state.payment.revision+1};
     return {data:params._request_key,error:null};
    }
    return {data:offer,error:null};
   },
  };
 };
 return {state,request,createClient};
}
const prepare=(m,options={})=>prepareQoreG4StagingRuntime({
 environment:'staging',liveTripsEnabled:false,allowQa:true,
 projectRef:ref,anonKey,serviceKey,historyCursorSecrets,
 request:m.request,createClient:m.createClient,now:()=>now,...options
});
async function http(runtime,callback){
 const base=await listenQoreRadarLoopback(runtime.server);
 try{return await callback(base);}
 finally{await new Promise((resolve,reject)=>runtime.server.close(e=>e?reject(e):resolve()));}
}
async function req(base,path,actor='rider',method='GET',body){
 const res=await fetch(base+path,{
  method,
  headers:{authorization:'Bearer '+jwt[actor],
   ...(body===undefined?{}:{'content-type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 return {status:res.status,body:await res.json()};
}
const statusPath='/v1/staging/rider/trips/'+ride+'/status';
const offerPath='/v1/staging/driver/offers/'+offer;
const acceptPath='/v1/staging/driver/offers/accept';
const requestPath='/v1/staging/rider/trips/request';
const transitionPath='/v1/staging/trips/'+ride+'/transition';
const deliveryRequestPath='/v1/staging/sender/deliveries/request';
const deliveryTransitionPath='/v1/staging/deliveries/'+deliveryId+'/transition';
const deliveryStatusPath='/v1/staging/deliveries/'+deliveryId+'/status';
const fareQuotePath='/v1/staging/fares/quote';
const paymentAuthorizePath='/v1/staging/payments/authorize';
const deliveryOfferPath='/v1/staging/courier/delivery-offers/'+offer;
const deliveryOfferAcceptPath='/v1/staging/courier/delivery-offers/accept';

test('boot refuses even loopback listener when native Auth signup remains public',async()=>{
 const m=mockSupabase();m.state.policy=false;
 await assert.rejects(prepare(m),/Auth public signup/);
 assert.equal(m.state.rpcs.length,0);
});
test('boot refuses G3/G4 missing private SQL tables (without any remote write)',async()=>{
 const m=mockSupabase();m.state.missing='mobility_stage_auto_demo_offers';
 await assert.rejects(prepare(m),/schema not installed/);
 assert.equal(m.state.rpcs.length,0);
});
test('boot rejects LIVE, old backend, unsafe env and public/foreign server role',async()=>{
 const m=mockSupabase();
 for(const options of [
  {environment:'production'},{liveTripsEnabled:true},
  {liveTripsEnabled:'false'},{allowQa:false},
  {projectRef:'qdqrlgzlotnfdxzpacxs'},
  {anonKey:serviceKey},{serviceKey:anonKey},
  {serviceKey:'sb_secret_bad'},
  {historyCursorSecrets:null},
  {historyCursorSecrets:{current:serviceKey}},
  {historyCursorSecrets:{current:anonKey}},
  {historyCursorSecrets:{current:'too-short'}},
  {historyCursorSecrets:{current:historyCursorSecrets.current,
   previous:historyCursorSecrets.current}}
 ])await assert.rejects(prepare(m,options));
 assert.equal(m.state.rpcs.length,0);
});
test('real HTTP with Supabase-like adapters verifies role/JWT and uses server-derived driver ID',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 assert.equal(runtime.commercialRidesEnabled,false);
 assert.equal(runtime.server.listening,false);
 await http(runtime,async base=>{
  const searching=await req(base,statusPath);
  assert.equal(searching.status,200);
  assert.equal(searching.body.event.acceptedDriver,null);
  assert.equal((await req(base,offerPath,'stranger')).status,403);
  const open=await req(base,offerPath,'driver');
  assert.equal(open.status,200);
  assert.equal(open.body.expiresAtMs,now+20_000);
  const accepted=await req(base,acceptPath,'driver','POST',{offerId:offer,requestKey});
  assert.equal(accepted.status,200);
  assert.equal(accepted.body.passengerEventDelivered,false);
  assert.deepEqual(m.state.rpcs,[{
   name:'mobility_stage_auto_demo_accept_offer',
   params:{_offer_id:offer,_driver_id:driver,_decision_key:requestKey}
  }]);
  // G1 profile table has no name/photo/rating: NEVER make up an identity.
  const after=await req(base,statusPath);
  assert.equal(after.status,503);
  assert.doesNotMatch(JSON.stringify(after),/TEST777|Toyota|-25\./);
  assert.equal((await req(base,statusPath,'stranger')).status,403);
 });
});
test('runtime persists passenger request and driver transition through shared repository',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  const created=await req(base,requestPath,'rider','POST',{
   requestKey,originTag:'PANTEON',destinationTag:'SHOPPING',service:'economico'
  });
  assert.equal(created.status,201);
  assert.equal(created.body.tripId,ride);
  assert.equal((await req(base,requestPath,'driver','POST',{
   requestKey,originTag:'PANTEON',destinationTag:'SHOPPING',service:'economico'
  })).status,403);
  assert.equal((await req(base,acceptPath,'driver','POST',
   {offerId:offer,requestKey})).status,200);
  const eventKey='88888888-8888-4888-8888-888888888888';
  const arriving=await req(base,transitionPath,'driver','POST',
   {event:'arrive',eventKey});
  assert.equal(arriving.status,200);
  assert.equal(arriving.body.serverPersisted,true);
  assert.equal(m.state.trip.status,'arriving');
  const rpc=m.state.rpcs.at(-1);
  assert.deepEqual(rpc,{name:'mobility_stage_auto_demo_transition',params:{
   _trip_id:ride,_actor_id:driver,_next:'arriving',_request_key:eventKey
  }});
  const before=m.state.rpcs.length;
  assert.equal((await req(base,transitionPath,'rider','POST',
   {event:'pickup',eventKey})).status,403);
  assert.equal(m.state.rpcs.length,before);
 });
});
test('runtime persists AUTO delivery custody and returns only participant status',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  const created=await req(base,deliveryRequestPath,'rider','POST',{
   requestKey,vehicleKind:'AUTO',category:'RESTAURANT',grams:3500,
   lengthCm:40,widthCm:30,heightCm:25,pickupTag:'RESTAURANT_A',
   deliveryTag:'CUSTOMER_A',restrictedItemDeclared:false,
  });
  assert.equal(created.status,201);
  assert.equal(created.body.deliveryId,deliveryId);
  m.state.deliveryOffer={id:offer,delivery_id:deliveryId,courier_id:driver,
   vehicle_id:vehicle,status:'offered',expires_at:new Date(now+30_000).toISOString()};
  assert.equal((await req(base,deliveryOfferAcceptPath,'driver','POST',{
   offerId:offer,requestKey,
  })).status,200);
  assert.equal((await req(base,deliveryTransitionPath,'driver','POST',{
   event:'pickup',eventKey:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  })).status,200);
  assert.equal((await req(base,deliveryTransitionPath,'driver','POST',{
   event:'deliver',eventKey:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   proofRef:deliveryProof,
  })).status,200);
  const status=await req(base,deliveryStatusPath,'rider');
  assert.equal(status.status,200);
  assert.equal(status.body.delivery.status,'delivered');
  assert.equal(status.body.delivery.proofRef,deliveryProof);
  assert.equal((await req(base,deliveryStatusPath,'stranger')).status,403);
  assert.doesNotMatch(JSON.stringify(status),/sb_secret|service_role/);
 });
});
test('runtime keeps G10 delivery offer private and accepts through atomic offer RPC',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,deliveryRequestPath,'rider','POST',{
   requestKey,vehicleKind:'AUTO',category:'PARCEL',grams:1000,
   lengthCm:20,widthCm:15,heightCm:10,pickupTag:'SHOP_A',
   deliveryTag:'CLIENT_A',restrictedItemDeclared:false,
  })).status,201);
  m.state.deliveryOffer={id:offer,delivery_id:deliveryId,courier_id:driver,
   vehicle_id:vehicle,status:'offered',expires_at:new Date(now+30_000).toISOString()};
  assert.equal((await req(base,deliveryOfferPath,'stranger')).status,403);
  const preview=await req(base,deliveryOfferPath,'driver');
  assert.equal(preview.status,200);assert.equal(preview.body.deliveryId,deliveryId);
  assert.equal(preview.body.confirmedAcceptance,false);
  const accepted=await req(base,deliveryOfferAcceptPath,'driver','POST',{
   offerId:offer,requestKey});
  assert.equal(accepted.status,200);assert.equal(accepted.body.eventId,requestKey);
  assert.deepEqual(m.state.rpcs.at(-1),{
   name:'mobility_stage_delivery_accept_offer',params:{_offer_id:offer,
    _courier_id:driver,_decision_key:requestKey}});
 });
});
test('runtime derives fare context server-side and exposes only simulated payment state',async()=>{
 const m=mockSupabase(),runtime=await prepare(m,{pricingContext:async input=>{
  assert.deepEqual(input,{actorId:passenger,fareMode:'AUTO',subjectKind:'RIDE',
   subjectId:ride});
  return {zoneTag:'ASUNCION_FIXTURE',distanceMeters:4000,durationSeconds:600,
   tollsPyg:1000,trafficAware:true,fallbackUsed:false};
 }});
 await http(runtime,async base=>{
  const quoted=await req(base,fareQuotePath,'rider','POST',{requestKey,
   fareMode:'AUTO',subjectKind:'RIDE',subjectId:ride});
  assert.equal(quoted.status,201);
  assert.equal(quoted.body.quote.totalPyg,13000);
  assert.equal(quoted.body.serverPriced,true);
  const authorized=await req(base,paymentAuthorizePath,'rider','POST',{
   requestKey,quoteId:fareQuote,method:'SIMULATED_CARD'});
  assert.equal(authorized.status,201);
  assert.equal(authorized.body.paymentId,payment);
  const status=await req(base,`/v1/staging/payments/${payment}/status`);
  assert.equal(status.status,200);
  assert.equal(status.body.payment.status,'authorized');
  assert.equal((await req(base,paymentAuthorizePath,'rider','POST',{
   requestKey,quoteId:fareQuote,method:'CARD'})).status,400);
  assert.equal((await req(base,fareQuotePath,'stranger','POST',{requestKey,
   fareMode:'AUTO',subjectKind:'RIDE',subjectId:ride})).status,403);
 });
});
test('turning public signup ON after start stops every request BEFORE Auth/SQL',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,statusPath)).status,200);
  const prior=m.state.authCalls;
  m.state.policy=false;
  assert.equal((await req(base,statusPath)).status,503);
  assert.equal((await req(base,acceptPath,'driver','POST',{offerId:offer,requestKey})).status,503);
  assert.equal(m.state.authCalls,prior);
  assert.equal(m.state.rpcs.length,0);
 });
});
test('private service key and internal SQL data never appear in HTTP response',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  for(const [path,actor] of [[statusPath,'rider'],[offerPath,'driver']]){
   const response=await req(base,path,actor);
   assert.equal(response.status,200);
   assert.doesNotMatch(JSON.stringify(response),/sb_secret|sb_publishable|service_role/);
  }
 });
});

test('dual-role driver with admin privileges is denied private offers and acceptance',async()=>{
 const m=mockSupabase();m.state.dualRoleDriver=true;
 const runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,offerPath,'driver')).status,403);
  assert.equal((await req(base,acceptPath,'driver','POST',{offerId:offer,requestKey})).status,403);
  assert.equal(m.state.rpcs.length,0);
 });
});

const g76Path='/v1/staging/admin/rides/'+ride+'/f1-verification';
const trust=(mods={})=>({
 verifyAdminSession:async token=>{
  if(token!==jwt.stranger)throw Error('Independent IdP rejected session');
  return {id:stranger,sessionId:vehicle,
   expiresAtMs:now+600000,is_anonymous:false};
 },
 verifySessionNotRevoked:async()=>true,
 verifyBackofficeMfa:async({userId,sessionId,at})=>({
  verifiedByProvider:true,userId,sessionId,assuranceLevel:'aal2',
  verifiedAtMs:at-500,expiresAtMs:at+20000
 }),
 ...mods
});
const adminF1Receipt=()=>({
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 viewerId:stranger,tripId:ride,routeId:offer,quoteId:fareQuote,
 passengerId:passenger,bookingRequestKey:requestKey,service:'economico',
 currency:'PYG',amountGs:13000,fareVersion:'qa-g73-f1',revision:1,
 status:'searching',assignmentPersisted:false,driverId:null,
 observedAt:now-1000,expiresAt:now+30000,serverPersisted:true
});
test('G76 unconfigured local runtime denies Admin F1 and never reads SQL',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,g76Path,'stranger')).status,503);
  assert.equal(m.state.rpcs.filter(x=>x.name.includes('g75')).length,0);
 });
});
test('G76 independent IdP, provider AAL2, revocation and exclusive Admin bind 19-field SQL',async()=>{
 const m=mockSupabase();m.state.adminRole='admin';m.state.adminReceipt=adminF1Receipt();
 const runtime=await prepare(m,{adminF1Trust:trust()});
 await http(runtime,async base=>{
  assert.equal((await req(base,g76Path,'rider')).status,401);
  const result=await req(base,g76Path,'stranger');
  assert.equal(result.status,200);
  assert.deepEqual(result.body,adminF1Receipt());
  assert.equal(Object.keys(result.body).length,19);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g75_admin_f1_receipt').length,1);
  assert.deepEqual(m.state.rpcs.at(-1),{
   name:'mobility_stage_g75_admin_f1_receipt',
   params:{_admin_id:stranger,_trip_id:ride}
  });
 });
});
test('G76 refused MFA, revoked token, fake IdP actor, Owner never reads receipt',async()=>{
 for(const bad of [
  {trust:{verifySessionNotRevoked:async()=>false},status:401},
  {trust:{verifyBackofficeMfa:async()=>({verifiedByProvider:false})},status:403},
  {trust:{verifyAdminSession:async()=>({id:passenger})},status:401},
  {trust:{},role:'owner',status:403}
 ]){
  const m=mockSupabase();
  m.state.adminRole=bad.role??'admin';m.state.adminReceipt=adminF1Receipt();
  const runtime=await prepare(m,{adminF1Trust:trust(bad.trust)});
  await http(runtime,async base=>{
   assert.equal((await req(base,g76Path,'stranger')).status,bad.status);
   assert(!m.state.rpcs.some(x=>x.name==='mobility_stage_g75_admin_f1_receipt'));
  });
 }
});
test('G76 startup rejects incomplete, extra or unverified Admin trust adapters',async()=>{
 for(const bad of [{verifyAdminSession:()=>{}},
  {verifyAdminSession:()=>{},verifySessionNotRevoked:()=>{},
   verifyBackofficeMfa:()=>{},fakeMfa:true},
  {verifyAdminSession:true,verifySessionNotRevoked:()=>{},verifyBackofficeMfa:()=>{}}]){
  const m=mockSupabase();
  await assert.rejects(prepare(m,{adminF1Trust:bad}));
  assert.equal(m.state.clients.length,0);
 }
});

const g79Origin='Centro, Asunción',g79Destination='Aeropuerto, Luque';
const g79Path='/v1/staging/rider/auto/routes';
const g79PlaceA='ChIJTrustedPlaceAsuncion00001',
 g79PlaceB='ChIJTrustedPlaceLuque000002',
 g79Proof='79790000-0000-4797-8797-000000000001',
 g79Toll='79790000-0000-4797-8797-000000000002';
function g79Options({coverageEnabled=true,chargesEnabled=true}={}){
 const calls={paid:0,cover:0,tolls:0};
 const options={
  enabled:true,billableProviderApproved:true,
  apiKey:'QA_PRIVATE_GOOGLE_FAKE_NOT_REAL_0123456789',
  tagSecret:'QA_PRIVATE_HMAC_32_BYTES_NEVER_REAL_2026',
  resolveCoveredPlaces:async p=>{
   calls.cover++;
   return {source:'INDEPENDENT_COVERAGE_AUTHORITY',
    coverageVerified:coverageEnabled,evidenceId:g79Proof,revision:1,
    verifiedAtMs:now-100,actorId:p.actorId,
    origin:p.origin,destination:p.destination,service:p.service,
    originPlaceId:g79PlaceA,destinationPlaceId:g79PlaceB,
    originTag:'PREVERIFY_ORIGIN',destinationTag:'PREVERIFY_DESTINATION',
    zoneTag:'ASUNCION_FIXTURE'};
  },
  verifyRouteTolls:async s=>{
   calls.tolls++;
   return {source:'INDEPENDENT_TOLL_AUTHORITY',tollsVerified:chargesEnabled,
    coverageEvidenceId:g79Proof,evidenceId:g79Toll,
    originPlaceId:g79PlaceA,destinationPlaceId:g79PlaceB,
    distanceMeters:s.distanceMeters,durationSeconds:s.durationSeconds,
    verifiedAtMs:now-100,tollsPyg:0};
  },
  request:async(url,init)=>{
   calls.paid++;
   assert.equal(url,'https://routes.googleapis.com/directions/v2:computeRoutes');
   assert.equal(init.method,'POST');
   assert.equal(init.headers['X-Goog-FieldMask'],
    'routes.distanceMeters,routes.duration,fallbackInfo');
   assert.equal(JSON.parse(init.body).origin.placeId,g79PlaceA);
   return {ok:true,status:200,redirected:false,
    headers:{get:key=>key==='content-type'?'application/json':null},
    text:async()=>JSON.stringify({routes:[{distanceMeters:5000,duration:'600s'}]})};
  }
 };
 return {options,calls};
}
test('G79 only selected precoverage G77 provider reaches exact G73 route SQL on loopback',async()=>{
 const m=mockSupabase(),f=g79Options();
 const runtime=await prepare(m,{g77RouteOptions:f.options});
 await http(runtime,async base=>{
  const result=await req(base,g79Path,'rider','POST',{
   quoteRequestKey:requestKey,origin:g79Origin,destination:g79Destination,
   service:'economico'
  });
  assert.equal(result.status,200);
  assert.equal(result.body.routeId,offer);
  assert.equal(result.body.routingVerified,true);
  assert.equal(result.body.coverageVerified,true);
  assert.equal(result.body.status,'ROUTE_VERIFIED_QA');
  assert.deepEqual(f.calls,{paid:1,cover:1,tolls:1});
  assert.equal(m.state.g77RegisteredRoute._distance_meters,5000);
  assert.equal(m.state.g77RegisteredRoute._duration_seconds,600);
  assert.equal(m.state.g77RegisteredRoute._tolls_pyg,0);
  assert.match(m.state.g77RegisteredRoute._origin_tag,/^LOC_[A-P]{32}$/);
  assert.match(m.state.g77RegisteredRoute._destination_tag,/^LOC_[A-P]{32}$/);
  assert.notEqual(m.state.g77RegisteredRoute._origin_tag,
   m.state.g77RegisteredRoute._destination_tag);
  assert(!JSON.stringify(m.state.g77RegisteredRoute).includes(g79PlaceA));
  assert(!JSON.stringify(result.body).includes(g79PlaceA));
  assert(!JSON.stringify(result.body).includes(f.options.apiKey));
 });
});
test('G79 unverified coverage before paid provider never reaches Google nor G73 SQL',async()=>{
 const m=mockSupabase(),f=g79Options({coverageEnabled:false});
 const runtime=await prepare(m,{g77RouteOptions:f.options});
 await http(runtime,async base=>{
  const fail=await req(base,g79Path,'rider','POST',{
   quoteRequestKey:requestKey,origin:g79Origin,destination:g79Destination,
   service:'economico'
  });
  assert.equal(fail.status,409);
  assert.deepEqual(f.calls,{paid:0,cover:1,tolls:0});
  assert.equal(m.state.g77RegisteredRoute,null);
  assert.equal(m.state.rpcs.some(x=>x.name==='mobility_stage_g73_route'),false);
 });
});
test('G79 invalid toll after one trusted route cannot publish/price or persist SQL',async()=>{
 const m=mockSupabase(),f=g79Options({chargesEnabled:false});
 const runtime=await prepare(m,{g77RouteOptions:f.options});
 await http(runtime,async base=>{
  const fail=await req(base,g79Path,'rider','POST',{
   quoteRequestKey:requestKey,origin:g79Origin,destination:g79Destination,
   service:'economico'
  });
  assert.equal(fail.status,409);
  assert.deepEqual(f.calls,{paid:1,cover:1,tolls:1});
  assert.equal(m.state.g77RegisteredRoute,null);
 });
});
test('G79 never mounts two route providers or billing-disabled/corrupted config',async()=>{
 const first=g79Options();
 for(const bad of [
  {g77RouteOptions:first.options,verifiedAutoRoute:async()=>({})},
  {g77RouteOptions:{...first.options,enabled:false}},
  {g77RouteOptions:{...first.options,billableProviderApproved:false}},
  {g77RouteOptions:{...first.options,tagSecret:null}},
  {g77RouteOptions:{...first.options,geocodingFirst:true}}
 ]){
  const m=mockSupabase();
  await assert.rejects(prepare(m,bad));
  assert.equal(m.state.clients.length,0);
  assert.equal(m.state.rpcs.length,0);
 }
 assert.equal(first.calls.paid,0);
});

const g80Path='/v1/staging/driver/kyc/validity';
const g80Expired=()=>({mode:'STAGING_DEMO_ONLY',state:'BLOCKED_EXPIRED',
 expiredKinds:['licencia'],renewalRequiredKinds:['licencia'],expiringSoonKinds:[],
 nearestExpiryAtMs:now+86400000,accountBlocked:true,qaOnboardingActive:false,
 commercialDispatchAuthorized:false,qaOnly:true,productionEnabled:false});
function g80Trust({validity=g80Expired(),...changes}={}){
 const reads=[];
 return {reads,trust:{
  verifyDriverSession:async token=>{
   if(token!==jwt.driver)throw Error('not independently verified');
   return {id:driver,sessionId:vehicle,tokenIatMs:now-1000,
    expiresAtMs:now+60000,is_anonymous:false};
  },
  verifySessionNotRevoked:async()=>true,
  resolveActiveVehicle:async id=>({driverId:id,vehicleId:vehicle}),
  queryOwnerValidity:async scope=>{reads.push(scope);return validity;},
  ...changes
 }};
}
test('G80 expiry HTTP defaults 503 and does not read KYC without owner-only authority',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,g80Path,'driver')).status,503);
  assert.equal(m.state.rpcs.length,0);
 });
});
test('G80 real local HTTP shows expired Driver document and owner-scope read, no file data',async()=>{
 const m=mockSupabase(),f=g80Trust(),runtime=await prepare(m,{driverKycTrust:f.trust});
 await http(runtime,async base=>{
  const result=await req(base,g80Path,'driver');
  assert.equal(result.status,200);
  assert.deepEqual(result.body,g80Expired());
  assert.deepEqual(f.reads,[{driverId:driver,vehicleId:vehicle}]);
  assert.equal((await req(base,g80Path,'rider')).status,503);
  assert.equal((await req(base,g80Path,'stranger')).status,503);
  assert.equal(f.reads.length,1,'foreign JWT must never reach private KYC');
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_PHOTO|sb_secret|faceTemplate/);
 });
});
test('G80 independently verified renewal changes QA state but never authorizes commerce',async()=>{
 const m=mockSupabase(),f=g80Trust({validity:{...g80Expired(),
  state:'READY_QA',expiredKinds:[],renewalRequiredKinds:[],
  accountBlocked:false,qaOnboardingActive:true}});
 const runtime=await prepare(m,{driverKycTrust:f.trust});
 await http(runtime,async base=>{
  const status=await req(base,g80Path,'driver');
  assert.equal(status.status,200);
  assert.equal(status.body.accountBlocked,false);
  assert.equal(status.body.commercialDispatchAuthorized,false);
  assert.equal(status.body.productionEnabled,false);
 });
});
test('G80 revoked session, foreign vehicle or untrusted renewal denied without status data',async()=>{
 for(const patch of [
  {verifySessionNotRevoked:async()=>false},
  {resolveActiveVehicle:async()=>({driverId:passenger,vehicleId:vehicle})},
  {verifyDriverSession:async()=>({id:passenger})},
  {validity:{...g80Expired(),commercialDispatchAuthorized:true}},
  {validity:{...g80Expired(),identityCard:'PII'}}
 ]){
  const m=mockSupabase(),f=g80Trust(patch);
  const runtime=await prepare(m,{driverKycTrust:f.trust});
  await http(runtime,async base=>{
   const res=await req(base,g80Path,'driver');
   assert.notEqual(res.status,200);
   assert.doesNotMatch(JSON.stringify(res),/identityCard|PII/);
  });
 }
});
test('G80 malformed owner-only trust refused before Auth and database initialization',async()=>{
 const f=g80Trust();
 for(const bad of [
  {...f.trust,queryOwnerValidity:null},
  {...f.trust,verifySessionNotRevoked:null},
  {...f.trust,permitServiceRole:true}
 ]){
  const m=mockSupabase();
  await assert.rejects(prepare(m,{driverKycTrust:bad}));
  assert.equal(m.state.clients.length,0);
 }
});

const g65Path='/v1/staging/driver/trips/'+ride+'/status';
test('G65 transport remains unavailable without independently attested Driver session',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,g65Path,'driver')).status,503);
  assert.equal((await req(base,g65Path,'rider')).status,503);
  assert.equal((await req(base,g65Path,'driver','POST',{})).status,404);
 });
});
test('G65 same G73/G3 trip is private via real loopback HTTP and SQL Driver scope',async()=>{
 const m=mockSupabase(),trust=g80Trust();
 const runtime=await prepare(m,{driverKycTrust:trust.trust});
 await http(runtime,async base=>{
  assert.equal((await req(base,g65Path,'driver')).status,404,
   'unassigned searching trip cannot appear to Driver');
  m.state.trip={...m.state.trip,driver_id:driver,vehicle_id:vehicle,
   status:'accepted',revision:2};
  const accepted=await req(base,g65Path,'driver');
  assert.equal(accepted.status,200);
  assert.equal(accepted.body.tripId,ride);
  assert.equal(accepted.body.state,'accepted');
  assert.equal(accepted.body.nextEvent,'arrive');
  assert.equal(accepted.body.assignmentPersisted,true);
  assert.equal(accepted.body.productionEnabled,false);
  assert.equal(accepted.body.gpsVerified,false);
  assert.doesNotMatch(JSON.stringify(accepted),new RegExp(passenger));
  assert.doesNotMatch(JSON.stringify(accepted),/origin_tag|destination_tag|phone|plate/i);
  assert.equal((await req(base,g65Path,'rider')).status,401);
  assert.equal((await req(base,g65Path,'stranger')).status,401);
  m.state.trip={...m.state.trip,status:'arriving',revision:3};
  const arriving=await req(base,g65Path,'driver');
  assert.equal(arriving.body.nextEvent,'pickup');
  assert.equal(arriving.body.revision,3);
  m.state.dualRoleDriver=true;
  assert.equal((await req(base,g65Path,'driver')).status,403,
   'dual-role principal must not acquire Driver data');
 });
});
test('G65 private API denies revoked or mismatched IdP and forbids GET request body',async()=>{
 let revoked=false;
 const m=mockSupabase(),f=g80Trust({
  verifySessionNotRevoked:async()=>!revoked
 });
 m.state.trip={...m.state.trip,driver_id:driver,vehicle_id:vehicle,
  status:'accepted',revision:2};
 const runtime=await prepare(m,{driverKycTrust:f.trust});
 await http(runtime,async base=>{
  // Undici/fetch silently drops Content-Length on bodyless GET. Exercise
  // actual wire bytes so this is a real HTTP rejection, not a false test.
  const getBodyStatus=await new Promise((resolve,reject)=>{
   const request=httpRequest(base+g65Path,{
    method:'GET',
    headers:{authorization:'Bearer '+jwt.driver,
     'content-type':'application/json','content-length':'2'}
   },response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});
   request.on('error',reject);
   request.end('{}');
  });
  assert.equal(getBodyStatus,400);
  revoked=true;
  assert.equal((await req(base,g65Path,'driver')).status,401);
 });
 const second=mockSupabase(),mismatch=g80Trust({
  verifyDriverSession:async()=>({id:passenger,sessionId:vehicle,
   tokenIatMs:now-1000,expiresAtMs:now+60000,is_anonymous:false})
 });
 second.state.trip={...second.state.trip,driver_id:driver,vehicle_id:vehicle,
  status:'accepted',revision:2};
 const otherRuntime=await prepare(second,{driverKycTrust:mismatch.trust});
 await http(otherRuntime,async base=>{
  assert.equal((await req(base,g65Path,'driver')).status,401);
 });
});
