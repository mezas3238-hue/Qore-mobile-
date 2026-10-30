import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareQoreG4StagingRuntime} from './g4-staging-runtime.mjs';
import {listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
import {request as httpRequest} from 'node:http';
import {reconcilePrivateDriverOffer} from '../../movete-driver/src/domain/driver-offer-decision.mjs';
import {transitionPrivateDriverTrip} from '../../movete-driver/src/domain/driver-trip-lifecycle-http.mjs';

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
   adminRole:null,adminReceipt:null,autoTraceReceipt:null,motoTraceReceipt:null,cargoTraceReceipt:null,
   g77RegisteredRoute:null,
   g84Enabled:false,g84DispatchAttempts:0,g113BatchCalls:0,g89TripReadError:false,
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
       in(k,values){filter[k]=values;return this;},
       async limit(n){
        // G170: bounded G106 Driver-only original trip recovery query.
        if(table==='mobility_stage_auto_demo_trips'&&n===2&&
         filter.driver_id!==undefined){
         state.g106RecoveryReads=(state.g106RecoveryReads??0)+1;
         if(state.g89TripReadError)return {data:null,error:{code:'08006'}};
         const t=state.trip;
         const active=t.driver_id===filter.driver_id&&
          Array.isArray(filter.status)&&filter.status.includes(t.status);
         const rows=active?[{id:t.id,driver_id:t.driver_id,
          status:t.status,revision:t.revision}]:[];
         if(active&&state.g106DuplicateAssignment===true)
          rows.push({...rows[0],id:deliveryId});
         return {data:rows,error:null};
        }
        if(table==='user_roles'){
         if(state.missing===table)return {data:null,error:{code:'42P01'}};
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
         if(state.g89TripReadError)return {data:null,error:{code:'08006',message:'offline'}};
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
    if(state.g84Enabled&&name==='mobility_stage_g73_book'){
     assert.equal(params._passenger_id,passenger);
     return {data:ride,error:null};
    }
    if(state.g84Enabled&&name==='mobility_stage_g73_booking_receipt'){
     return {data:{mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
      ownerId:passenger,requestKey:requestKey,quoteId:fareQuote,
      routeId:offer,tripId:ride,revision:1,serverPersisted:true,
      status:'ACCEPTED_QA'},error:null};
    }
    if(state.g84Enabled&&name==='mobility_stage_g112_run_booked_auto_dispatch_qa'){
     assert.deepEqual(params,{_passenger_id:passenger,_booking_key:requestKey,
      _trip_id:ride});
     state.g84DispatchAttempts++;
     return {data:{mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
      status:'OFFERED',tripId:ride,offerId:offer},error:null};
    }
    if(state.g84Enabled&&name==='mobility_stage_poll_driver_auto_offers'){
     return {data:state.g84DispatchAttempts>0?[{offer_id:offer,trip_id:ride,
      expires_at:new Date(now+20000).toISOString()}]:[],error:null};
    }
    if(state.g84Enabled&&name==='mobility_stage_poll_courier_delivery_offers'){
     return {data:[],error:null};
    }
    if(name==='mobility_stage_g113_run_due_auto_batch_qa'){
     assert.deepEqual(params,{_limit:5});
     state.g113BatchCalls++;
     return {data:{mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
      processed:0,waiting:0,offered:0,closed:0,exhausted:0},error:null};
    }
    if(name==='mobility_stage_g90_passenger_dispatch_status_qa'){
     return {data:params._passenger_id===passenger&&params._booking_key===requestKey?
      {mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:passenger,
       bookingKey:requestKey,tripId:ride,tripState:'searching',
       dispatchState:state.g84Enabled?(state.g84DispatchAttempts>0?
        'OFFER_PENDING':'SEARCHING_DRIVER'):'RETRY_PENDING',
       attempts:state.g84Enabled?state.g84DispatchAttempts:1,
       offerPendingAcceptance:state.g84Enabled&&state.g84DispatchAttempts>0}:null,
       error:null};
    }
    if(name==='mobility_stage_g73_route'){
     state.g77RegisteredRoute=params;
     return {data:offer,error:null};
    }
    if(name==='mobility_stage_g73_route_receipt'){
     return {data:state.g77RegisteredRoute?{
      mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
      ownerId:passenger,routeId:offer,
      requestKey:state.g77RegisteredRoute._request_key,
      service:'economico',routingVerified:true,expiresAt:(state.routeClock??now)+10000
     }:null,error:null};
    }
    if(name==='mobility_stage_g27_backoffice_role_of')
     return {data:params._user===stranger?state.adminRole:null,error:null};
    if(name==='mobility_stage_g27_backoffice_has_scope')
     return {data:params._user===stranger&&state.adminRole==='admin'&&
      params._scope==='admin.incidents.read',error:null};
    if(name==='mobility_stage_g75_admin_f1_receipt')
     return {data:params._admin_id===stranger&&params._trip_id===ride?
      state.adminReceipt:null,error:null};
    if(name==='mobility_stage_g138_auto_trace_qa')
     return {data:params._admin===stranger&&params._trip===ride?
      state.autoTraceReceipt:null,error:null};
    if(name==='mobility_stage_g142_moto_trace_qa')
     return {data:params._admin===stranger&&params._trip===ride?
      state.motoTraceReceipt:null,error:null};
    if(name==='mobility_stage_g145_delivery_trace_qa')
     return {data:params._admin===stranger&&params._delivery===deliveryId?
      state.cargoTraceReceipt:null,error:null};
    if(name==='mobility_stage_g219_active_delivery_trace_qa')
     return {data:params._admin===stranger&&params._delivery===deliveryId?
      (state.activeCargoTraceReceipt??null):null,error:null};
    if(name==='mobility_stage_g216_completed_delivery_trace_qa')
     return {data:params._admin===stranger&&params._delivery===deliveryId?
      (state.completedCargoTraceReceipt??null):null,error:null};
    if(name==='mobility_stage_auto_demo_request'){
     if(params._passenger_id!==passenger)return {error:{message:'Wrong passenger'}};
     return {data:ride,error:null};
    }
    if(name==='mobility_stage_g205_accept_original_auto_qa'){
     if(state.trip.status!=='searching'||params._driver!==driver||
        params._offer!==offer||params._session!==vehicle||
        params._iat!==99000||state.offer.status!=='offered')
      return {error:{message:'Already decided'}};
     state.trip={...state.trip,status:'accepted',driver_id:driver,
      vehicle_id:vehicle,revision:2};
     state.offer.status='accepted';
     return {data:requestKey,error:null};
    }
    if(name==='mobility_stage_g177_driver_auto_step_qa'){
     // G210: contract-level simulation ONLY. G38 deliberately forbids
     // legal policy issuance inside disposable PostgreSQL (no commercial GO).
     state.g210Events??=new Map();
     const existing=state.g210Events.get(params._key);
     if(existing)return existing.event===params._event&&existing.trip===params._trip?
      {data:params._key,error:null}:{error:{code:'P1771'}};
     const before={arrive:'accepted',pickup:'arriving',complete:'in_progress'};
     const after={arrive:'arriving',pickup:'in_progress',complete:'completed'};
     if(params._driver!==driver||params._session!==vehicle||
      params._iat!==99000||params._trip!==ride||
      state.offer.status!=='accepted'||state.trip.driver_id!==driver||
      state.trip.status!==before[params._event])
      return {error:{code:'P1771'}};
     state.g210Events.set(params._key,{event:params._event,trip:params._trip});
     state.trip={...state.trip,status:after[params._event],
      revision:state.trip.revision+1};
     return {data:params._key,error:null};
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
test('real HTTP with independently revocable Driver IdP verifies server-derived actor',async()=>{
 const m=mockSupabase(),runtime=await prepare(m,{driverKycTrust:g80Trust().trust});
 assert.equal(runtime.commercialRidesEnabled,false);
 assert.equal(runtime.server.listening,false);
 await http(runtime,async base=>{
  const searching=await req(base,statusPath);
  assert.equal(searching.status,200);
  assert.equal(searching.body.event.acceptedDriver,null);
  assert.equal((await req(base,offerPath,'stranger')).status,401);
  const open=await req(base,offerPath,'driver');
  assert.equal(open.status,200);
  assert.equal(open.body.expiresAtMs,now+20_000);
  const accepted=await req(base,acceptPath,'driver','POST',{offerId:offer,requestKey});
  assert.equal(accepted.status,200);
  assert.equal(accepted.body.passengerEventDelivered,false);
  assert.deepEqual(m.state.rpcs,[{
   name:'mobility_stage_g205_accept_original_auto_qa',
   params:{_offer:offer,_driver:driver,_decision:requestKey,
    _session:vehicle,_iat:99000}
  }]);
  // G1 profile table has no name/photo/rating: NEVER make up an identity.
  const after=await req(base,statusPath);
  assert.equal(after.status,200);
  assert.equal(after.body.tripId,ride);
  assert.equal(after.body.state,'assigned');
  assert.equal(after.body.assignmentPersisted,true);
  assert.equal(after.body.revision,2);
  assert.equal(after.body.event.status,'accepted');
  assert.equal(after.body.driver,null);
  assert.equal(after.body.vehicle,null);
  assert.equal(after.body.event.acceptedDriver,null);
  assert.equal(after.body.event.tracking,null);
  assert.equal(after.body.location,null);
  assert.equal(after.body.etaVerified,false);
  assert.equal(after.body.gpsConsent,false);
  assert.doesNotMatch(JSON.stringify(after),/TEST777|Toyota|-25\./);
  assert.equal((await req(base,statusPath,'stranger')).status,403);
 });
});
test('G180 unprovisioned revocable Driver IdP blocks all private offer/inbox/accept routes',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,offerPath,'driver')).status,401);
  assert.equal((await req(base,'/v1/staging/driver/inbox','driver')).status,401);
  assert.equal((await req(base,acceptPath,'driver','POST',
   {offerId:offer,requestKey})).status,401);
  assert.equal(m.state.rpcs.filter(x=>
   x.name==='mobility_stage_g205_accept_original_auto_qa'||
   x.name==='mobility_stage_g16_driver_private_inbox_qa').length,0);
  assert.equal(m.state.trip.status,'searching');
 });
});
test('G184 unified HTTP denies legacy trip/cancel paths on exact G73 booking without changing SQL',async()=>{
 const m=mockSupabase();m.state.g84Enabled=true;
 const runtime=await prepare(m,{driverKycTrust:g80Trust().trust});
 await http(runtime,async base=>{
  const booked=await req(base,'/v1/staging/rider/auto/book','rider','POST',{
   requestKey,quoteId:fareQuote,accepted:true
  });
  assert.equal(booked.status,201,JSON.stringify(booked.body));
  assert.equal(booked.body.tripId,ride);
  const state=m.state.trip.status;
  const calls=m.state.rpcs.length;
  const badPaths=[
   [requestPath,{requestKey,originTag:'PANTEON',destinationTag:'SHOPPING',service:'economico'}],
   ['/v1/staging/rider/trips/'+ride+'/cancel',{requestKey}],
   [transitionPath,{event:'cancel',eventKey:requestKey}]
  ];
  for(const [path,body] of badPaths){
   const denied=await req(base,path,'rider','POST',body);
   assert.equal(denied.status,409,JSON.stringify(denied.body));
   assert.equal(denied.body.code,'G184_USE_ORIGINAL_G73_G95_AUTO_BOOKING');
   assert.equal(denied.body.retryLegacyRequest,false);
   assert.equal(denied.body.financialReconciliationRequired,true);
   assert.equal(m.state.rpcs.length,calls,'legacy path cannot execute any SQL RPC');
   assert.equal(m.state.trip.status,state);
   assert(!JSON.stringify(denied).includes(fareQuote));
  }
  const stillBooked=await req(base,'/v1/staging/rider/auto/bookings/'+requestKey,'rider');
  assert.equal(stillBooked.status,200);
  assert.equal(stillBooked.body.tripId,ride);
  assert.equal(stillBooked.body.serverPersisted,true);
  assert.equal(m.state.trip.status,'searching');
 });
});
test('G177 unpriced AUTO and unverifiable Driver sessions cannot advance assigned trip',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  const created=await req(base,requestPath,'rider','POST',{
   requestKey,originTag:'PANTEON',destinationTag:'SHOPPING',service:'economico'
  });
  assert.equal(created.status,409);
  assert.equal(created.body.code,'G184_USE_ORIGINAL_G73_G95_AUTO_BOOKING');
  assert.equal(created.body.retryLegacyRequest,false);
  assert.equal(m.state.rpcs.some(x=>x.name==='mobility_stage_auto_demo_request'),false);
  const legacyDriver=await req(base,requestPath,'driver','POST',{
   requestKey,originTag:'PANTEON',destinationTag:'SHOPPING',service:'economico'
  });
  assert.equal(legacyDriver.status,409);
  assert.equal(legacyDriver.body.code,'G184_USE_ORIGINAL_G73_G95_AUTO_BOOKING');
  assert.equal((await req(base,acceptPath,'driver','POST',
   {offerId:offer,requestKey})).status,401);
  const eventKey='88888888-8888-4888-8888-888888888888';
  const arriving=await req(base,transitionPath,'driver','POST',
   {event:'arrive',eventKey});
  assert.equal(arriving.status,401,'No independently revocable Driver IdP');
  assert.equal(m.state.trip.status,'searching');
  assert.equal(m.state.rpcs.some(x=>x.name==='mobility_stage_g205_accept_original_auto_qa'),false);
  assert.equal(m.state.rpcs.some(x=>x.name==='mobility_stage_auto_demo_transition'),false);
  const before=m.state.rpcs.length;
  assert.equal((await req(base,transitionPath,'rider','POST',
   {event:'pickup',eventKey})).status,401);
  assert.equal(m.state.rpcs.length,before);
 });
});
test('G210 original G73 AUTO accepted through G205 advances G177 same trip on HTTP, Client and Admin QA',async()=>{
 // In-memory RPC contracts check all four HTTP participants; never
 // label this as real G38 municipality/KYC/GPS or physical completion.
 const m=mockSupabase();m.state.g84Enabled=true;m.state.adminRole='admin';
 const driverTrust=g80Trust(),runtime=await prepare(m,{
  driverKycTrust:driverTrust.trust,adminF1Trust:trust()
 });
 const stages=[
  ['arrive','arriving',3,'assigned'],
  ['pickup','in_progress',4,'arriving'],
  ['complete','completed',5,'in_progress']
 ];
 const keys=[
  '21000000-0000-4210-8210-000000000001',
  '21000000-0000-4210-8210-000000000002',
  '21000000-0000-4210-8210-000000000003'
 ];
 await http(runtime,async base=>{
  const booked=await req(base,'/v1/staging/rider/auto/book','rider','POST',{
   requestKey,quoteId:fareQuote,accepted:true
  });
  assert.equal(booked.status,201,JSON.stringify(booked.body));
  assert.equal(booked.body.tripId,ride);
  const accepted=await req(base,acceptPath,'driver','POST',{offerId:offer,requestKey});
  assert.equal(accepted.status,200,JSON.stringify(accepted.body));
  assert.equal(m.state.trip.status,'accepted');
  assert.equal(m.state.trip.revision,2);
  assert.equal((await req(base,'/v1/staging/driver/trips/current','driver'))
   .body.activeTrip.tripId,ride);
  const sqlAfterAccept=m.state.rpcs.filter(r=>r.name==='mobility_stage_g205_accept_original_auto_qa');
  assert.equal(sqlAfterAccept.length,1);
  const beforeInvalid=m.state.rpcs.length;
  const invalid=await req(base,transitionPath,'driver','POST',{
   event:'skip',eventKey:keys[0]
  });
  assert.equal(invalid.status,400,'invalid Driver transition cannot reach legacy SQL');
  assert.equal(invalid.body.code,'G177_DRIVER_STEP_INVALID');
  assert.equal(m.state.rpcs.length,beforeInvalid);
  for(const [i,[event,status,revision]] of stages.entries()){
   const command={event,eventKey:keys[i]};
   const foreign=await req(base,transitionPath,'rider','POST',command);
   assert.equal(foreign.status,401);
   const response=await req(base,transitionPath,'driver','POST',command);
   assert.equal(response.status,200,JSON.stringify(response.body));
   assert.equal(response.body.tripId,ride);
   assert.equal(response.body.event,event);
   assert.equal(response.body.eventId,keys[i]);
   assert.equal(response.body.serverPersisted,true);
   assert.equal(m.state.trip.status,status);
   assert.equal(m.state.trip.revision,revision);
   const d=await req(base,'/v1/staging/driver/trips/'+ride+'/status','driver');
   assert.equal(d.status,200,JSON.stringify(d.body));
   assert.equal(d.body.tripId,ride);
   assert.equal(d.body.revision,revision);
   assert.equal(d.body.state,status);
   const b=await req(base,statusPath,'rider');
   assert.equal(b.status,200,JSON.stringify(b.body));
   assert.equal(b.body.tripId,ride);
   assert.equal(b.body.revision,revision);
   const replay=await req(base,transitionPath,'driver','POST',command);
   assert.equal(replay.status,200,'same transition key remains idempotent');
   assert.equal(replay.body.eventId,keys[i]);
   assert.equal(m.state.trip.revision,revision,'replay cannot duplicate lifecycle');
  }
  assert.equal((await req(base,'/v1/staging/driver/trips/current','driver'))
   .body.activeTrip,null,'completed trip cannot be resumed as active');
  assert.equal(m.state.g210Events.size,3);
  m.state.adminReceipt={...adminF1Receipt(),revision:5,
   status:'completed',assignmentPersisted:true,driverId:null};
  m.state.autoTraceReceipt={...g144BaseTrace('AUTO_RIDE'),
   status:'completed',revision:5,
   assignment:{state:'QA_COMPLETED',legalGate:'EXTERNAL_NOT_CERTIFIED'},
   events:[
    {eventId:ride,serviceId:ride,sequence:1,status:'searching',at:now-5000},
    {eventId:requestKey,serviceId:ride,sequence:2,status:'assigned',at:now-4000},
    ...keys.map((eventId,i)=>({eventId,serviceId:ride,
     sequence:i+3,status:['arriving','in_progress','completed'][i],
     at:now-3000+i*1000}))
   ],
   ledger:null};
  const adminView=await req(base,g144AutoPath,'stranger');
  assert.equal(adminView.status,200,JSON.stringify(adminView.body));
  assert.equal(adminView.body.serviceId,ride);
  assert.equal(adminView.body.bookingRequestKey,requestKey);
  assert.equal(adminView.body.revision,5);
  assert.equal(adminView.body.status,'completed');
  assert.equal(adminView.body.productionEnabled,false);
  // Execute the actual D Admin HTTPS contract against A's same-trip
  // loopback HTTP transport, not a separate fabricated Admin application.
  const {createServiceTraceGateway}=await import(
   '../../movete-admin/src/service-trace-gateway.mjs');
  const dOrigin='https://g211-local-admin-transport.invalid';
  const dClient=createServiceTraceGateway({
   enabled:true,contractCertified:true,origin:dOrigin,pinnedOrigin:dOrigin,
   now:()=>now,
   getSession:async()=>({role:'admin',subject:stranger,mfaVerified:true,
    authRevision:1,expiresAt:now+60000,token:jwt.stranger}),
   fetchImpl:(url,options)=>{
    const u=new URL(url);
    assert.equal(u.origin,dOrigin);
    return fetch(base+u.pathname,{...options,redirect:'error'});
   }
  });
  const dReceipt=await dClient.read('AUTO_RIDE',ride);
  assert.equal(dReceipt.ok,true,JSON.stringify(dReceipt));
  assert.equal(dReceipt.data.serviceId,ride);
  assert.equal(dReceipt.data.bookingRequestKey,requestKey);
  assert.equal(dReceipt.data.status,'completed');
  assert.equal(dReceipt.data.revision,5);
  assert.equal(dReceipt.data.assignment.state,'QA_COMPLETED');
  assert.equal(dReceipt.data.assignment.legalGate,'EXTERNAL_NOT_CERTIFIED');
  assert.equal(dReceipt.data.productionEnabled,false);
  assert.equal(m.state.rpcs.filter(r=>r.name==='mobility_stage_g205_accept_original_auto_qa').length,1);
  assert.equal(m.state.rpcs.filter(r=>r.name==='mobility_stage_g177_driver_auto_step_qa').length,6);
 });
});

