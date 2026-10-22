/**
 * QORE Radar G4 isolated Supabase STAGING runtime — LOCAL QA ONLY.
 * No server is opened unless native Auth signup is disabled AND G3/G4
 * schemas exist AND LIVE operations are explicitly disabled.
 * Connecting does not migrate/seed, deploy, notify drivers or process rides.
 * Passenger accepted-state profile+ETA is intentionally fail-closed until a
 * separately verified, authorized human profile/GPS/road router is supplied.
 */
import {safeStageRef,assertPublishableKey,inspectStageSignup} from '../scripts/staging-auth-policy-gate.mjs';
import {createQoreOfferGateway} from './g4-offer-gateway.mjs';
import {createQoreRiderStatusGateway} from './g4-rider-status-gateway.mjs';
import {createQoreRadarLoopbackTransport} from './g4-loopback-http-transport.mjs';
import {createStagingRateLimiter} from './g2-staging-vehicle-gateway.mjs';
import {createSupabaseStagingDispatchRepository} from './g4-supabase-dispatch-repository.mjs';
import {createQoreTripCommandGateway} from './g4-trip-command-gateway.mjs';
import {createSupabaseStagingDeliveryRepository} from './g5-supabase-delivery-repository.mjs';
import {createQoreDeliveryCommandGateway} from './g5-delivery-command-gateway.mjs';
import {createSupabaseStagingMerchantRepository} from './g6-supabase-merchant-repository.mjs';
import {createQoreMerchantOrderGateway} from './g6-merchant-order-gateway.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_NAMES=new Set(['service_role']);
const STAGE_TABLES=[
 'mobility_stage_auto_demo_trips',
 'mobility_stage_auto_demo_offers',
 'mobility_stage_auto_demo_events',
 'mobility_stage_auto_demo_push_outbox',
 'mobility_stage_delivery_vehicle_clearance',
 'mobility_stage_deliveries',
 'mobility_stage_delivery_events',
 'mobility_stage_merchants',
 'mobility_stage_merchant_staff',
 'mobility_stage_merchant_branches',
 'mobility_stage_catalog_items',
 'mobility_stage_merchant_orders',
 'mobility_stage_merchant_order_lines',
 'mobility_stage_merchant_order_events',
];
const required=(v,name)=>{
 if(typeof v!=='string'||!v.trim())throw Error('Missing '+name);
 return v;
};
const parseServiceRole=(key,ref)=>{
 if(typeof key!=='string'||key.length<25||/\s/.test(key))
  throw Error('Server-side service key missing or invalid');
 if(/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(key))return true;
 const parts=key.split('.');
 if(parts.length!==3)throw Error('Server-only service role key required');
 try{
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(!ROLE_NAMES.has(claims.role)||
    (typeof claims.ref==='string'&&claims.ref!==ref))
   throw Error('Wrong Supabase service key role or environment');
  return true;
 }catch{throw Error('Server-only service role key required');}
};
function validClients(auth,admin){
 return auth&&typeof auth.auth?.getUser==='function'&&
  admin&&typeof admin.from==='function'&&typeof admin.rpc==='function';
}
async function assertDatabaseG4(admin){
 for(const table of STAGE_TABLES){
  // Head-only, SELECT id, zero returned rows; strictly no writes or fixtures.
  const q=admin.from(table).select('id',{head:true,count:'exact'}).limit(0);
  const {error}=await q;
  if(error)throw Error('G4/G5 ephemeral-only schema not installed in target staging');
 }
}
async function singleRole(admin,id){
 // A second privileged role must never be masked by filtering for the
 // requested role. Fetch all assigned roles and fail closed on dual roles.
 const {data,error}=await admin.from('user_roles').select('role')
  .eq('user_id',id).limit(3);
 if(error)throw Error('Role lookup failed');
 return Array.isArray(data)&&data.length===1&&
  ['passenger','driver'].includes(data[0].role)?data[0].role:null;
}
const roleHas=(admin,id,role)=>singleRole(admin,id).then(actual=>actual===role);
function checkedIsoToMs(iso){
 if(typeof iso!=='string')return NaN;
 const at=Date.parse(iso);
 return Number.isSafeInteger(at)&&at>0?at:NaN;
}
/** No fake profile or ETA can be created from the baseline profile table:
 * G1 profiles has only an ID, not verified name/photo/vehicle color/rating.
 * A separate post-approval evidence service is a hard prerequisite. */
