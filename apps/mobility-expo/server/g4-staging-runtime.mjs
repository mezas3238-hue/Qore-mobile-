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
import {createQoreRiderHistoryGateway} from './g26-rider-history-gateway.mjs';
import {createQoreOwnHistoryRepository} from './g26-rider-history-repository.mjs';
import {createQoreRadarLoopbackTransport} from './g4-loopback-http-transport.mjs';
import {createStagingRateLimiter} from './g2-staging-vehicle-gateway.mjs';
import {createSupabaseStagingDispatchRepository} from './g4-supabase-dispatch-repository.mjs';
import {createQoreTripCommandGateway} from './g4-trip-command-gateway.mjs';
import {createSupabaseStagingDeliveryRepository} from './g5-supabase-delivery-repository.mjs';
import {createQoreDeliveryCommandGateway} from './g5-delivery-command-gateway.mjs';
import {createSupabaseStagingMerchantRepository} from './g6-supabase-merchant-repository.mjs';
import {createQoreMerchantOrderGateway} from './g6-merchant-order-gateway.mjs';
import {createSupabaseStagingFinanceRepository} from './g7-supabase-finance-repository.mjs';
import {createQoreFinanceGateway} from './g7-finance-gateway.mjs';
import {createG125CargoPricingContext} from './g125-cargo-pricing-context.mjs';
import {createG127GoogleCargoRoadResolver} from './g127-google-cargo-road-resolver.mjs';
import {createG128GeoapifyCargoRoadResolver} from './g128-geoapify-cargo-road-resolver.mjs';
import {createG134GeoapifyAutoRouteResolver} from './g134-geoapify-auto-route-resolver.mjs';
import {createHash} from 'node:crypto';
import {createQoreG73AutoRepository} from './g73-auto-f1-repository.mjs';
import {createG101MotoPassengerRepository,createG101MotoPassengerGateway} from './g101-moto-passenger-gateway.mjs';
import {createG82PrivateAutoCandidateDispatch} from './g82-f1-auto-candidate-dispatch.mjs';
import {createQoreG73AutoGateway} from './g73-f1-auto-gateway.mjs';
import {createG77VerifiedAutoRouteResolver} from './g77-f1-google-verified-route-resolver.mjs';
import {createG75AdminF1AuditGateway} from './g75-f1-admin-audit-gateway.mjs';
import {createG75AdminF1Repository} from './g75-f1-admin-audit-repository.mjs';
import {createG138AdminAutoTraceGateway} from './g138-admin-auto-trace-gateway.mjs';
import {createG142AdminMotoTraceGateway} from './g142-admin-moto-trace-gateway.mjs';
import {createG145AdminCargoTraceGateway} from './g145-admin-cargo-trace-gateway.mjs';
import {createG146AdminCommerceTraceGateway} from './g146-admin-commerce-trace-gateway.mjs';
import {createSupabaseStagingSafetyRepository} from './g8-supabase-safety-repository.mjs';
import {createQoreSafetyGateway} from './g8-safety-gateway.mjs';
import {createSupabaseStagingMerchantManagementRepository} from './g9-supabase-merchant-management-repository.mjs';
import {createQoreMerchantManagementGateway} from './g9-merchant-management-gateway.mjs';
import {createSupabaseStagingDeliveryOfferRepository} from './g10-supabase-delivery-offer-repository.mjs';
import {createQoreDeliveryOfferGateway} from './g10-delivery-offer-gateway.mjs';
import {createCourierPrivatePollRepository} from './g15-courier-private-poll-repository.mjs';
import {createCourierPrivatePollGateway} from './g15-courier-private-poll-gateway.mjs';
import {createDriverPrivateInboxRepository} from './g16-driver-private-inbox-repository.mjs';
import {createDriverPrivateInboxGateway} from './g16-driver-private-inbox-gateway.mjs';
import {createDriverDocumentRepository} from './g17-driver-document-repository.mjs';
import {createDriverDocumentGateway} from './g17-driver-document-gateway.mjs';
import {createDriverEnrollmentRepository} from './g18-driver-enrollment-repository.mjs';
import {createDriverEnrollmentGateway} from './g18-driver-enrollment-gateway.mjs';
import {createDriverKycReadinessRepository} from './g20-driver-kyc-readiness-repository.mjs';
import {createDriverKycReadinessGateway} from './g20-driver-kyc-readiness-gateway.mjs';
import {createDriverKycExpiryStatusQa} from './driver-kyc-expiry-status-qa.mjs';
import {createG65PrivateDriverTripStatusQa} from './g65-driver-trip-status-qa.mjs';
import {createG65DriverTripStatusRepository} from './g65-driver-trip-status-repository.mjs';
import {createG64PrivateDriverDecisionReconcileQa} from './g64-driver-offer-reconcile-qa.mjs';
import {createG66CourierCustodyRepository} from './g66-courier-custody-repository.mjs';
import {createG66CourierCustodyStatusQa} from './g66-courier-custody-status-qa.mjs';
import {createG66CourierCustodyTransitionQa} from './g66-courier-custody-transition-qa.mjs';
import {createVerifiedPrivateDriverEvidenceObserver} from './g19-private-driver-evidence-observer.mjs';

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
 'mobility_stage_fare_rules',
 'mobility_stage_fare_quotes',
 'mobility_stage_payment_intents',
 'mobility_stage_payment_operations',
 'mobility_stage_ledger_entries',
 'mobility_stage_safety_incidents',
 'mobility_stage_safety_incident_events',
 'mobility_stage_operational_suspensions',
 'mobility_stage_suspension_events',
 'mobility_stage_merchant_management_events',
 'mobility_stage_delivery_offers',
 'mobility_stage_delivery_offer_outbox',
 'mobility_stage_driver_documents',
 'mobility_stage_driver_document_reviews',
 'mobility_stage_driver_enrollments',
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
async function adminRole(admin,id){
 const {data,error}=await admin.from('user_roles').select('role')
  .eq('user_id',id).eq('role','admin').limit(2);
 if(error)throw Error('Admin role lookup failed');
 return Array.isArray(data)&&data.length===1&&data[0]?.role==='admin';
}
async function exclusiveAdminRole(admin,id){
 const {data,error}=await admin.from('user_roles').select('role')
  .eq('user_id',id).limit(3);
 if(error)throw Error('Exclusive admin role lookup failed');
 return Array.isArray(data)&&data.length===1&&data[0]?.role==='admin';
}
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
async function unavailablePrivateObjectObservation(){
 throw Error('No independently verified, scanned private Storage object adapter');
}
async function unavailablePricingContext(){
 throw Error('No independently verified road pricing context adapter');
}
export async function prepareQoreG4StagingRuntime({
 environment,liveTripsEnabled,allowQa,
 projectRef,anonKey,serviceKey,historyCursorSecrets,
 createClient,request=fetch,arrivalEvidence=unavailableArrivalEvidence,
 pricingContext=unavailablePricingContext,
 approvedCargoRoadResolver=null,cargoRoadRoutingApproved=false,
 g127CargoRouteOptions=null,
 g128GeoapifyOptions=null,
 verifiedAutoRoute=null,verifiedMotoRoute=null,g77RouteOptions=null,
 g134GeoapifyAutoOptions=null,
 privateEvidenceAdapters=null,adminF1Trust=null,driverKycTrust=null,
 g66ProofTrust=null,
 readDriverDecisionOwnerQa=null,now=Date.now,
}){
 if(environment!=='staging'||liveTripsEnabled!==false||allowQa!==true)
  throw Error('G4 requires isolated staging, no LIVE, and explicit local QA authorization');
 const ref=safeStageRef(projectRef);
 assertPublishableKey(anonKey,ref);
 parseServiceRole(serviceKey,ref);
 if(anonKey===serviceKey||
   !historyCursorSecrets||
   historyCursorSecrets.current===serviceKey||
   historyCursorSecrets.current===anonKey||
   historyCursorSecrets.previous===serviceKey||
   historyCursorSecrets.previous===anonKey||
   typeof createClient!=='function'||
   typeof request!=='function'||typeof arrivalEvidence!=='function'||
   typeof pricingContext!=='function'||
   !(approvedCargoRoadResolver===null||typeof approvedCargoRoadResolver==='function')||
   !(cargoRoadRoutingApproved===false||cargoRoadRoutingApproved===true)||
   // Exactly one road authority; no Google fallback while Geoapify is chosen.
   (cargoRoadRoutingApproved===true?
    [approvedCargoRoadResolver,g127CargoRouteOptions,g128GeoapifyOptions]
     .filter(v=>v!==null).length!==1:
    [approvedCargoRoadResolver,g127CargoRouteOptions,g128GeoapifyOptions]
     .some(v=>v!==null))||
   !(g127CargoRouteOptions===null||(
    Object.getPrototypeOf(g127CargoRouteOptions)===Object.prototype&&
    Object.keys(g127CargoRouteOptions).length===7&&
    ['enabled','billableProviderApproved','apiKey','resolveCoveredCargoPlaces',
     'verifyCargoTolls','reserveBillableBudget','request']
     .every(k=>Object.hasOwn(g127CargoRouteOptions,k))&&
    g127CargoRouteOptions.enabled===true&&
    g127CargoRouteOptions.billableProviderApproved===true&&
    typeof g127CargoRouteOptions.apiKey==='string'&&
    g127CargoRouteOptions.apiKey.length>=20&&g127CargoRouteOptions.apiKey.length<=300&&
    !/\s/.test(g127CargoRouteOptions.apiKey)&&
    ['resolveCoveredCargoPlaces','verifyCargoTolls','reserveBillableBudget','request']
     .every(k=>typeof g127CargoRouteOptions[k]==='function')
   ))||
   !(g128GeoapifyOptions===null||(
    Object.getPrototypeOf(g128GeoapifyOptions)===Object.prototype&&
    Object.keys(g128GeoapifyOptions).length===7&&
    ['enabled','freePlanApproved','apiKey','resolveCoveredCargoCoordinates',
     'verifyCargoTolls','reserveFreeQuota','request']
     .every(k=>Object.hasOwn(g128GeoapifyOptions,k))&&
    g128GeoapifyOptions.enabled===true&&
    g128GeoapifyOptions.freePlanApproved===true&&
    typeof g128GeoapifyOptions.apiKey==='string'&&
    g128GeoapifyOptions.apiKey.length>=20&&
    g128GeoapifyOptions.apiKey.length<=300&&
    !/\s/.test(g128GeoapifyOptions.apiKey)&&
    ['resolveCoveredCargoCoordinates','verifyCargoTolls','reserveFreeQuota','request']
      .every(k=>typeof g128GeoapifyOptions[k]==='function')
   ))||
   !(g134GeoapifyAutoOptions===null||(
     Object.getPrototypeOf(g134GeoapifyAutoOptions)===Object.prototype
     &&Object.keys(g134GeoapifyAutoOptions).length===8
     &&['enabled','freePlanApproved','apiKey','tagSecret',
       'resolveCoveredAutoCoordinates','verifyAutoTolls',
       'reserveFreeQuota','request']
      .every(k=>Object.hasOwn(g134GeoapifyAutoOptions,k))
     &&g134GeoapifyAutoOptions.enabled===true
     &&g134GeoapifyAutoOptions.freePlanApproved===true
     &&typeof g134GeoapifyAutoOptions.apiKey==='string'
     &&g134GeoapifyAutoOptions.apiKey.length>=20
     &&g134GeoapifyAutoOptions.apiKey.length<=300
     &&!/\s/.test(g134GeoapifyAutoOptions.apiKey)
     &&typeof g134GeoapifyAutoOptions.tagSecret==='string'
     &&g134GeoapifyAutoOptions.tagSecret.length>=32
     &&['resolveCoveredAutoCoordinates','verifyAutoTolls',
       'reserveFreeQuota','request']
      .every(k=>typeof g134GeoapifyAutoOptions[k]==='function')
     &&verifiedAutoRoute===null&&g77RouteOptions===null))||
   !(verifiedAutoRoute===null||typeof verifiedAutoRoute==='function')||
   !(verifiedMotoRoute===null||typeof verifiedMotoRoute==='function')||
   !(privateEvidenceAdapters===null||
     (typeof privateEvidenceAdapters==='object'&&
      !Array.isArray(privateEvidenceAdapters)))||
   !(g77RouteOptions===null||(
     Object.getPrototypeOf(g77RouteOptions)===Object.prototype
     &&Object.keys(g77RouteOptions).length===7
     &&['enabled','billableProviderApproved','apiKey','tagSecret',
       'resolveCoveredPlaces','verifyRouteTolls','request']
       .every(k=>Object.hasOwn(g77RouteOptions,k))
     &&g77RouteOptions.enabled===true
     &&g77RouteOptions.billableProviderApproved===true
     &&typeof g77RouteOptions.apiKey==='string'
     &&g77RouteOptions.apiKey.length>=20&&g77RouteOptions.apiKey.length<=300
     &&!/\s/.test(g77RouteOptions.apiKey)
     &&typeof g77RouteOptions.tagSecret==='string'
     &&g77RouteOptions.tagSecret.length>=32
     &&typeof g77RouteOptions.resolveCoveredPlaces==='function'
     &&typeof g77RouteOptions.verifyRouteTolls==='function'
     &&typeof g77RouteOptions.request==='function'
     &&verifiedAutoRoute===null))||
   !(g66ProofTrust===null||(
     driverKycTrust!==null&&Object.getPrototypeOf(g66ProofTrust)===Object.prototype
     &&Object.keys(g66ProofTrust).length===2
     &&typeof g66ProofTrust.verifyStoredProof==='function'
     &&typeof g66ProofTrust.verifyIndependentProof==='function'))||
   !(readDriverDecisionOwnerQa===null||
      (typeof readDriverDecisionOwnerQa==='function'&&driverKycTrust!==null))||
   !(driverKycTrust===null||(
     Object.getPrototypeOf(driverKycTrust)===Object.prototype&&
     Object.keys(driverKycTrust).length===4&&
     ['verifyDriverSession','verifySessionNotRevoked',
      'resolveActiveVehicle','queryOwnerValidity']
      .every(k=>typeof driverKycTrust[k]==='function')))||
   !(adminF1Trust===null||(Object.getPrototypeOf(adminF1Trust)===Object.prototype
    &&Object.keys(adminF1Trust).length===3
    &&['verifyAdminSession','verifySessionNotRevoked','verifyBackofficeMfa']
      .every(k=>typeof adminF1Trust[k]==='function')))||
   typeof now!=='function')
  throw Error('G4 server-only secret separation and adapters required');
 // Validate billing authorization, key, HMAC and provider authorities BEFORE
 // even constructing Supabase Auth/SQL clients, never after side effects.
 const preparedG77Route=g77RouteOptions===null?null:
  createG77VerifiedAutoRouteResolver({...g77RouteOptions,now});
 // G141: Geoapify Free is a mutually exclusive AUTO provider, not
 // an implicit Google fallback. Separate coverage, tolls and durable
 // quota must all be verified before any road request.
 const preparedG134AutoRoute=g134GeoapifyAutoOptions===null?null:
  createG134GeoapifyAutoRouteResolver({...g134GeoapifyAutoOptions,now});
 // G127 opt-in and prevalidated BEFORE any Supabase Auth clients.
 const preparedG127CargoRoute=g127CargoRouteOptions===null?null:
  createG127GoogleCargoRoadResolver({...g127CargoRouteOptions,now});
 // G128 free routing is an alternative, NOT a paid Google fallback.
 const preparedG128CargoRoute=g128GeoapifyOptions===null?null:
  createG128GeoapifyCargoRoadResolver({...g128GeoapifyOptions,now});
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
 const courierCustodyPersistence=g66ProofTrust===null?null:
  createG66CourierCustodyRepository(admin);
 const merchantPersistence=createSupabaseStagingMerchantRepository(admin);
 const financePersistence=createSupabaseStagingFinanceRepository(admin);
 const f1AutoPersistence=createQoreG73AutoRepository(admin);
 const f1MotoPersistence=createG101MotoPassengerRepository(admin);
 const candidateDispatch=createG82PrivateAutoCandidateDispatch(admin);
 const driverTripStatusPersistence=createG65DriverTripStatusRepository(admin);
 const adminF1Persistence=adminF1Trust===null?null:createG75AdminF1Repository(admin);
 const safetyPersistence=createSupabaseStagingSafetyRepository(admin);
 const merchantManagementPersistence=
  createSupabaseStagingMerchantManagementRepository(admin);
 const deliveryOfferPersistence=createSupabaseStagingDeliveryOfferRepository(admin);
 const privatePollPersistence=createCourierPrivatePollRepository({
  rpc:(name,params)=>admin.rpc(name,params)
 });
 const driverInboxPersistence=createDriverPrivateInboxRepository({
  rpc:(name,params)=>admin.rpc(name,params)
 });
 const driverDocumentPersistence=createDriverDocumentRepository({
  rpc:(name,params)=>admin.rpc(name,params)
 });
 const driverEnrollmentPersistence=createDriverEnrollmentRepository({
  rpc:(name,params)=>admin.rpc(name,params)
 });
 const driverKycReadinessRepository=createDriverKycReadinessRepository({
  rpc:(name,params)=>admin.rpc(name,params)
 });
 const verified=async token=>{
  const {data,error}=await auth.auth.getUser(token);
  if(error||!data?.user)throw Error('Supabase session not confirmed');
  return data.user;
 };
 // G134: when a separately attested KYC/session authority is configured,
 // private offers use it exactly like G65; getUser alone is insufficient.
 const verifiedDriverOfferSession=async token=>{
  if(driverKycTrust===null)throw Error('Driver revocation authority unavailable');
  const provider=await verified(token);
  const attested=await driverKycTrust.verifyDriverSession(token);
  if(provider?.id!==attested?.id||provider?.is_anonymous===true||
     attested?.is_anonymous!==false||
     !(typeof provider?.email_confirmed_at==='string'||
       typeof provider?.phone_confirmed_at==='string'))
   throw Error('G134 Driver identity source mismatch');
  return {...attested,
   ...(typeof provider.email_confirmed_at==='string'?
    {email_confirmed_at:provider.email_confirmed_at}:
    {phone_confirmed_at:provider.phone_confirmed_at})};
 };
 const guardedDriverAuth=driverKycTrust===null?{}:{
  verifyAccessToken:verifiedDriverOfferSession,requireFreshSession:true,
  verifySessionNotRevoked:p=>driverKycTrust.verifySessionNotRevoked(p)
 };
 const limit=createStagingRateLimiter({
  now,windowMs:60_000,maxEntries:1024,draftLimit:30,adminLimit:30
 });
 // The G2 generic limiter has a smaller operation allowlist. Map all G4
 // operations to a safe, shared per-user allowance; this intentionally
 // prevents exhaustive high-rate polling on the local QA loopback.
 const allowRequest=({userId})=>limit({userId,operation:'draft'});
 const riderHistory=createQoreRiderHistoryGateway({
  projectRef:ref,verifyAccessToken:verified,cursorSecrets:historyCursorSecrets,
  authorizePassenger:id=>roleHas(admin,id,'passenger'),allowRequest,
  loadOwnHistory:createQoreOwnHistoryRepository(admin),now
 });
 const rider=createQoreRiderStatusGateway({
  projectRef:ref,verifyAccessToken:verified,
  authorizePassenger:id=>roleHas(admin,id,'passenger'),
  allowRequest,
  loadOwnTrip:async({tripId,passengerId})=>{
   if(!UUID.test(tripId)||!UUID.test(passengerId))return null;
   // Never translate a failed PostgreSQL query into HTTP 404. Only a
   // confirmed absence of an owner-scoped row may produce "not found".
   const result=await persistence.snapshot({
    mode:'SYNTHETIC_STAGING',liveEnabled:false,
    actorId:passengerId,tripId,
   });
   if(result===null)return null;
   if(result?.ok!==true||!result.trip)throw Error('Unverified Rider SQL snapshot');
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
  projectRef:ref,verifyAccessToken:verified,...guardedDriverAuth,
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
  requestTrip:async()=>{
   // F1 safeguard: the G73 route, server quote and explicit passenger
   // acceptance are now the only integrated AUTO booking entry point.
   throw Error('G73 verified route and accepted PYG quote required');
  },
  transitionTrip:params=>persistence.transition({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
 });
 const deliveries=createQoreDeliveryCommandGateway({
  projectRef:ref,verifyAccessToken:verified,
  resolveRole:id=>singleRole(admin,id),allowRequest,
  confirmQuote:params=>deliveryPersistence.confirmQuote({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  reconcileDelivery:params=>deliveryPersistence.reconcile({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
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
 // G125: Generic route/pricing adapters may NEVER mint cargo quotes.
 // Explicit Owner approval and an independent evidence provider are required.
 const cargoPricing=cargoRoadRoutingApproved===true?
  createG125CargoPricingContext({
   enabled:true,now,
   resolveVerifiedCargoRoute:preparedG128CargoRoute??preparedG127CargoRoute??approvedCargoRoadResolver,
   loadSenderDelivery:async({actorId,deliveryId})=>{
    const {data,error}=await admin.from('mobility_stage_deliveries')
     .select('id,sender_id,requested_vehicle_kind,status,courier_id,pickup_tag,delivery_tag')
     .eq('id',deliveryId).eq('sender_id',actorId).maybeSingle();
    if(error)throw Error('G125 private cargo subject cannot be verified');
    return data;
   },
   recordVerifiedRoute:async p=>{
    const {data,error}=await admin.rpc('mobility_stage_g125_record_cargo_road_qa',{
     _sender:p.actorId,_delivery:p.deliveryId,
     _evidence:p.evidenceId,_vehicle:p.vehicleKind,_zone:p.zoneTag,
     _pickup:p.pickupTag,_destination:p.deliveryTag,
     _meters:p.distanceMeters,_seconds:p.durationSeconds,
     _tolls:p.tollsPyg,_verified_at_ms:p.verifiedAtMs,
     _expires_at_ms:p.expiresAtMs
    });
    if(error)throw Error('G125 PostgreSQL route proof registration denied');
    return data;
   }
  }):unavailablePricingContext;
 const finance=createQoreFinanceGateway({
  projectRef:ref,verifyAccessToken:verified,now,
  ...(cargoRoadRoutingApproved===true?{
   recoverCargoQuote:params=>financePersistence.recoverCargoQuote({
    modeGuard:'SYNTHETIC_STAGING',liveEnabled:false,...params,
   })
  }:{}),
  authorizePassenger:id=>roleHas(admin,id,'passenger'),allowRequest,
  loadPricingContext:params=>params.fareMode==='DELIVERY'?
   cargoPricing(params):pricingContext(params),
  quoteFare:params=>financePersistence.quote({
   modeGuard:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  authorizePayment:params=>financePersistence.authorize({
   modeGuard:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  transitionPayment:params=>financePersistence.transition({
   modeGuard:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  loadPayment:params=>financePersistence.paymentSnapshot({
   modeGuard:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
 });
 // G79: choose one route provider. No geocode-first alternative is mounted.
 // All billable routing is OFF unless explicitly approved by Owner.
 const resolvedAutoRoute=preparedG134AutoRoute??preparedG77Route??
  verifiedAutoRoute??unavailablePricingContext;

 // Stable server-derived G82 idempotency UUID. Never supplied by a handset:
 // repeated G73 POSTs cannot create independent offer keys. No secret/auth
 // semantics are attributed to this deterministic identifier.
 const privateAutoOfferKey=(passengerId,bookingKey)=>{
  const value=createHash('sha256')
   .update('QORE:MOVETE:F1:G82:BOOKING:v1:')
   .update(passengerId).update(':').update(bookingKey).digest();
  value[6]=(value[6]&15)|80;
  value[8]=(value[8]&63)|128;
  const hex=value.subarray(0,16).toString('hex');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+
   '-'+hex.slice(16,20)+'-'+hex.slice(20);
 };
 const f1Auto=createQoreG73AutoGateway({
  projectRef:ref,verifyAccessToken:verified,now,
  authorizePassenger:id=>roleHas(admin,id,'passenger'),allowRequest,
  resolveVerifiedRoute:params=>resolvedAutoRoute(params),
  registerRoute:params=>f1AutoPersistence.registerRoute(params),
  loadRoute:params=>f1AutoPersistence.routeReceipt(params),
  quoteRoute:params=>f1AutoPersistence.quote(params),
  loadQuote:params=>f1AutoPersistence.quoteReceipt(params),
  bookQuote:params=>f1AutoPersistence.book(params),
  reconcileBooking:params=>f1AutoPersistence.bookingReceipt(params),
  readDispatchStatus:params=>f1AutoPersistence.dispatchStatus(params),
  // G97: loopback-only wiring; G93/G94/G95 SQL deny remote execution by
  // database/application_name guards. Missing RPC -> fail closed HTTP 503.
  // Do not claim a live financial campaign, merchant settlement, or refund.
  readSubsidyPreview:params=>f1AutoPersistence.previewAutoSubsidy(params),
  readAutoFinancialState:params=>f1AutoPersistence.autoFinancialState(params),
  cancelBookedAuto:params=>f1AutoPersistence.cancelBookedAuto(params),
  readCancellation:params=>f1AutoPersistence.cancellationReceipt(params),
  dispatchBookedAuto:async({passengerId,bookingKey})=>
   candidateDispatch.offerFirstEligible({passengerId,bookingKey,
    offerKey:privateAutoOfferKey(passengerId,bookingKey),ttlSeconds:30}),
 });
 // G101: isolated and independent MOTO ride contract. An AUTO-only
 // route provider is never accepted as authorization for passenger MOTO.
 // No configured provider => 503; G100 SQL itself requires disposable PG16.
 const f1Moto=createG101MotoPassengerGateway({
  projectRef:ref,verifyAccessToken:verified,now,
  authorizePassenger:id=>roleHas(admin,id,'passenger'),allowRequest,
  resolveVerifiedMotoRoute:verifiedMotoRoute??unavailablePricingContext,
  repository:f1MotoPersistence
 });
 // G76: only an independently authenticated and AAL2-verified Admin may
 // access SQL G75. Unconfigured remains HTTP 503; nothing is exposed LIVE.
 // G144: same independently verified, revocable IdP/AAL2 Admin authority
 // for both ORIGINAL source-backed passenger trace endpoints. No browser
 // auth or privilege is inferred from unverified JWT claims.
 const verifiedAdminSession=async token=>{
  const user=await verified(token);
  const attested=await adminF1Trust.verifyAdminSession(token);
  if(!attested||typeof attested!=='object'||attested.id!==user.id||
     attested.is_anonymous!==false||
     !(typeof user.email_confirmed_at==='string'||
       typeof user.phone_confirmed_at==='string'))
   throw Error('Admin IdP session mismatch');
  return {...attested,email_confirmed_at:user.email_confirmed_at,
   phone_confirmed_at:user.phone_confirmed_at};
 };
 const adminRoleFromSql=async id=>{
  const {data,error}=await admin.rpc('mobility_stage_g27_backoffice_role_of',{
   _user:id
  });
  if(error)throw Error('Admin G27 exclusive role lookup unavailable');
  return data;
 };
 const verifiedAdminTrust=adminF1Trust===null?null:{
  verifyAccessToken:verifiedAdminSession,
  verifySessionNotRevoked:p=>adminF1Trust.verifySessionNotRevoked(p),
  loadExclusiveBackofficeRole:adminRoleFromSql,
  verifyBackofficeMfa:p=>adminF1Trust.verifyBackofficeMfa(p),
  allowRequest,now
 };
 const adminF1=verifiedAdminTrust===null?null:createG75AdminF1AuditGateway({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  projectRef:ref,...verifiedAdminTrust,
  loadAdminRideReceipt:p=>adminF1Persistence.read(p),
 });
 // G138 requires a second read of G75 against the same original trip.
 // Missing disposable SQL functions/error NEVER become a successful trace.
 const adminAutoTrace=adminF1===null?null:createG138AdminAutoTraceGateway({
  adminF1AuditGateway:adminF1,now,
  loadAutoTraceReceipt:async({actorId,tripId})=>{
   if(!UUID.test(actorId)||!UUID.test(tripId))
    throw Error('Invalid G138 SQL scope');
   const {data,error}=await admin.rpc('mobility_stage_g138_auto_trace_qa',{
    _admin:actorId,_trip:tripId
   });
   if(error)throw Error('G138 original SQL trace unavailable');
   return data;
  }
 });
 const adminMotoTrace=verifiedAdminTrust===null?null:createG142AdminMotoTraceGateway({
  projectRef:ref,environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  ...verifiedAdminTrust,
  loadMotoTraceReceipt:async({actorId,tripId})=>{
   if(!UUID.test(actorId)||!UUID.test(tripId))
    throw Error('Invalid G142 SQL scope');
   const {data,error}=await admin.rpc('mobility_stage_g142_moto_trace_qa',{
    _admin:actorId,_trip:tripId
   });
   if(error)throw Error('G142 original SQL trace unavailable');
   return data;
  }
 });
 // G145: PRICE-CONSENTED original G5 rows only; neither an unpriced draft
 // nor a courier with missing legal clearance may be called a paid delivery.
 const adminCargoTrace=verifiedAdminTrust===null?null:createG145AdminCargoTraceGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  ...verifiedAdminTrust,
  loadCargoTraceReceipt:async({actorId,deliveryId})=>{
   if(!UUID.test(actorId)||!UUID.test(deliveryId))
    throw Error('Invalid G145 SQL scope');
   const {data,error}=await admin.rpc('mobility_stage_g145_delivery_trace_qa',{
    _admin:actorId,_delivery:deliveryId
   });
   if(error)throw Error('G145 original SQL cargo trace unavailable');
   return data;
  }
 });
 // G146: original G45 Buyer stock/order, read-only Admin provenance.
 // G45 is NOT a quote and no ledger/payment may be inferred from its receipt.
 const adminCommerceTrace=verifiedAdminTrust===null?null:createG146AdminCommerceTraceGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  ...verifiedAdminTrust,
  loadCommerceTraceReceipt:async({actorId,orderId})=>{
   if(!UUID.test(actorId)||!UUID.test(orderId))
    throw Error('Invalid G146 original commerce SQL scope');
   const {data,error}=await admin.rpc('mobility_stage_g146_commerce_trace_qa',{
    _admin:actorId,_order:orderId
   });
   if(error)throw Error('G146 original SQL commerce trace unavailable');
   return data;
  }
 });
 const safety=createQoreSafetyGateway({
  projectRef:ref,verifyAccessToken:verified,authorizeAdmin:id=>adminRole(admin,id),
  allowRequest,
  reportIncident:params=>safetyPersistence.report({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  transitionIncident:params=>safetyPersistence.transition({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  applySuspension:params=>safetyPersistence.applySuspension({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  liftSuspension:params=>safetyPersistence.liftSuspension({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  loadIncident:params=>safetyPersistence.incidentSnapshot({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
 });
 const merchantManagement=createQoreMerchantManagementGateway({
  projectRef:ref,verifyAccessToken:verified,authorizeAdmin:id=>adminRole(admin,id),
  allowRequest,
  onboardMerchant:params=>merchantManagementPersistence.onboarding({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  reviewMerchant:params=>merchantManagementPersistence.review({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  upsertBranch:params=>merchantManagementPersistence.upsertBranch({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  upsertItem:params=>merchantManagementPersistence.upsertItem({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
 });
 const deliveryOffers=createQoreDeliveryOfferGateway({
  projectRef:ref,verifyAccessToken:verified,
  authorizeCourier:id=>roleHas(admin,id,'driver'),allowRequest,now,
  loadOffer:params=>deliveryOfferPersistence.snapshot({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  acceptOffer:params=>deliveryOfferPersistence.accept({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
  declineOffer:params=>deliveryOfferPersistence.decline({
   mode:'SYNTHETIC_STAGING',liveEnabled:false,...params,
  }),
 });
 // G80: the expiry oracle intentionally uses a separately authorized,
 // owner-only source. The Supabase service key CANNOT call the protected
 // mobility_stage_kyc_expiry_snapshot_owner_qa() PostgreSQL function.
 // No default role-claim, token decode or KYC approval is invented.
 const driverKycValidity=driverKycTrust===null?null:createDriverKycExpiryStatusQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,now,
  verifyAccessToken:async token=>{
   const provider=await verified(token);
   const attested=await driverKycTrust.verifyDriverSession(token);
   if(!provider||provider.id!==attested?.id||provider.is_anonymous===true||
      !(typeof provider.email_confirmed_at==='string'||
        typeof provider.phone_confirmed_at==='string'))
    throw Error('G80 IdP session identity mismatch');
   return attested;
  },
  verifySessionNotRevoked:p=>driverKycTrust.verifySessionNotRevoked(p),
  resolveExclusiveRole:id=>singleRole(admin,id),
  resolveActiveVehicle:id=>driverKycTrust.resolveActiveVehicle(id),
  queryOwnerValidity:scope=>driverKycTrust.queryOwnerValidity(scope),
  allowRequest:({actorId})=>allowRequest({userId:actorId})
 });

 // G65: assigned trip is always sourced from the same G3/G73 PostgreSQL row.
 // A provider-confirmed, revocable Driver session is REQUIRED. A Supabase
 // getUser result alone does not carry enough trust to expose this route.
 const driverTripStatus=driverKycTrust===null?null:createG65PrivateDriverTripStatusQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,now,
  verifyAccessToken:async token=>{
   const provider=await verified(token);
   const attested=await driverKycTrust.verifyDriverSession(token);
   if(!provider||provider.id!==attested?.id||provider.is_anonymous===true||
      !(typeof provider.email_confirmed_at==='string'||
        typeof provider.phone_confirmed_at==='string'))
    throw Error('G65 IdP session identity mismatch');
   return attested;
  },
  verifySessionNotRevoked:p=>driverKycTrust.verifySessionNotRevoked(p),
  resolveExclusiveRole:id=>singleRole(admin,id),
  loadAssignedTrip:p=>driverTripStatusPersistence.loadAssignedTrip(p),
  allowRequest:({actorId})=>allowRequest({userId:actorId})
 });

 // G64: immutable decision recovery requires owner-only SQL, distinct from
 // the Supabase service_role used by G4; no privileged RPC fallback exists.
 const driverDecisionRecovery=readDriverDecisionOwnerQa===null?null:
  createG64PrivateDriverDecisionReconcileQa({
   environment:'isolated_staging',localQaOnly:true,liveEnabled:false,now,
   verifyAccessToken:async token=>{
    const provider=await verified(token);
    const attested=await driverKycTrust.verifyDriverSession(token);
    if(!provider||provider.id!==attested?.id||provider.is_anonymous===true||
       !(typeof provider.email_confirmed_at==='string'||
         typeof provider.phone_confirmed_at==='string'))
     throw Error('G64 IdP session identity mismatch');
    return attested;
   },
   verifySessionNotRevoked:p=>driverKycTrust.verifySessionNotRevoked(p),
   resolveExclusiveRole:id=>singleRole(admin,id),
   allowRequest:({actorId})=>allowRequest({userId:actorId}),
   readStoredDecision:scope=>readDriverDecisionOwnerQa(scope)
  });
 // G143: never accept direct G5 /courier/deliveries/:id/accept from HTTP.
 // G10 private offer + persisted assignment is the sole acceptance path.
 // G66 custody is mounted only with independent revocable IdP + proof registry.
 const courierCustody=g66ProofTrust===null?null:(()=>{
  const verifyG66=async token=>{
   const u=await verifiedDriverOfferSession(token);
   return {id:u.id,sessionId:u.sessionId,tokenIatMs:u.tokenIatMs,
    expiresAtMs:u.expiresAtMs,is_anonymous:u.is_anonymous};
  };
  const shared={
   environment:'isolated_staging',localQaOnly:true,liveEnabled:false,now,
   verifyAccessToken:verifyG66,
   verifySessionNotRevoked:p=>driverKycTrust.verifySessionNotRevoked(p),
   resolveExclusiveRole:id=>singleRole(admin,id),
   allowRequest:({actorId})=>allowRequest({userId:actorId})
  };
  const read=createG66CourierCustodyStatusQa({...shared,
   loadAssignedDelivery:p=>courierCustodyPersistence.loadAssignedDelivery(p),
   verifyStoredProof:p=>g66ProofTrust.verifyStoredProof(p)
  });
  const write=createG66CourierCustodyTransitionQa({...shared,
   verifyIndependentProof:p=>g66ProofTrust.verifyIndependentProof(p),
   transitionDelivery:p=>deliveryPersistence.transition({
    mode:'SYNTHETIC_STAGING',liveEnabled:false,...p
   })
  });
  return input=>input.method==='GET'?read(input):write(input);
 })();
 const driverKycReadiness=createDriverKycReadinessGateway({
  projectRef:ref,verifyAccessToken:verified,
  authorizeDriver:id=>roleHas(admin,id,'driver'),allowRequest,
  currentLicenseApproved:params=>driverKycReadinessRepository.currentLicenseApproved(params)
 });
 const driverEnrollment=createDriverEnrollmentGateway({
  projectRef:ref,verifyAccessToken:verified,
  authorizeNewDriver:id=>roleHas(admin,id,'passenger'),
  allowRequest,enroll:params=>driverEnrollmentPersistence.enroll(params)
 });
 // G19: only verified metadata + version-pinned bytes + external clean scan
 // can ever unlock registration. No scanner configured by default.
 const observePrivateObject=privateEvidenceAdapters===null?
  unavailablePrivateObjectObservation:
  createVerifiedPrivateDriverEvidenceObserver(privateEvidenceAdapters);
 const driverDocuments=createDriverDocumentGateway({
  projectRef:ref,verifyAccessToken:verified,
  authorizeDriver:id=>roleHas(admin,id,'driver'),
  authorizeAdmin:id=>exclusiveAdminRole(admin,id),allowRequest,
  readStatus:params=>driverDocumentPersistence.readStatus(params),
  registerObservation:params=>driverDocumentPersistence.registerObservation(params),
  review:params=>driverDocumentPersistence.review(params),
  observePrivateObject
 });
 const driverInbox=createDriverPrivateInboxGateway({
  projectRef:ref,verifyAccessToken:verified,...guardedDriverAuth,
  authorizeDriver:id=>roleHas(admin,id,'driver'),allowRequest,now,
  listForDriver:params=>driverInboxPersistence.listForDriver(params),
 });
 const courierPoll=createCourierPrivatePollGateway({
  projectRef:ref,verifyAccessToken:verified,
  authorizeCourier:id=>roleHas(admin,id,'driver'),allowRequest,now,
  listForCourier:params=>privatePollPersistence.listForCourier(params),
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
   riderHandler:guard(rider),riderHistoryHandler:guard(riderHistory),
   offerHandler:guard(driver),
   ...(driverDecisionRecovery===null?{}:{driverDecisionRecoveryHandler:guard(driverDecisionRecovery)}),
   tripCommandHandler:guard(commands),
   f1AutoHandler:guard(f1Auto),motoHandler:guard(f1Moto),
   ...(adminF1===null?{}:{adminF1AuditHandler:guard(adminF1)}),
   ...(adminAutoTrace===null?{}:{adminServiceTraceHandler:guard(adminAutoTrace)}),
   ...(adminMotoTrace===null?{}:{adminMotoTraceHandler:guard(adminMotoTrace)}),
   ...(adminCargoTrace===null?{}:{adminCargoTraceHandler:guard(adminCargoTrace)}),
   ...(adminCommerceTrace===null?{}:{adminCommerceTraceHandler:guard(adminCommerceTrace)}),
   deliveryHandler:guard(deliveries),
   merchantHandler:guard(merchants),
   financeHandler:guard(finance),
   safetyHandler:guard(safety),
   merchantManagementHandler:guard(merchantManagement),
   deliveryOfferHandler:guard(deliveryOffers),
   ...(courierCustody===null?{}:{courierCustodyHandler:guard(courierCustody)}),
   courierPollHandler:guard(courierPoll),
   driverInboxHandler:guard(driverInbox),
   driverDocumentHandler:guard(driverDocuments),
   driverEnrollmentHandler:guard(driverEnrollment),
   driverLicenseReadinessHandler:guard(driverKycReadiness),
   ...(driverTripStatus===null?{}:{driverTripStatusHandler:guard(driverTripStatus)}),
   ...(driverKycValidity===null?{}:{driverKycValidityHandler:guard(input=>{
    const bearer=typeof input?.headers?.authorization==='string'?
     /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(input.headers.authorization)?.[1]:null;
    return driverKycValidity({bearer});
   })}),
  }),
 };
}