test('G176 denies legacy courier pickup/deliver/return and retains original sender read',async()=>{
 const m=mockSupabase(),runtime=await prepare(m,{driverKycTrust:g80Trust().trust});
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
  })).status,409);
  assert.equal((await req(base,deliveryTransitionPath,'driver','POST',{
   event:'deliver',eventKey:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   proofRef:deliveryProof,
  })).status,409);
  assert.equal((await req(base,deliveryTransitionPath,'driver','POST',{
   event:'return',eventKey:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  })).status,409);
  const status=await req(base,deliveryStatusPath,'rider');
  assert.equal(status.status,200);
  assert.equal(status.body.delivery.status,'accepted');
  assert.equal(status.body.delivery.proofRef,null);
  assert.equal((await req(base,deliveryStatusPath,'stranger')).status,403);
  assert.doesNotMatch(JSON.stringify(status),/sb_secret|service_role/);
 });
});
test('G183 original G15 courier polling is unavailable without revocable Driver IdP',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  const before=m.state.rpcs.length;
  const response=await req(base,'/v1/staging/courier/delivery-offers','driver');
  assert.equal(response.status,401);
  assert(!JSON.stringify(response).includes(offer));
  assert.equal(m.state.rpcs.length,before);
 });
});
test('G182 unprovisioned courier IdP denies delivery preview and acceptance before SQL',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  m.state.deliveryOffer={id:offer,delivery_id:deliveryId,courier_id:driver,
   vehicle_id:vehicle,status:'offered',expires_at:new Date(now+30000).toISOString()};
  assert.equal((await req(base,deliveryOfferPath,'driver')).status,401);
  assert.equal((await req(base,deliveryOfferAcceptPath,'driver','POST',
   {offerId:offer,requestKey})).status,401);
  assert.equal(m.state.rpcs.some(x=>
   x.name==='mobility_stage_delivery_accept_offer'),false);
 });
});
test('runtime keeps G10 delivery offer private and accepts through atomic offer RPC',async()=>{
 const m=mockSupabase(),runtime=await prepare(m,{driverKycTrust:g80Trust().trust});
 await http(runtime,async base=>{
  assert.equal((await req(base,deliveryRequestPath,'rider','POST',{
   requestKey,vehicleKind:'AUTO',category:'PARCEL',grams:1000,
   lengthCm:20,widthCm:15,heightCm:10,pickupTag:'SHOP_A',
   deliveryTag:'CLIENT_A',restrictedItemDeclared:false,
  })).status,201);
  m.state.deliveryOffer={id:offer,delivery_id:deliveryId,courier_id:driver,
   vehicle_id:vehicle,status:'offered',expires_at:new Date(now+30_000).toISOString()};
  assert.equal((await req(base,deliveryOfferPath,'stranger')).status,401);
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
 const m=mockSupabase(),runtime=await prepare(m,{driverKycTrust:g80Trust().trust});
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
 const runtime=await prepare(m,{driverKycTrust:g80Trust().trust});
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
const g141At=1790000000000;
const g141Evidence='14100000-0000-4141-8141-000000000001';
const g141Toll='14100000-0000-4141-8141-000000000002';
const g141Reservation='14100000-0000-4141-8141-000000000003';
function g141GeoapifyOptions({coverage=true,tolls=true}={}){
 const calls={covered:0,provider:0,quota:0,verifiedToll:0};
 const options={
  enabled:true,freePlanApproved:true,
  apiKey:'QA_GEOAPIFY_FREE_SERVER_KEY_NEVER_ACTUAL_0123456789',
  tagSecret:'QA_G141_ADDRESS_HMAC_SECRET_NEVER_REAL_0123456789',
  resolveCoveredAutoCoordinates:async p=>{
   calls.covered++;
   return {source:'INDEPENDENT_COVERAGE_AUTHORITY',
    coverageVerified:coverage,evidenceId:g141Evidence,revision:1,
    verifiedAtMs:g141At-500,actorId:p.actorId,
    quoteRequestKey:p.quoteRequestKey,originAddress:p.origin,
    destinationAddress:p.destination,service:p.service,
    zoneTag:'AUTO_ASUNCION',
    originCoordinates:{lat:-25.2773434,lon:-57.6371671},
    destinationCoordinates:{lat:-25.2828767,lon:-57.5674503}};
  },
  verifyAutoTolls:async p=>{
   calls.verifiedToll++;
   return {source:'INDEPENDENT_TOLL_AUTHORITY',tollsVerified:tolls,
    actorId:p.actorId,quoteRequestKey:p.quoteRequestKey,
    evidenceId:g141Toll,distanceMeters:p.distanceMeters,
    durationSeconds:p.durationSeconds,tollsPyg:0,
    verifiedAtMs:g141At};
  },
  reserveFreeQuota:async p=>{
   calls.quota++;
   assert.equal(p.provider,'GEOAPIFY_FREE');
   assert.equal(p.serviceKind,'AUTO_RIDE');
   assert.equal(p.quoteRequestKey,requestKey);
   return {approved:true,durable:true,reservationId:g141Reservation,
    deliveryId:requestKey,vehicleKind:'AUTO',
    coverageEvidenceId:g141Evidence};
  },
  request:async(url,opts)=>{
   calls.provider++;
   const parsed=new URL(url);
   assert.equal(parsed.origin,'https://api.geoapify.com');
   assert.equal(parsed.pathname,'/v1/routing');
   assert.equal(parsed.searchParams.get('mode'),'drive');
   assert.equal(parsed.searchParams.get('traffic'),'approximated');
   assert.equal(opts.method,'GET');
   return {ok:true,status:200,redirected:false,
    headers:{get:k=>k==='content-type'?'application/json':null},
    text:async()=>JSON.stringify({results:[{
     distance:8253,time:808.305,distance_units:'meters',toll:false
    }]})};
  }
 };
 return {options,calls};
}
test('G141 server-only Geoapify Free AUTO is mounted through real G73 HTTP and SQL',async()=>{
 const m=mockSupabase(),route=g141GeoapifyOptions();
 m.state.routeClock=g141At;
 const runtime=await prepare(m,{now:()=>g141At,g134GeoapifyAutoOptions:route.options});
 await http(runtime,async base=>{
  const result=await req(base,g79Path,'rider','POST',{
   quoteRequestKey:requestKey,origin:g79Origin,
   destination:g79Destination,service:'economico'
  });
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.body.routingVerified,true);
  assert.equal(result.body.coverageVerified,true);
  assert.deepEqual(route.calls,{covered:1,provider:1,quota:1,verifiedToll:1});
  assert.equal(m.state.g77RegisteredRoute._distance_meters,8253);
  assert.equal(m.state.g77RegisteredRoute._duration_seconds,809);
  assert.equal(m.state.g77RegisteredRoute._tolls_pyg,0);
  assert.match(m.state.g77RegisteredRoute._origin_tag,/^LOC_[A-P]{32}$/);
  assert(!JSON.stringify(m.state.g77RegisteredRoute).includes(g79Origin));
  assert(!JSON.stringify(result.body).includes(route.options.apiKey));
 });
});
test('G141 no external road lookup when coverage is unverified',async()=>{
 const m=mockSupabase(),route=g141GeoapifyOptions({coverage:false});
 m.state.routeClock=g141At;
 const runtime=await prepare(m,{now:()=>g141At,g134GeoapifyAutoOptions:route.options});
 await http(runtime,async base=>{
  const result=await req(base,g79Path,'rider','POST',{
   quoteRequestKey:requestKey,origin:g79Origin,
   destination:g79Destination,service:'economico'
  });
  assert.equal(result.status,409);
  assert.deepEqual(route.calls,{covered:1,provider:0,quota:0,verifiedToll:0});
  assert.equal(m.state.g77RegisteredRoute,null);
 });
});
test('G141 refuses Google + Geoapify together, user route override or incomplete proof authorities',async()=>{
 const f=g141GeoapifyOptions(),g=g79Options();
 for(const bad of [
  {g134GeoapifyAutoOptions:f.options,g77RouteOptions:g.options},
  {g134GeoapifyAutoOptions:f.options,verifiedAutoRoute:async()=>({})},
  {g134GeoapifyAutoOptions:{...f.options,enabled:false}},
  {g134GeoapifyAutoOptions:{...f.options,freePlanApproved:false}},
  {g134GeoapifyAutoOptions:{...f.options,resolveCoveredAutoCoordinates:null}},
  {g134GeoapifyAutoOptions:{...f.options,tagSecret:'short'}},
  {g134GeoapifyAutoOptions:{...f.options,secretLeak:'bad'}}
 ]){
  const m=mockSupabase();
  await assert.rejects(prepare(m,bad));
  assert.equal(m.state.clients.length,0);
  assert.equal(m.state.rpcs.length,0);
 }
});

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

const g64AutoPath='/v1/staging/driver/offers/reconcile';
const g64DeliveryPath='/v1/staging/courier/delivery-offers/reconcile';
const g64OfferEvent='64642000-0000-4642-8642-000000000004';
const g64Key='64642000-0000-4642-8642-000000000005';
const g64Payload={offerId:offer,requestKey:g64Key,action:'accept'};
const g64Accepted=(kind='AUTO_RIDE')=>({
 state:'COMMITTED',offerId:offer,requestKey:g64Key,kind,
 action:'accept',outcome:'accepted',receiptId:g64OfferEvent,
 serverPersisted:true,liveEnabled:false,pushDelivered:false,
 qaOnly:true,productionEnabled:false,retrySafe:false,reconcileAgain:false
});
test('G64 recovery is unavailable by default and never sends another acceptance',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,g64AutoPath,'driver','POST',g64Payload)).status,503);
  assert.equal((await req(base,g64DeliveryPath,'driver','POST',g64Payload)).status,503);
  assert.equal((await req(base,g64AutoPath,'driver','GET')).status,404);
 });
 assert.equal(m.state.rpcs.length,0);
});
test('G64 actual Driver HTTP reconciliation reads verified original acceptance, never writes',async()=>{
 const m=mockSupabase(),f=g80Trust();
 const ownerReads=[];
 const runtime=await prepare(m,{
  driverKycTrust:f.trust,
  readDriverDecisionOwnerQa:async scope=>{
   ownerReads.push(scope);
   if(scope.kind!=='AUTO_RIDE'||scope.offerId!==offer||
      scope.actorId!==driver||scope.requestKey!==g64Key||
      scope.action!=='accept')throw Error('Unknown private owner receipt');
   return g64Accepted();
  }
 });
 await http(runtime,async base=>{
  const originalRpcCount=m.state.rpcs.length;
  const response=await reconcilePrivateDriverOffer({
   apiOrigin:base,accessToken:jwt.driver,
   kind:'AUTO_RIDE',offerId:offer,requestKey:g64Key,action:'accept',request:fetch
  });
  assert.equal(response.outcome,'accepted');
  assert.equal(response.receiptId,g64OfferEvent);
  assert.equal(response.serverPersisted,true);
  assert.equal(response.liveEnabled,false);
  assert.equal(m.state.rpcs.length,originalRpcCount,
   'read-only reconciliation never calls acceptance or any service-role RPC');
  assert.equal(ownerReads.length,1);
  assert.equal(ownerReads[0].actorId,driver);
  assert.equal(ownerReads[0].sessionId,vehicle);
  const payload=JSON.stringify(await req(base,g64AutoPath,'driver','POST',g64Payload));
  assert.doesNotMatch(payload,new RegExp(driver+'|'+passenger+'|sb_secret'));
  assert.equal((await req(base,g64AutoPath,'rider','POST',g64Payload)).status,401);
  assert.equal((await req(base,g64AutoPath,'stranger','POST',g64Payload)).status,401);
  assert.equal((await req(base,g64AutoPath,'driver','POST',{
   ...g64Payload,requestKey:requestKey})).status,503);
 });
});
test('G64 unobserved SQL outcome, session revocation and dual role never allow retry',async()=>{
 const m=mockSupabase(),f=g80Trust();
 let valid=true,reads=0;
 const trust={...f.trust,verifySessionNotRevoked:async()=>valid};
 const runtime=await prepare(m,{
  driverKycTrust:trust,
  readDriverDecisionOwnerQa:async()=>{
   reads++;
   return {state:'NOT_YET_OBSERVED',qaOnly:true,
    productionEnabled:false,retrySafe:false,reconcileAgain:true};
  }
 });
 await http(runtime,async base=>{
  const pending=await req(base,g64AutoPath,'driver','POST',g64Payload);
  assert.equal(pending.status,503);
  assert.equal(pending.body.retrySafe,false);
  assert.equal(reads,1);
  valid=false;
  assert.equal((await req(base,g64AutoPath,'driver','POST',g64Payload)).status,401);
  assert.equal(reads,1);
  valid=true;m.state.dualRoleDriver=true;
  assert.equal((await req(base,g64AutoPath,'driver','POST',g64Payload)).status,403);
  assert.equal(reads,1);
 });
});
test('G64 owner-only reader requires independently verified driver session',async()=>{
 for(const reader of [async()=>g64Accepted(),false,{}]){
  const m=mockSupabase();
  await assert.rejects(()=>prepare(m,{readDriverDecisionOwnerQa:reader}));
  assert.equal(m.state.clients.length,0);
 }
});