async function unavailableArrivalEvidence(){
 throw Error('No independently verified driver display/GPS/road ETA adapter');
}
export async function prepareQoreG4StagingRuntime({
 environment,liveTripsEnabled,allowQa,
 projectRef,anonKey,serviceKey,
 createClient,request=fetch,arrivalEvidence=unavailableArrivalEvidence,now=Date.now,
}){
 if(environment!=='staging'||liveTripsEnabled!==false||allowQa!==true)
  throw Error('G4 requires isolated staging, no LIVE, and explicit local QA authorization');
 const ref=safeStageRef(projectRef);
 assertPublishableKey(anonKey,ref);
 parseServiceRole(serviceKey,ref);
 if(anonKey===serviceKey||typeof createClient!=='function'||
   typeof request!=='function'||typeof arrivalEvidence!=='function'||
   typeof now!=='function')
  throw Error('G4 server-only secret separation and adapters required');
 const options={auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}};
 const url='https://'+ref+'.supabase.co';
 // A bearer supplied by the user is verified over Supabase Auth, never
 // interpreted from unverified JWT payload in JavaScript.
 const auth=createClient(url,anonKey,options);
 const admin=createClient(url,serviceKey,options);
 if(!validClients(auth,admin))throw Error('Supabase Auth/SQL clients unavailable');
 const inspect=async()=>{
  const policy=await inspectStageSignup({ref,key:anonKey,request});
  if(policy.certified!==true)
   throw Error('G4 denied: native Auth public signup remains enabled or unverified');
 };
 // Prevent even local test listener creation with a wrong DB or Auth config.
 await inspect();
 await assertDatabaseG4(admin);
 const persistence=createSupabaseStagingDispatchRepository(admin);
 const deliveryPersistence=createSupabaseStagingDeliveryRepository(admin);
 const merchantPersistence=createSupabaseStagingMerchantRepository(admin);
 const verified=async token=>{
  const {data,error}=await auth.auth.getUser(token);
  if(error||!data?.user)throw Error('Supabase session not confirmed');
  return data.user;
 };
 const limit=createStagingRateLimiter({
  now,windowMs:60_000,maxEntries:1024,draftLimit:30,adminLimit:30
 });
 // The G2 generic limiter has a smaller operation allowlist. Map all G4
 // operations to a safe, shared per-user allowance; this intentionally
 // prevents exhaustive high-rate polling on the local QA loopback.
 const allowRequest=({userId})=>limit({userId,operation:'draft'});
 const rider=createQoreRiderStatusGateway({
  projectRef:ref,verifyAccessToken:verified,
  authorizePassenger:id=>roleHas(admin,id,'passenger'),
  allowRequest,
  loadOwnTrip:async({tripId,passengerId})=>{
   if(!UUID.test(tripId)||!UUID.test(passengerId))return null;
   let result;
   try{result=await persistence.snapshot({
    mode:'SYNTHETIC_STAGING',liveEnabled:false,
    actorId:passengerId,tripId,
   });}catch{return null;}
   const data=result.trip;
   return {
    id:data.id,passengerId:data.passengerId,driverId:data.driverId,
    vehicleId:data.vehicleId,status:data.status,revision:data.revision,
    trackingSequence:0 // Until a verified per-trip GPS revision exists.
   };
  },
  loadArrivalEvidence:async payload=>arrivalEvidence(payload),
  now
 });
 const driver=createQoreOfferGateway({
  projectRef:ref,verifyAccessToken:verified,
  authorizeDriver:id=>roleHas(admin,id,'driver'),
  allowRequest,
  loadOfferForDriver:async({offerId,driverId})=>{
   if(!UUID.test(offerId)||!UUID.test(driverId))return null;
   const {data:offer,error}=await admin.from('mobility_stage_auto_demo_offers')
    .select('id,trip_id,driver_id,status,expires_at')
    .eq('id',offerId).eq('driver_id',driverId).maybeSingle();
   if(error)throw Error('Private offer lookup failed');
   if(!offer)return null;
   const {data:trip,error:e}=await admin.from('mobility_stage_auto_demo_trips')
    .select('id,status,service,origin_tag,destination_tag')
    .eq('id',offer.trip_id).maybeSingle();
   if(e)throw Error('Offer trip lookup failed');
   if(!trip||trip.status!=='searching')return null;
   return {
    offerId:offer.id,tripId:offer.trip_id,driverId:offer.driver_id,
    status:offer.status,expiresAtMs:checkedIsoToMs(offer.expires_at),
    service:trip.service,originTag:trip.origin_tag,
    destinationTag:trip.destination_tag,
   };
  },
  acceptOffer:async params=>{
   const result=await persistence.accept({
    mode:'SYNTHETIC_STAGING',liveEnabled:false,
    actorId:params._driver_id,offerId:params._offer_id,
    decisionKey:params._decision_key,
   });
   return result.eventId;
  },
  declineOffer:async params=>{
   const {data,error}=await admin.rpc('mobility_stage_auto_demo_decline_offer',params);
   if(error)throw Error('G4 database rejected decline');
   return data;
  },
  now
 });
 const commands=createQoreTripCommandGateway({
  projectRef:ref,verifyAccessToken:verified,
  resolveRole:id=>singleRole(admin,id),allowRequest,
  requestTrip:params=>persistence.request({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  transitionTrip:params=>persistence.transition({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
 });
 const deliveries=createQoreDeliveryCommandGateway({
  projectRef:ref,verifyAccessToken:verified,
  resolveRole:id=>singleRole(admin,id),allowRequest,
  requestDelivery:params=>deliveryPersistence.request({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  acceptDelivery:params=>deliveryPersistence.accept({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  transitionDelivery:params=>deliveryPersistence.transition({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  loadDelivery:params=>deliveryPersistence.snapshot({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
 });
 const merchants=createQoreMerchantOrderGateway({
  projectRef:ref,verifyAccessToken:verified,
  authorizeBuyer:id=>roleHas(admin,id,'passenger'),allowRequest,
  authorizeMerchantOrder:({actorId,orderId})=>
   merchantPersistence.isMerchantParticipant({mode:'SYNTHETIC_STAGING',
    liveEnabled:false,actorId,orderId}),
  requestOrder:params=>merchantPersistence.request({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  transitionOrder:params=>merchantPersistence.transition({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  attachDelivery:params=>merchantPersistence.attachDelivery({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  loadOrder:params=>merchantPersistence.snapshot({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
 });
 // Recheck Auth policy on EACH sensitive request; if somebody re-opens
 // signup after startup, request is denied. This is loopback QA, not a
 // production throttled/distributed Auth-settings cache.
 const guard=handler=>async input=>{
  try{await inspect();}catch{
   return {status:503,body:{error:'Staging Auth policy not certified'}};
  }
  return handler(input);
 };
 return {
  projectRef:ref,
  commercialRidesEnabled:false,
  /** A server object, NOT a listener. Even this object cannot bind publicly. */
  server:createQoreRadarLoopbackTransport({
   riderHandler:guard(rider),offerHandler:guard(driver),
   tripCommandHandler:guard(commands),
   deliveryHandler:guard(deliveries),
   merchantHandler:guard(merchants),
  }),
 };
}