test('G160 new G73 AUTO booking produces same-trip G112 private Driver offer once',async()=>{
 const m=mockSupabase();m.state.g84Enabled=true;
 const runtime=await prepare(m,{driverKycTrust:g80Trust().trust});
 await http(runtime,async base=>{
  const request={requestKey,quoteId:fareQuote,accepted:true};
  const inboxBefore=await req(base,'/v1/staging/driver/inbox','driver');
  assert.equal(inboxBefore.status,200);
  assert.deepEqual(inboxBefore.body.offers,[]);
  const first=await req(base,'/v1/staging/rider/auto/book','rider','POST',request);
  assert.equal(first.status,201);
  assert.equal(first.body.tripId,ride);
  assert.equal(first.body.status,'ACCEPTED_QA');
  assert.equal(first.body.serverPersisted,true);
  const inbox=await req(base,'/v1/staging/driver/inbox','driver');
  assert.equal(inbox.status,200);
  assert.deepEqual(inbox.body.offers,[{kind:'AUTO_RIDE',offerId:offer,
   serviceId:first.body.tripId,expiresAtMs:now+20000}]);
  assert.equal(inbox.body.pushDelivered,false);
  assert.equal(inbox.body.deviceReceived,false);
  assert.equal((await req(base,'/v1/staging/driver/inbox','stranger')).status,401);
  const offerDetail=await req(base,offerPath,'driver');
  assert.equal(offerDetail.status,200);
  assert.equal(offerDetail.body.tripId,first.body.tripId);
  assert.equal(offerDetail.body.offerId,offer);
  assert.equal(offerDetail.body.confirmedAcceptance,false);
  const calls=m.state.rpcs.filter(x=>x.name==='mobility_stage_g112_run_booked_auto_dispatch_qa');
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].params,{_passenger_id:passenger,
   _booking_key:requestKey,_trip_id:first.body.tripId});
  const privateStatus=await req(base,
   '/v1/staging/rider/auto/bookings/'+requestKey+'/dispatch','rider');
  assert.equal(privateStatus.status,200);
  assert.equal(privateStatus.body.tripId,first.body.tripId);
  assert.equal(privateStatus.body.dispatchState,'OFFER_PENDING');
  assert.equal(privateStatus.body.offerPendingAcceptance,true);
  assert(!JSON.stringify(privateStatus.body).includes(offer));
  const second=await req(base,'/v1/staging/rider/auto/book','rider','POST',request);
  assert.equal(second.status,201);
  assert.equal(second.body.tripId,ride);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g112_run_booked_auto_dispatch_qa').length,1,
   'replayed ACK must not mint a second offer');
  const get=await req(base,'/v1/staging/rider/auto/bookings/'+requestKey);
  assert.equal(get.status,200);
  assert.equal(get.body.tripId,ride);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g112_run_booked_auto_dispatch_qa').length,1,
   'read-only recovery must not create another offer');
  assert.equal(m.state.rpcs.some(x=>x.name==='mobility_stage_auto_demo_request'),false,
   'old unpriced booking RPC forbidden');
 });
});
test('G160 G112 worker shortage or SQL denial cannot invalidate confirmed G73 booking',async()=>{
 for(const result of [{data:null,error:null},{data:null,error:{code:'P8201'}}]){
  const m=mockSupabase();m.state.g84Enabled=true;
  const original=m.createClient;
  m.createClient=(url,key)=>{
   const client=original(url,key);
   if(key===serviceKey){
    const call=client.rpc;
    client.rpc=async(n,p)=>n==='mobility_stage_g112_run_booked_auto_dispatch_qa'?
     result:call(n,p);
   }
   return client;
  };
  const runtime=await prepare(m);
  await http(runtime,async base=>{
   const rec=await req(base,'/v1/staging/rider/auto/book','rider','POST',
    {requestKey,quoteId:fareQuote,accepted:true});
   assert.equal(rec.status,201);
   assert.equal(rec.body.tripId,ride);
   assert.equal(rec.body.serverPersisted,true);
  });
 }
});

test('G89 authenticated Client distinguishes confirmed missing trip from database outage',async()=>{
 const m=mockSupabase();
 const runtime=await prepare(m);
 await http(runtime,async base=>{
  const real=await req(base,statusPath,'rider');
  assert.equal(real.status,200);
  m.state.trip.id=offer; // Separate, synthetic persisted trip, not rider's requested ID.
  const missing=await req(base,statusPath,'rider');
  assert.equal(missing.status,404);
  assert.equal(missing.body.error,'Trip not found');
  m.state.g89TripReadError=true;
  const offline=await req(base,statusPath,'rider');
  assert.equal(offline.status,503);
  assert.equal(offline.body.error,'Trip status temporarily unavailable');
  assert.equal((await req(base,statusPath,'stranger')).status,403);
  assert.doesNotMatch(JSON.stringify(offline),/Connection lost|offline|08006|password|JWT/);
 });
});

test('G90 private HTTP route allows only authenticated Passenger booking owner',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  const path='/v1/staging/rider/auto/bookings/'+requestKey+'/dispatch';
  const a=await req(base,path,'rider');
  assert.equal(a.status,200);
  assert.equal(a.body.tripId,ride);
  assert.equal(a.body.dispatchState,'RETRY_PENDING');
  assert.equal(a.body.offerPendingAcceptance,false);
  assert.doesNotMatch(JSON.stringify(a),/driverId|vehicleId|offerId|latitude|longitude/);
  assert.equal((await req(base,path,'stranger')).status,403);
  assert.equal((await req(base,path,'driver')).status,403);
  assert.deepEqual(m.state.rpcs.filter(x=>x.name==='mobility_stage_g90_passenger_dispatch_status_qa')
   .map(x=>x.params),[{_passenger_id:passenger,_booking_key:requestKey}]);
 });
});

const g144AutoPath='/v1/staging/admin/services/AUTO_RIDE/'+ride+'/trace';
const g144MotoPath='/v1/staging/admin/services/MOTO_RIDE/'+ride+'/trace';
const g144BaseTrace=(kind)=>({
 mode:'STAGING_DEMO_ONLY',viewerId:stranger,serviceId:ride,
 serviceKind:kind,bookingRequestKey:requestKey,quoteId:fareQuote,
 status:'searching',revision:1,observedAt:now-1000,expiresAt:now+29000,
 serverPersisted:true,productionEnabled:false,
 assignment:{state:'NOT_ASSIGNABLE',legalGate:'G38_BLOCKED'},
 events:[{eventId:ride,serviceId:ride,sequence:1,
  status:'searching',at:now-2000}],
 ledger:null
});
test('G144 both source-backed Admin traces require configured IdP AAL2',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,g144AutoPath,'stranger')).status,503);
  assert.equal((await req(base,g144MotoPath,'stranger')).status,503);
  assert(!m.state.rpcs.some(x=>/g138|g142/.test(x.name)));
 });
});
test('G144 real runtime routes BOTH verified AUTO and MOTO SQL original IDs',async()=>{
 const m=mockSupabase();m.state.adminRole='admin';
 m.state.adminReceipt=adminF1Receipt();
 m.state.autoTraceReceipt=g144BaseTrace('AUTO_RIDE');
 m.state.motoTraceReceipt={...g144BaseTrace('MOTO_RIDE'),
  ledger:{serviceId:ride,currency:'PYG',grossGs:13000,
   platformCommissionGs:1500,customerSubsidyGs:1300,
   driverPayoutGs:11500,reconciliationStatus:'PENDING'}};
 const runtime=await prepare(m,{adminF1Trust:trust()});
 await http(runtime,async base=>{
  for(const [path,kind,rpc] of [
   [g144AutoPath,'AUTO_RIDE','mobility_stage_g138_auto_trace_qa'],
   [g144MotoPath,'MOTO_RIDE','mobility_stage_g142_moto_trace_qa']
  ]){
   const forbidden=await req(base,path,'rider');
   assert.equal(forbidden.status,401);
   const actual=await req(base,path,'stranger');
   assert.equal(actual.status,200);
   assert.equal(actual.body.serviceKind,kind);
   assert.equal(actual.body.serviceId,ride);
   assert.equal(actual.body.productionEnabled,false);
   assert(m.state.rpcs.some(x=>x.name===rpc&&x.params._admin===stranger
    &&x.params._trip===ride),'read original scoped SQL record');
  }
  assert(m.state.rpcs.filter(x=>x.name==='mobility_stage_g75_admin_f1_receipt').length>=1,
   'G138 must verify original G75 evidence before reading its trace');
 });
});
test('G144 revoked/MFA denied and missing SQL evidence fail closed in both Admin routes',async()=>{
 for(const [override,status] of [
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifyBackofficeMfa:async()=>({verifiedByProvider:false})},403],
  [{},503]
 ]){
  const m=mockSupabase();m.state.adminRole='admin';
  m.state.adminReceipt=adminF1Receipt();
  const runtime=await prepare(m,{adminF1Trust:trust(override)});
  await http(runtime,async base=>{
   assert.equal((await req(base,g144AutoPath,'stranger')).status,status);
   assert.equal((await req(base,g144MotoPath,'stranger')).status,
    status===503?404:status);
   if(status!==503)assert(!m.state.rpcs.some(x=>/g138|g142/.test(x.name)));
  });
 }
});

const g145Auto='/v1/staging/admin/services/DELIVERY_AUTO/'+deliveryId+'/trace';
const g145Moto='/v1/staging/admin/services/DELIVERY_MOTO/'+deliveryId+'/trace';
function g145Snapshot(kind){
 return {mode:'STAGING_DEMO_ONLY',viewerId:stranger,
  serviceId:deliveryId,serviceKind:kind,
  quoteId:fareQuote,bookingRequestKey:requestKey,
  status:'requested',revision:1,observedAt:now-1000,expiresAt:now+29000,
  serverPersisted:true,productionEnabled:false,
  assignment:{state:'NOT_ASSIGNABLE',legalGate:'G38_BLOCKED'},
  events:[{eventId:deliveryId,serviceId:deliveryId,sequence:1,
   status:'requested',at:now-2000}],ledger:null};
}
test('G145 cargo original SQL trace is securely mounted for AUTO and MOTO',async()=>{
 for(const [path,kind] of [[g145Auto,'DELIVERY_AUTO'],[g145Moto,'DELIVERY_MOTO']]){
  const m=mockSupabase();m.state.adminRole='admin';
  m.state.cargoTraceReceipt=g145Snapshot(kind);
  const runtime=await prepare(m,{adminF1Trust:trust()});
  await http(runtime,async base=>{
   assert.equal((await req(base,path,'rider')).status,401);
   const r=await req(base,path,'stranger');
   assert.equal(r.status,200);
   assert.equal(r.body.serviceKind,kind);
   assert.equal(r.body.ledger,null);
   assert.equal(r.body.assignment.state,'NOT_ASSIGNABLE');
   assert(m.state.rpcs.some(x=>x.name==='mobility_stage_g145_delivery_trace_qa'
    &&x.params._admin===stranger&&x.params._delivery===deliveryId));
  });
 }
});
test('G219 independent Admin follows accepted and picked-up original cargo without a false delivery',async()=>{
 for(const [path,kind] of [[g145Auto,'DELIVERY_AUTO'],[g145Moto,'DELIVERY_MOTO']]){
  for(const state of ['accepted','picked_up']){
   const m=mockSupabase();m.state.adminRole='admin';
   m.state.cargoTraceReceipt=null;
   const dto=g145Snapshot(kind);
   dto.status=state;dto.revision=state==='accepted'?2:3;
   dto.assignment={state:'QA_ACCEPTED',legalGate:'EXTERNAL_NOT_CERTIFIED'};
   dto.events=[
    {eventId:deliveryId,serviceId:deliveryId,sequence:1,
     status:'requested',at:now-5000},
    ...['accepted','picked_up'].slice(0,dto.revision-1).map((status,i)=>({
     eventId:[offer,vehicle][i],serviceId:deliveryId,
     sequence:i+2,status,at:now-4000+i*1000
    }))
   ];
   m.state.activeCargoTraceReceipt=dto;
   await http(await prepare(m,{adminF1Trust:trust()}),async base=>{
    const result=await req(base,path,'stranger');
    assert.equal(result.status,200,kind+' '+state+' '+JSON.stringify(result.body));
    assert.equal(result.body.status,state);
    assert.equal(result.body.assignment.state,'QA_ACCEPTED');
    assert.equal(result.body.events.length,dto.revision);
    assert.equal(result.body.ledger,null);
    assert(m.state.rpcs.some(x=>x.name==='mobility_stage_g219_active_delivery_trace_qa'
     &&x.params._delivery===deliveryId));
    assert(!m.state.rpcs.some(x=>x.name==='mobility_stage_g216_completed_delivery_trace_qa'));
   });
  }
 }
});

test('G216 original delivered cargo is visible via authenticated Admin HTTP only after completed SQL read',async()=>{
 for(const [path,kind] of [[g145Auto,'DELIVERY_AUTO'],[g145Moto,'DELIVERY_MOTO']]){
  const m=mockSupabase();m.state.adminRole='admin';
  m.state.cargoTraceReceipt=null;
  const complete=g145Snapshot(kind);
  complete.status='delivered';complete.revision=4;
  complete.assignment={state:'QA_COMPLETED',legalGate:'EXTERNAL_NOT_CERTIFIED'};
  complete.events=[
   {eventId:deliveryId,serviceId:deliveryId,sequence:1,
    status:'requested',at:now-5000},
   ...['accepted','picked_up','delivered'].map((status,index)=>({
    eventId:[offer,vehicle,payment][index],serviceId:deliveryId,
    sequence:index+2,status,at:now-4000+index*1000
   }))
  ];
  m.state.completedCargoTraceReceipt=complete;
  const runtime=await prepare(m,{adminF1Trust:trust()});
  await http(runtime,async base=>{
   const ok=await req(base,path,'stranger');
   assert.equal(ok.status,200,JSON.stringify(ok.body));
   assert.equal(ok.body.serviceKind,kind);
   assert.equal(ok.body.status,'delivered');
   assert.equal(ok.body.revision,4);
   assert.equal(ok.body.assignment.state,'QA_COMPLETED');
   assert.equal(ok.body.ledger,null);
   assert.equal(ok.body.events[3].status,'delivered');
   assert.equal(ok.body.productionEnabled,false);
   assert(m.state.rpcs.some(x=>x.name==='mobility_stage_g216_completed_delivery_trace_qa'
    &&x.params._admin===stranger&&x.params._delivery===deliveryId));
   assert.equal((await req(base,path.replace(kind,
    kind==='DELIVERY_AUTO'?'DELIVERY_MOTO':'DELIVERY_AUTO'),'stranger')).status,503);
  });
 }
});

test('G145 cargo trace rejects unconfigured, unpriced, revoked, forged and cross-kind',async()=>{
 const unconfigured=mockSupabase();
 await http(await prepare(unconfigured),async base=>{
  assert.equal((await req(base,g145Moto,'stranger')).status,503);
 });
 for(const [kind,other] of [['DELIVERY_MOTO',g145Auto],['DELIVERY_AUTO',g145Moto]]){
  const m=mockSupabase();m.state.adminRole='admin';
  m.state.cargoTraceReceipt=g145Snapshot(kind);
  const runtime=await prepare(m,{adminF1Trust:trust()});
  await http(runtime,async base=>{
   assert.equal((await req(base,other,'stranger')).status,503);
  });
 }
 for(const [override,status] of [
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifyBackofficeMfa:async()=>({verifiedByProvider:false})},403],
  [{},404]
 ]){
  const m=mockSupabase();m.state.adminRole='admin';
  const runtime=await prepare(m,{adminF1Trust:trust(override)});
  await http(runtime,async base=>{
   assert.equal((await req(base,g145Moto,'stranger')).status,status);
   if(status!==404)assert(!m.state.rpcs.some(x=>x.name.includes('g145')));
  });
 }
});


test('G162 periodic AUTO dispatch is off by default and cannot start with unsafe flag',async()=>{
 const m=mockSupabase();
 const runtime=await prepare(m);
 assert.equal(runtime.qaAutoDispatchRetry,null);
 assert.equal(m.state.g113BatchCalls,0);
 const invalid=mockSupabase();
 await assert.rejects(()=>prepare(invalid,{autoDispatchRetryQa:'true'}));
 assert.equal(invalid.state.clients.length,0);
});

test('G162 opted-in G113 bounded retry uses PostgreSQL and stops on Auth gate failure',async()=>{
 const m=mockSupabase();
 const runtime=await prepare(m,{autoDispatchRetryQa:true});
 const worker=runtime.qaAutoDispatchRetry;
 assert.equal(worker.snapshot().running,false);
 assert.equal(worker.snapshot().maxJobs,5);
 assert.equal(worker.snapshot().intervalMs,30000);
 assert.equal(m.state.g113BatchCalls,0);
 assert.equal(worker.start(),true);
 for(let i=0;i<30&&worker.snapshot().busy;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(worker.snapshot().busy,false);
 assert.equal(m.state.g113BatchCalls,1);
 assert.equal((await worker.tick()).ok,true);
 assert.equal(m.state.g113BatchCalls,2);
 m.state.policy=false;
 const denied=await worker.tick();
 assert.equal(denied.ok,false);
 assert.equal(denied.reason,'SQL_UNAVAILABLE');
 assert.equal(m.state.g113BatchCalls,2,'reopened signup must block future due-job SQL');
 worker.stop();
 assert.equal(worker.snapshot().running,false);
 assert.equal((await worker.tick()).reason,'NOT_RUNNING');
});

test('G165 actual loopback QA lifecycle starts bounded due worker only on bind and stops on close',async()=>{
 const m=mockSupabase();
 const runtime=await prepare(m,{autoDispatchRetryQa:true});
 assert.equal(runtime.qaAutoDispatchRetry.snapshot().running,false);
 assert.equal(m.state.g113BatchCalls,0);
 const base=await runtime.listenQa();
 assert.match(base,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
 assert.equal(runtime.qaAutoDispatchRetry.snapshot().running,true);
 for(let i=0;i<40&&runtime.qaAutoDispatchRetry.snapshot().busy;i++)
  await new Promise(resolve=>setImmediate(resolve));
 assert.equal(m.state.g113BatchCalls,1,'server bind launches persisted due work');
 const status=await req(base,statusPath,'rider');
 assert.equal(status.status,200);
 await new Promise((resolve,reject)=>runtime.server.close(err=>err?reject(err):resolve()));
 assert.equal(runtime.qaAutoDispatchRetry.snapshot().running,false);
 const before=m.state.g113BatchCalls;
 assert.equal((await runtime.qaAutoDispatchRetry.tick()).reason,'NOT_RUNNING');
 assert.equal(m.state.g113BatchCalls,before);
});
test('G165 default loopback server never starts an auto retry process',async()=>{
 const m=mockSupabase();
 const runtime=await prepare(m);
 const base=await runtime.listenQa();
 assert.match(base,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
 assert.equal(runtime.qaAutoDispatchRetry,null);
 assert.equal(m.state.g113BatchCalls,0);
 await new Promise(resolve=>runtime.server.close(resolve));
});

const ratingPath='/v1/staging/reputation/ratings';
const ratingPayload={requestKey,serviceKind:'AUTO_RIDE',serviceId:ride,
 ratedKind:'CLIENT',stars:4,incidentCode:null};
function independentRatingTrust(){
 return {
  verifyRatingSession:async token=>{
   if(token!==jwt.driver)throw Error('No independent IdP');
   return {id:driver,sessionId:vehicle,tokenIatMs:now-1000,
    expiresAtMs:now+60000,is_anonymous:false};
  },
  verifySessionNotRevoked:async()=>true
 };
}
test('G155 original runtime refuses rating without verified IdP or G42 SQL',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,ratingPath,'driver','POST',ratingPayload)).status,503);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g155_submit_rating_qa').length,0);
 });
 for(const trust of [{}, {...independentRatingTrust(),clientCanApprove:true},
  {...independentRatingTrust(),verifySessionNotRevoked:null}]){
  const next=mockSupabase();
  await assert.rejects(prepare(next,{ratingTrust:trust}));
  assert.equal(next.state.clients.length,0);
 }
});
test('G155 G4 HTTP invokes original source SQL with verified Driver and immutable key',async()=>{
 const m=mockSupabase(),original=m.createClient;
 let valid=true,sqlDenied=false;
 m.createClient=(url,key)=>{
  const sdk=original(url,key);
  if(key===serviceKey){
   const old=sdk.rpc;
   sdk.rpc=async(name,params)=>{
    if(name!=='mobility_stage_g155_submit_rating_qa')return old(name,params);
    m.state.rpcs.push({name,params});
    if(sqlDenied)return {data:null,error:{code:'P1552'}};
    return {data:{
     ratingId:'15500000-0000-4155-8155-000000000004',
     serviceId:params._service_id,serviceKind:params._service_kind,
     ratedKind:params._rated_kind,stars:params._stars,
     requestKey:params._request_key,serverPersisted:true,qaOnly:true,
     productionEnabled:false,dispatchPriorityChanged:false,
     automatedSuspension:false},error:null};
   };
  }
  return sdk;
 };
 const runtime=await prepare(m,{ratingTrust:{
  ...independentRatingTrust(),
  verifySessionNotRevoked:async({userId,sessionId})=>
   valid&&userId===driver&&sessionId===vehicle
 }});
 await http(runtime,async base=>{
  assert.equal((await req(base,ratingPath,'rider','POST',ratingPayload)).status,401);
  let writes=m.state.rpcs.filter(x=>x.name==='mobility_stage_g155_submit_rating_qa');
  assert.equal(writes.length,0);
  const sent=await req(base,ratingPath,'driver','POST',ratingPayload);
  assert.equal(sent.status,201,JSON.stringify(sent.body));
  assert.equal(sent.body.serviceId,ride);
  assert.equal(sent.body.automatedSuspension,false);
  writes=m.state.rpcs.filter(x=>x.name==='mobility_stage_g155_submit_rating_qa');
  assert.equal(writes.length,1);
  assert.deepEqual(writes[0].params,{
   _reviewer:driver,_session:vehicle,_iat_ms:now-1000,
   _request_key:requestKey,_service_kind:'AUTO_RIDE',_service_id:ride,
   _rated_kind:'CLIENT',_stars:4,_incident_code:null
  });
  sqlDenied=true;
  assert.equal((await req(base,ratingPath,'driver','POST',ratingPayload)).status,409);
  valid=false;
  assert.equal((await req(base,ratingPath,'driver','POST',ratingPayload)).status,401);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g155_submit_rating_qa').length,2);
  assert.equal((await req(base,ratingPath,'driver','POST',{...ratingPayload,stars:6})).status,400);
  assert.doesNotMatch(JSON.stringify(sent.body),/service_role|sb_secret|sessionId/);
 });
});
test('G155 mismatched provider cannot claim successful rating in original runtime',async()=>{
 const m=mockSupabase();
 const trust={...independentRatingTrust(),
  verifyRatingSession:async()=>({id:passenger,sessionId:vehicle,
   tokenIatMs:now-1000,expiresAtMs:now+60000,is_anonymous:false})};
 const runtime=await prepare(m,{ratingTrust:trust});
 await http(runtime,async base=>{
  assert.equal((await req(base,ratingPath,'driver','POST',ratingPayload)).status,401);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g155_submit_rating_qa').length,0);
 });
});

const g156InboxPath='/v1/staging/merchant/'+vehicle+'/orders/inbox';
function merchantStaffTrust(){
 return {
  verifyMerchantSession:async token=>{
   if(token!==jwt.stranger)throw Error('Independent merchant session missing');
   return {id:stranger,sessionId:offer,tokenIatMs:now-1000,
    expiresAtMs:now+60000,is_anonymous:false};
  },
  verifySessionNotRevoked:async()=>true
 };
}
test('G156 main runtime never exposes merchant inbox without independent staff IdP',async()=>{
 const mock=mockSupabase(),runtime=await prepare(mock);
 await http(runtime,async base=>{
  assert.equal((await req(base,g156InboxPath,'stranger')).status,503);
  assert.equal(mock.state.rpcs.filter(x=>x.name==='mobility_stage_g156_merchant_inbox_qa').length,0);
 });
 for(const trust of [{}, {...merchantStaffTrust(),browserRole:true},
  {...merchantStaffTrust(),verifySessionNotRevoked:null}]){
  const m=mockSupabase();
  await assert.rejects(prepare(m,{merchantStaffTrust:trust}));
  assert.equal(m.state.clients.length,0);
 }
});
test('G156 native G4 HTTP returns only original merchant order scope from G42 SQL',async()=>{
 const m=mockSupabase(),old=m.createClient;
 let active=true,denied=false;
 m.createClient=(url,key)=>{
  const sdk=old(url,key);
  if(key===serviceKey){
   const former=sdk.rpc;
   sdk.rpc=async(name,params)=>{
    if(name!=='mobility_stage_g156_merchant_inbox_qa')return former(name,params);
    m.state.rpcs.push({name,params});
    if(denied||params._actor!==stranger||params._merchant!==vehicle)
     return {data:null,error:{code:'P1561'}};
    return {data:{merchantId:vehicle,limit:20,
     serverPersisted:true,qaOnly:true,productionEnabled:false,orders:[{
      orderId:ride,branchId:offer,status:'ready',revision:5,
      vehicleKind:'MOTO',subtotalPyg:25000,deliveryId,
      lineCount:1,itemUnits:2,createdAt:'2026-10-28T12:00:00.000Z'
     }]},error:null};
   };
  }
  return sdk;
 };
 const trust={...merchantStaffTrust(),
  verifySessionNotRevoked:async({userId,sessionId})=>
   active&&userId===stranger&&sessionId===offer};
 const runtime=await prepare(m,{merchantStaffTrust:trust});
 await http(runtime,async base=>{
  assert.equal((await req(base,g156InboxPath,'rider')).status,401);
  const good=await req(base,g156InboxPath,'stranger');
  assert.equal(good.status,200,JSON.stringify(good.body));
  assert.equal(good.body.merchantId,vehicle);
  assert.equal(good.body.orders.length,1);
  assert.equal(good.body.orders[0].orderId,ride);
  assert.equal(good.body.orders[0].status,'ready');
  assert.equal(good.body.liveCommerceEnabled,false);
  assert.equal(JSON.stringify(good.body).includes(passenger),false);
  let sql=m.state.rpcs.filter(x=>x.name==='mobility_stage_g156_merchant_inbox_qa');
  assert.deepEqual(sql,[{name:'mobility_stage_g156_merchant_inbox_qa',
   params:{_actor:stranger,_merchant:vehicle,_session:offer,_iat:now-1000}}]);
  assert.equal((await req(base,
   '/v1/staging/merchant/'+ride+'/orders/inbox','stranger')).status,403);
  denied=true;
  assert.equal((await req(base,g156InboxPath,'stranger')).status,403);
  active=false;
  assert.equal((await req(base,g156InboxPath,'stranger')).status,401);
  sql=m.state.rpcs.filter(x=>x.name==='mobility_stage_g156_merchant_inbox_qa');
  assert.equal(sql.length,3);
 });
});
test('G156 IdP identity mismatch blocks all original merchant SQL reads',async()=>{
 const m=mockSupabase();
 const runtime=await prepare(m,{merchantStaffTrust:{
  ...merchantStaffTrust(),
  verifyMerchantSession:async()=>({
   id:passenger,sessionId:offer,tokenIatMs:now-1000,
   expiresAtMs:now+60000,is_anonymous:false
  })
 }});
 await http(runtime,async base=>{
  assert.equal((await req(base,g156InboxPath,'stranger')).status,401);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g156_merchant_inbox_qa').length,0);
 });
});

const g158Path='/v1/staging/admin/fraud/verified-reports';
test('G158 Admin fraud endpoint stays closed without trusted AAL2 and SQL',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,g158Path,'stranger')).status,503);
  assert.equal(m.state.rpcs.filter(x=>x.name.includes('g157_admin_review')).length,0);
 });
});
test('G158 original G4 Admin HTTPS/IdP/AAL2/G27 SQL exposes only unsanctioned G157 claims',async()=>{
 const m=mockSupabase(),previous=m.createClient;
 m.state.adminRole='admin';
 let allowed=true,revoke=false;
 m.createClient=(url,key)=>{
  const sdk=previous(url,key);
  if(key===serviceKey){
   const original=sdk.rpc;
   sdk.rpc=async(name,params)=>{
    if(name==='mobility_stage_g27_backoffice_has_scope'){
     m.state.rpcs.push({name,params});
     return {data:allowed&&params._user===stranger&&params._scope==='admin.incidents.read',error:null};
    }
    if(name==='mobility_stage_g157_admin_review_queue_qa'){
     m.state.rpcs.push({name,params});
     return {data:{qaOnly:true,productionEnabled:false,
      automaticSuspension:false,dispatchPenaltyApplied:false,
      findingEstablished:false,hasMore:false,items:[{
       ratedKind:'COURIER',ratedId:driver,recentReports:1,
       independentReporters:1,distinctServices:1,
       reviewTier:'SINGLE_SOURCE_REVIEW',allegationOnly:true
      }]},error:null};
    }
    return original(name,params);
   };
  }
  return sdk;
 };
 const runtime=await prepare(m,{adminF1Trust:trust({
  verifySessionNotRevoked:async()=>!revoke
 })});
 await http(runtime,async base=>{
  assert.equal((await req(base,g158Path,'rider')).status,401);
  const good=await req(base,g158Path,'stranger');
  assert.equal(good.status,200,JSON.stringify(good.body));
  assert.equal(good.body.viewerId,stranger);
  assert.equal(good.body.items.length,1);
  assert.equal(good.body.items[0].ratedId,driver);
  assert.equal(good.body.findingEstablished,false);
  assert.equal(good.body.automaticSuspension,false);
  assert.equal(good.body.dispatchPenaltyApplied,false);
  assert.doesNotMatch(JSON.stringify(good.body),/reporterId|SUSPECTED_FRAUD|sb_secret/);
  const reads=m.state.rpcs.filter(x=>x.name==='mobility_stage_g157_admin_review_queue_qa');
  assert.deepEqual(reads,[{name:'mobility_stage_g157_admin_review_queue_qa',
   params:{_admin:stranger,_limit:50}}]);
  allowed=false;
  assert.equal((await req(base,g158Path,'stranger')).status,403);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g157_admin_review_queue_qa').length,1);
  revoke=true;
  assert.equal((await req(base,g158Path,'stranger')).status,401);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g157_admin_review_queue_qa').length,1);
 });
});
test('G158 AAL2 failure and Owner role cannot see allegations or reach source SQL',async()=>{
 for(const config of [
  {trust:trust({verifyBackofficeMfa:async()=>({verifiedByProvider:false})}),role:'admin',status:403},
  {trust:trust(),role:'owner',status:403}
 ]){
  const m=mockSupabase();m.state.adminRole=config.role;
  // Model the independent G27 permission response so the MFA denial is
  // evaluated instead of an unrelated absent-RPC error (HTTP 503).
  const original=m.createClient;
  m.createClient=(url,key)=>{
   const sdk=original(url,key);
   if(key===serviceKey){
    const before=sdk.rpc;
    sdk.rpc=(name,params)=>name==='mobility_stage_g27_backoffice_has_scope'
     ?Promise.resolve({data:config.role==='admin',error:null})
     :before(name,params);
   }
   return sdk;
  };
  const runtime=await prepare(m,{adminF1Trust:config.trust});
  await http(runtime,async base=>{
   assert.equal((await req(base,g158Path,'stranger')).status,config.status);
   assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g157_admin_review_queue_qa').length,0);
  });
 }
});

const g170Path='/v1/staging/driver/trips/current';
test('G170 current Driver AUTO recovery defaults closed without attested IdP',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,g170Path,'driver')).status,503);
  assert.equal(m.state.g106RecoveryReads??0,0);
 });
});
test('G170 Driver resumes only its original ACTIVE AUTO SQL trip after restart',async()=>{
 const m=mockSupabase(),trust=g80Trust();
 const runtime=await prepare(m,{driverKycTrust:trust.trust});
 await http(runtime,async base=>{
  assert.equal((await req(base,g170Path,'rider')).status,401);
  assert.equal((await req(base,g170Path,'stranger')).status,401);
  const empty=await req(base,g170Path,'driver');
  assert.equal(empty.status,200);
  assert.equal(empty.body.activeTrip,null,'No G38-approved assignment means no trip');
  assert.equal(empty.body.productionEnabled,false);
  m.state.trip={...m.state.trip,driver_id:driver,vehicle_id:vehicle,
   status:'accepted',revision:2};
  const accepted=await req(base,g170Path,'driver');
  assert.equal(accepted.status,200);
  assert.deepEqual(accepted.body.activeTrip,{tripId:ride,status:'accepted',revision:2});
  assert.equal(accepted.body.liveTripsEnabled,false);
  assert.equal(accepted.body.productionEnabled,false);
  assert.equal(Object.keys(accepted.body).length,5);
  assert.doesNotMatch(JSON.stringify(accepted.body),
   /passengerId|passenger_id|vehicleId|location|origin|destination|payment/i);
  m.state.trip={...m.state.trip,status:'arriving',revision:3};
  assert.deepEqual((await req(base,g170Path,'driver')).body.activeTrip,
   {tripId:ride,status:'arriving',revision:3});
  m.state.trip={...m.state.trip,status:'in_progress',revision:4};
  assert.deepEqual((await req(base,g170Path,'driver')).body.activeTrip,
   {tripId:ride,status:'in_progress',revision:4});
  m.state.trip={...m.state.trip,status:'completed',revision:5};
  assert.equal((await req(base,g170Path,'driver')).body.activeTrip,null);
  assert.equal(m.state.g106RecoveryReads,5);
 });
});
test('G170 revoked, dual-role and mismatched Driver sessions cannot query original trip',async()=>{
 for(const mode of ['revoked','dualRole','foreignIdp']){
  const m=mockSupabase();
  m.state.trip={...m.state.trip,driver_id:driver,status:'accepted',revision:2};
  const trust=g80Trust();
  if(mode==='dualRole')m.state.dualRoleDriver=true;
  if(mode==='revoked')trust.trust.verifySessionNotRevoked=async()=>false;
  if(mode==='foreignIdp')trust.trust.verifyDriverSession=async()=>({
   id:passenger,sessionId:vehicle,tokenIatMs:now-1000,
   expiresAtMs:now+60000,is_anonymous:false
  });
  const runtime=await prepare(m,{driverKycTrust:trust.trust});
  await http(runtime,async base=>{
   const r=await req(base,g170Path,'driver');
   assert.equal(r.status,mode==='dualRole'?403:401);
   assert.equal(m.state.g106RecoveryReads??0,0);
  });
 }
});
test('G170 ambiguous/offline original PostgreSQL cannot manufacture Driver assignment',async()=>{
 for(const failure of ['ambiguous','offline']){
  const m=mockSupabase(),trust=g80Trust();
  m.state.trip={...m.state.trip,driver_id:driver,status:'accepted',revision:2};
  if(failure==='ambiguous')m.state.g106DuplicateAssignment=true;
  else m.state.g89TripReadError=true;
  const runtime=await prepare(m,{driverKycTrust:trust.trust});
  await http(runtime,async base=>{
   const response=await req(base,g170Path,'driver');
   assert.equal(response.status,503);
   assert.equal(response.body.productionEnabled,false);
   assert.equal(response.body.activeTrip,undefined);
  });
 }
});

const g173Path='/v1/staging/merchant/orders/'+ride+'/transition';
const g173AttachPath='/v1/staging/merchant/orders/'+ride+'/attach-delivery';
test('G173 original G4 merchant writes never fall through to weaker G6 authentication',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  const order={event:'confirm',eventKey:requestKey};
  const r=await req(base,g173Path,'stranger','POST',order);
  assert.equal(r.status,401,'Merchant G6 legacy path cannot write without IdP');
  assert.equal((await req(base,g173AttachPath,'stranger','POST',{
   deliveryId,requestKey})).status,401);
  assert.equal((await req(base,g173Path.toUpperCase(),'stranger','POST',order)).status,401,
   'Case variants cannot escape G173 merchant authority');
  assert.equal((await req(base,g173Path,'stranger','POST',{
   event:'cancel',eventKey:requestKey})).status,400);
  assert.equal(m.state.rpcs.filter(x=>x.name.includes('merchant_order_transition')).length,0);
  assert.equal(m.state.rpcs.filter(x=>x.name.includes('g173')).length,0);
 });
});
test('G173 G4 original merchant mutations require independent staff + G42 SQL and preserve replay key',async()=>{
 const m=mockSupabase(),old=m.createClient;
 const writes=[];let sqlDenied=false,revoked=false;
 m.createClient=(url,key)=>{
  const sdk=old(url,key);
  if(key===serviceKey){
   const rpc=sdk.rpc;
   sdk.rpc=async(name,args)=>{
    if(name==='mobility_stage_g173_merchant_transition_qa'||
       name==='mobility_stage_g173_merchant_attach_qa'){
     writes.push({name,args});
     return sqlDenied?{data:null,error:{code:'P1731'}}:{data:offer,error:null};
    }
    return rpc(name,args);
   };
  }
  return sdk;
 };
 const trust={...merchantStaffTrust(),
  verifySessionNotRevoked:async()=>!revoked};
 const runtime=await prepare(m,{merchantStaffTrust:trust});
 await http(runtime,async base=>{
  const body={event:'confirm',eventKey:requestKey};
  assert.equal((await req(base,g173Path,'rider','POST',body)).status,401);
  const first=await req(base,g173Path,'stranger','POST',body);
  assert.equal(first.status,200,JSON.stringify(first.body));
  assert.equal(first.body.eventId,offer);
  assert.equal(first.body.event,'confirm');
  assert.equal(first.body.serverPersisted,true);
  assert.equal(first.body.liveCommerceEnabled,false);
  const repeat=await req(base,g173Path,'stranger','POST',body);
  assert.equal(repeat.status,200);
  assert.equal(repeat.body.eventId,offer);
  assert.deepEqual(writes.slice(0,2),Array(2).fill(null).map(()=>({
   name:'mobility_stage_g173_merchant_transition_qa',
   args:{_actor:stranger,_session:offer,_iat:now-1000,
    _order:ride,_request:requestKey,_action:'confirm'}
  })));
  const link=await req(base,g173AttachPath,'stranger','POST',{deliveryId,requestKey});
  assert.equal(link.status,200);
  assert.deepEqual(writes[2],{
   name:'mobility_stage_g173_merchant_attach_qa',
   args:{_actor:stranger,_session:offer,_iat:now-1000,
    _order:ride,_request:requestKey,_delivery:deliveryId}
  });
  sqlDenied=true;
  assert.equal((await req(base,g173Path,'stranger','POST',body)).status,409);
  revoked=true;
  assert.equal((await req(base,g173Path,'stranger','POST',body)).status,401);
  assert.equal(writes.length,4,'Revocation must never reach source SQL');
  assert.equal(m.state.rpcs.some(x=>x.name==='mobility_stage_merchant_order_transition'),false);
 });
});
test('G173 mid-mutation revocation cannot return successful merchant receipt',async()=>{
 const m=mockSupabase(),old=m.createClient;
 let active=true;
 m.createClient=(url,key)=>{
  const sdk=old(url,key);
  if(key===serviceKey){
   const former=sdk.rpc;
   sdk.rpc=async(name,args)=>{
    if(name==='mobility_stage_g173_merchant_transition_qa'){
     active=false;return {data:offer,error:null};
    }
    return former(name,args);
   };
  }
  return sdk;
 };
 const runtime=await prepare(m,{merchantStaffTrust:{
  ...merchantStaffTrust(),verifySessionNotRevoked:async()=>active
 }});
 await http(runtime,async base=>{
  const r=await req(base,g173Path,'stranger','POST',{
   event:'ready',eventKey:requestKey
  });
  assert.equal(r.status,401);
  assert.equal(r.body.serverPersisted,undefined);
 });
});

const g174Reserve='/v1/staging/buyer/orders/qa/reserve';
const g174Cancel='/v1/staging/buyer/orders/qa/cancel';
const g174Recover='/v1/staging/buyer/orders/qa/requests/'+requestKey;
function buyerCommerceTrust(){
 return {
  verifyBuyerSession:async token=>{
   if(token!==jwt.rider)throw Error('Independent Buyer identity denied');
   return {id:passenger,sessionId:vehicle,tokenIatMs:now-1000,
    expiresAtMs:now+60000,is_anonymous:false};
  },
  verifySessionNotRevoked:async()=>true
 };
}
const g174Receipt=()=>({
 receiptId:offer,orderId:ride,requestKey,branchId:vehicle,catalogVersion:1,
 subtotalPyg:12000,receiptStatus:'QA_RESERVED_NO_PAYMENT',
 orderEnabled:false,productionEnabled:false
});
test('G174 Client original G45 commerce remains unavailable without separate Buyer provider authority',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  assert.equal((await req(base,g174Reserve,'rider','POST',{})).status,503);
  assert.equal((await req(base,g174Recover,'rider')).status,503);
  assert(!m.state.rpcs.some(x=>x.name.startsWith('mobility_stage_g45_')));
 });
 for(const invalid of [{}, {...buyerCommerceTrust(),browserCanApprove:true},
  {...buyerCommerceTrust(),verifySessionNotRevoked:null}]){
  const m=mockSupabase();
  await assert.rejects(prepare(m,{buyerCommerceTrust:invalid}));
  assert.equal(m.state.clients.length,0);
 }
});
test('G174 original G45 Buyer reserve/cancel/recovery connects A+B through same G4 HTTP runtime',async()=>{
 const m=mockSupabase(),old=m.createClient;
 let active=true;
 m.createClient=(url,key)=>{
  const client=old(url,key);
  if(key===serviceKey){
   const previous=client.rpc;
   client.rpc=async(name,params)=>{
    if(['mobility_stage_g45_reserve_order_qa',
      'mobility_stage_g144_recover_order_qa',
      'mobility_stage_g45_cancel_order_qa'].includes(name)){
     m.state.rpcs.push({name,params});
     if(name==='mobility_stage_g45_reserve_order_qa')
      return {data:g174Receipt(),error:null};
     if(name==='mobility_stage_g144_recover_order_qa')
      return {data:{...g174Receipt(),status:'requested',
       revision:1,deliveryId:null},error:null};
     return {data:{
      orderId:ride,receiptId:offer,eventId:deliveryId,
      receiptStatus:'QA_CANCELLED_STOCK_RESTORED',
      refundStatus:'NO_PSP_NO_FINANCIAL_REFUND',
      orderEnabled:false,productionEnabled:false},error:null};
    }
    return previous(name,params);
   };
  }
  return client;
 };
 const runtime=await prepare(m,{buyerCommerceTrust:{
  ...buyerCommerceTrust(),verifySessionNotRevoked:async()=>active
 }});
 const payload={requestKey,branchId:vehicle,catalogVersion:1,
  vehicleKind:'MOTO',items:[{itemId:deliveryId,quantity:2}]};
 await http(runtime,async base=>{
  assert.equal((await req(base,g174Reserve,'driver','POST',payload)).status,401);
  const booked=await req(base,g174Reserve,'rider','POST',payload);
  assert.equal(booked.status,201,JSON.stringify(booked.body));
  assert.deepEqual(booked.body,g174Receipt());
  const recovered=await req(base,g174Recover,'rider');
  assert.equal(recovered.status,200,JSON.stringify(recovered.body));
  assert.equal(recovered.body.orderId,ride);
  assert.equal(recovered.body.deliveryId,null);
  const canceled=await req(base,g174Cancel,'rider','POST',{
   orderId:ride,cancelKey:fareQuote
  });
  assert.equal(canceled.status,200,JSON.stringify(canceled.body));
  assert.equal(canceled.body.refundStatus,'NO_PSP_NO_FINANCIAL_REFUND');
  const original=m.state.rpcs.filter(x=>x.name.startsWith('mobility_stage_g45_')||
   x.name==='mobility_stage_g144_recover_order_qa');
  assert.equal(original.length,3);
  assert.deepEqual(original[0],{
   name:'mobility_stage_g45_reserve_order_qa',
   params:{_buyer:passenger,_session:vehicle,_iat_ms:now-1000,
    _request_key:requestKey,_branch:vehicle,_catalog_version:1,
    _vehicle_kind:'MOTO',_items:[{itemId:deliveryId,quantity:2}]}
  });
  active=false;
  assert.equal((await req(base,g174Recover,'rider')).status,401);
  assert.equal(original.length,3);
  assert.equal(m.state.rpcs.filter(x=>x.name.startsWith('mobility_stage_g45_')||
   x.name==='mobility_stage_g144_recover_order_qa').length,3);
 });
});
test('G174 mismatched original Buyer IdP never reaches G45 stock SQL',async()=>{
 const m=mockSupabase();
 const runtime=await prepare(m,{buyerCommerceTrust:{
  ...buyerCommerceTrust(),verifyBuyerSession:async()=>({
   id:stranger,sessionId:vehicle,tokenIatMs:now-1000,
   expiresAtMs:now+60000,is_anonymous:false
  })
 }});
 await http(runtime,async base=>{
  assert.equal((await req(base,g174Reserve,'rider','POST',{
   requestKey,branchId:vehicle,catalogVersion:1,
   vehicleKind:'AUTO',items:[{itemId:deliveryId,quantity:1}]
  })).status,401);
  assert(!m.state.rpcs.some(x=>x.name.startsWith('mobility_stage_g45_')));
 });
});

test('G175 original Buyer commerce prevents legacy G6 unverified stock and transition writes',async()=>{
 const m=mockSupabase();
 const runtime=await prepare(m,{buyerCommerceTrust:buyerCommerceTrust()});
 const legacyCreate='/v1/staging/buyer/orders/request';
 const legacyBuyerTransition='/v1/staging/buyer/orders/'+ride+'/transition';
 const oldBody={requestKey,branchId:vehicle,vehicleKind:'MOTO',
  items:[{itemId:deliveryId,quantity:1}]};
 await http(runtime,async base=>{
  const old=await req(base,legacyCreate,'rider','POST',oldBody);
  assert.equal(old.status,409,JSON.stringify(old.body));
  assert.equal(old.body.code,'G175_USE_ORIGINAL_G45_G139_BUYER_ORDER');
  assert.equal(old.body.retryLegacyRequest,false);
  assert.equal(old.body.paymentEnabled,false);
  const update=await req(base,legacyBuyerTransition,'rider','POST',{
   event:'cancel',eventKey:requestKey
  });
  assert.equal(update.status,409,JSON.stringify(update.body));
  assert.equal(update.body.code,'G175_USE_ORIGINAL_G45_G139_BUYER_ORDER');
  const upper=await req(base,legacyCreate.toUpperCase(),'rider','POST',oldBody);
  assert.equal(upper.status,404,'Unrecognized uppercase legacy path must fail closed');
  assert.equal(m.state.rpcs.some(x=>x.name==='mobility_stage_merchant_order_request'||
   x.name==='mobility_stage_merchant_order_transition'),false,
   'No original commerce inventory or Buyer state changes under G6 legacy authority');
 });
});
test('G175 preserves G174 original G45 reserve and G144 recovery with independent Buyer IdP',async()=>{
 const m=mockSupabase(),old=m.createClient;
 m.createClient=(url,key)=>{
  const sdk=old(url,key);
  if(key===serviceKey){
   const former=sdk.rpc;
   sdk.rpc=async(name,params)=>{
    if(name==='mobility_stage_g45_reserve_order_qa'){
     m.state.rpcs.push({name,params});
     return {data:g174Receipt(),error:null};
    }
    if(name==='mobility_stage_g144_recover_order_qa'){
     m.state.rpcs.push({name,params});
     return {data:{...g174Receipt(),status:'requested',
      revision:1,deliveryId:null},error:null};
    }
    return former(name,params);
   };
  }
  return sdk;
 };
 const runtime=await prepare(m,{buyerCommerceTrust:buyerCommerceTrust()});
 await http(runtime,async base=>{
  const body={requestKey,branchId:vehicle,catalogVersion:1,
   vehicleKind:'MOTO',items:[{itemId:deliveryId,quantity:1}]};
  const receipt=await req(base,g174Reserve,'rider','POST',body);
  assert.equal(receipt.status,201,JSON.stringify(receipt.body));
  assert.equal(receipt.body.orderId,ride);
  const recovery=await req(base,g174Recover,'rider');
  assert.equal(recovery.status,200,JSON.stringify(recovery.body));
  assert.equal(recovery.body.orderId,ride);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g45_reserve_order_qa').length,1);
  assert.equal(m.state.rpcs.filter(x=>x.name==='mobility_stage_g144_recover_order_qa').length,1);
 });
});

test('G176 keeps sender G5 cancellation, original status and G121-style recovery intact',async()=>{
 const m=mockSupabase(),runtime=await prepare(m);
 await http(runtime,async base=>{
  const created=await req(base,deliveryRequestPath,'rider','POST',{
   requestKey,vehicleKind:'MOTO',category:'PARCEL',grams:2000,
   lengthCm:20,widthCm:15,heightCm:10,pickupTag:'SHOP_A',
   deliveryTag:'CUSTOMER_A',restrictedItemDeclared:false
  });
  assert.equal(created.status,201,JSON.stringify(created.body));
  const cancel=await req(base,deliveryTransitionPath,'rider','POST',{
   event:'cancel',eventKey:fareQuote
  });
  assert.equal(cancel.status,200,JSON.stringify(cancel.body));
  assert.equal(cancel.body.event,'cancel');
  const saved=await req(base,deliveryStatusPath,'rider');
  assert.equal(saved.status,200);
  assert.equal(saved.body.delivery.status,'cancelled');
  assert.equal((await req(base,deliveryTransitionPath,'driver','POST',{
   event:'pickup',eventKey:offer
  })).status,409);
  assert.equal((await req(base,deliveryTransitionPath,'driver','POST',{
   event:'deliver',eventKey:offer,proofRef:deliveryProof
  })).status,409);
  const actualWrites=m.state.rpcs.filter(x=>x.name==='mobility_stage_delivery_transition');
  assert.equal(actualWrites.length,1,'Only the authenticated sender cancel can reach G5 SQL');
  assert.equal(actualWrites[0].params._action,'cancel');
 });
});

test('G177 verified original Driver SQL steps preserve ordered AUTO trip and idempotent receipts',async()=>{
 const m=mockSupabase(),original=m.createClient;
 // Pre-G38 accepted QA fixture, NOT evidence of a newly legal G73 dispatch.
 m.state.trip={...m.state.trip,driver_id:driver,vehicle_id:vehicle,
  status:'accepted',revision:2};
 const committed=new Map();const calls=[];
 m.createClient=(url,key)=>{
  const sdk=original(url,key);
  if(key===serviceKey){
   const former=sdk.rpc;
   sdk.rpc=async(name,args)=>{
    if(name!=='mobility_stage_g177_driver_auto_step_qa')return former(name,args);
    calls.push(args);
    if(args._driver!==driver||args._trip!==ride||args._session!==vehicle||
       args._iat!==now-1000)return {data:null,error:{code:'P1771'}};
    const previous=committed.get(args._key);
    if(previous)return previous.event===args._event?
     {data:previous.id,error:null}:{data:null,error:{code:'P1771'}};
    const steps={arrive:['accepted','arriving',offer],
     pickup:['arriving','in_progress',deliveryId],
     complete:['in_progress','completed',fareQuote]};
    const [expected,next,id]=steps[args._event]??[];
    if(!id||m.state.trip.status!==expected)
     return {data:null,error:{code:'P1771'}};
    m.state.trip={...m.state.trip,status:next,revision:m.state.trip.revision+1};
    committed.set(args._key,{event:args._event,id});
    return {data:id,error:null};
   };
  }
  return sdk;
 };
 let active=true;
 const trust=g80Trust({verifySessionNotRevoked:async()=>active});
 const runtime=await prepare(m,{driverKycTrust:trust.trust});
 await http(runtime,async base=>{
  const steps=[['arrive',requestKey,'arriving'],
   ['pickup',deliveryProof,'in_progress'],
   ['complete',fareQuote,'completed']];
  for(const [event,eventKey,status] of steps){
   const res=await req(base,transitionPath,'driver','POST',{event,eventKey});
   assert.equal(res.status,200,JSON.stringify(res.body));
   assert.equal(res.body.event,event);
   assert.equal(res.body.serverPersisted,true);
   assert.equal(res.body.commercialRidesEnabled,false);
   assert.deepEqual(Object.keys(res.body).sort(),
    ['mode','commercialRidesEnabled','tripId','event','eventId','serverPersisted'].sort(),
    'G177 must preserve the exact native G65 lifecycle receipt');
   assert.equal(m.state.trip.status,status);
   if(event==='arrive'){
    // C's real native G65 HTTP codec consumes this exact A/G177 response,
    // with the same original G3 receipt and no second state change.
    const native=await transitionPrivateDriverTrip({
     apiOrigin:'https://api-staging.movetefacil.example',
     approvedStagingHost:'api-staging.movetefacil.example',
     allowedByOwner:true,accessToken:jwt.driver,tripId:ride,
     event,eventKey,request:(url,options)=>
      fetch(base+new URL(url).pathname,options)
    });
    assert.equal(native.receiptId,res.body.eventId);
    assert.equal(native.serverPersisted,true);
    assert.equal(native.productionEnabled,false);
   }
   const repeat=await req(base,transitionPath,'driver','POST',{event,eventKey});
   assert.equal(repeat.status,200);
   assert.equal(repeat.body.eventId,res.body.eventId);
  }
  assert.equal(committed.size,3);
  assert.equal(m.state.trip.revision,5);
  active=false;
  assert.equal((await req(base,transitionPath,'driver','POST',{
   event:'complete',eventKey:fareQuote})).status,401);
  assert.equal(calls.length,7,'Native C replay shares G3 receipt; revocation never invokes SQL');
 });
});
test('G177 driver provider mismatch or revoked session refuses all AUTO transitions',async()=>{
 for(const variant of ['foreign','revoked','missingRole']){
  const m=mockSupabase();m.state.trip={...m.state.trip,driver_id:driver,
   vehicle_id:vehicle,status:'accepted',revision:2};
  let sqlCalls=0;
  const prior=m.createClient;
  m.createClient=(url,key)=>{
   const sdk=prior(url,key);
   if(key===serviceKey){
    const before=sdk.rpc;
    sdk.rpc=async(name,args)=>{
     if(name==='mobility_stage_g177_driver_auto_step_qa'){
      sqlCalls++;return {data:offer,error:null};
     }
     return before(name,args);
    };
   }
   return sdk;
  };
  const options=variant==='foreign'?{
   verifyDriverSession:async()=>({id:stranger,sessionId:vehicle,
    tokenIatMs:now-1000,expiresAtMs:now+60000,is_anonymous:false})
  }:variant==='revoked'?{verifySessionNotRevoked:async()=>false}:{};
  if(variant==='missingRole')m.state.dualRoleDriver=true;
  const runtime=await prepare(m,{driverKycTrust:g80Trust(options).trust});
  await http(runtime,async base=>{
   const result=await req(base,transitionPath,'driver','POST',{
    event:'arrive',eventKey:requestKey
   });
   assert.equal(result.status,variant==='missingRole'?403:401);
   assert.equal(sqlCalls,0);
  });
 }
});
test('G177 denied SQL cannot be presented as an acknowledged Driver arrival',async()=>{
 const m=mockSupabase(),previous=m.createClient;
 m.state.trip={...m.state.trip,driver_id:driver,
  vehicle_id:vehicle,status:'accepted',revision:2};
 m.createClient=(url,key)=>{
  const sdk=previous(url,key);
  if(key===serviceKey){
   const before=sdk.rpc;
   sdk.rpc=async(name,args)=>name==='mobility_stage_g177_driver_auto_step_qa'?
    {data:null,error:{code:'P1771'}}:before(name,args);
  }
  return sdk;
 };
 const runtime=await prepare(m,{driverKycTrust:g80Trust().trust});
 await http(runtime,async base=>{
  const denied=await req(base,transitionPath,'driver','POST',{
   event:'arrive',eventKey:requestKey
  });
  assert.equal(denied.status,409,JSON.stringify(denied.body));
  assert.equal(denied.body.retrySafe,false);
  assert.equal(denied.body.serverPersisted,undefined);
  assert.equal(m.state.trip.status,'accepted');
 });
});

test('G229 operator readiness is read-only and fails closed when Auth, roles or a service table disappear',async()=>{
 const m=mockSupabase();
 const runtime=await prepare(m);
 assert.equal(typeof runtime.readinessProbe,'function');
 assert.equal(await runtime.readinessProbe(),true);
 assert.equal(m.state.rpcs.length,0,'health never performs business RPCs');
 m.state.missing='mobility_stage_merchant_orders';
 await assert.rejects(runtime.readinessProbe(),/STAGING dependency unavailable/);
 m.state.missing='user_roles';
 await assert.rejects(runtime.readinessProbe(),/STAGING dependency unavailable/);
 m.state.missing=null;
 m.state.policy=false;
 await assert.rejects(runtime.readinessProbe(),/Auth public signup/);
 assert.equal(m.state.rpcs.length,0,'readiness must remain read-only on failure');
});
