/**
 * QORE Radar G4 — SERVER CONTRACT ONLY / STAGING / NOT DEPLOYED.
 * No actual driver search, push, routing provider or location stream connected.
 * Caller must verify requester Auth, fetch GPS/consent from trusted DB, and
 * provide authoritative paid-passenger compliance and routing adapters.
 * DO NOT import this file into Expo or turn on commercial rides.
 */
export const G4_LIVE_TRIPS_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(['economico','confort','xl']);
const asObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const n=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
const safeInt=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const coord=p=>asObj(p)&&n(p.lat,-90,90)&&n(p.lng,-180,180);
const fail=message=>({ok:false,reason:message,commercialRidesEnabled:false});
const validClock=clock=>Number.isSafeInteger(clock)&&clock>=0;
const ownUuid=id=>typeof id==='string'&&UUID.test(id);
const noLive=Object.freeze({commercialRidesEnabled:false,mode:'STAGING_RESEARCH_ONLY'});

/** GPS is location supplied by a consented and authenticated driver session,
 * with 30 s freshness and <=75 m reported accuracy. Not sufficient eligibility. */
export function freshVerifiedLocation(location,atMs){
 if(!asObj(location)||!validClock(atMs)||!coord(location)||
    location.consentGranted!==true||location.available!==true||
    !safeInt(location.capturedAtMs,0,atMs+10_000)||
    location.capturedAtMs>atMs+10_000||
    atMs-location.capturedAtMs>30_000||
    !n(location.accuracyMeters,0,75))return false;
 return true;
}
function validRouting(route,driverId,atMs){
 // Never use straight-line distances or traffic-unaware routes for rider ETA.
 return asObj(route)&&route.driverId===driverId&&
  route.provider==='VERIFIED_ROAD_ROUTER'&&route.trafficAware===true&&
  route.fallbackUsed===false&&
  safeInt(route.calculatedAtMs,0,atMs)&&atMs-route.calculatedAtMs<=20_000&&
  safeInt(route.roadMeters,0,250_000)&&
  safeInt(route.etaSeconds,0,21_600);
}
const candidateValid=(c,atMs)=>asObj(c)&&ownUuid(c.driverId)&&
  ownUuid(c.vehicleId)&&c.kind==='AUTO'&&
  freshVerifiedLocation(c.location,atMs)&&
  safeInt(c.idleSeconds,0,86400);

/**
 * Internal candidate discovery. NO identity, GPS or ETA leaked to requester:
 * only an authenticated dispatcher receives ranked private driver IDs.
 * checkCompliance must call independent server-side SQL preflight per candidate.
 * calculateRoutes must invoke trusted traffic-aware ROAD routing; never user GPS.
 */
export async function discoverQoreDrivers({
 service,pickup,nowMs,candidates,checkCompliance,calculateRoutes,
 maxOffers=5,
}){
 if(!kinds.has(service)||!coord(pickup)||!validClock(nowMs)||
  !Array.isArray(candidates)||candidates.length>300||
  typeof checkCompliance!=='function'||typeof calculateRoutes!=='function'||
  !safeInt(maxOffers,1,5))return fail('Discovery inputs/provider invalid');
 const eligible=[];
 const seen=new Set();
 try {
  for(const c of candidates){
   if(!candidateValid(c,nowMs)||seen.has(c.driverId))continue;
   seen.add(c.driverId);
   // A prior "approved" flag on the mobile device is NEVER trusted.
   if(await checkCompliance({driverId:c.driverId,vehicleId:c.vehicleId,service})!==true)continue;
   eligible.push(c);
  }
  if(!eligible.length)return {ok:true,offers:[],...noLive};
  const matrix=await calculateRoutes({
   origins:eligible.map(c=>({driverId:c.driverId,lat:c.location.lat,lng:c.location.lng})),
   destination:{lat:pickup.lat,lng:pickup.lng},
   service,trafficAware:true
  });
  if(!Array.isArray(matrix)||matrix.length>eligible.length*2)return fail('Routing service unavailable');
  const routes=new Map();
  for(const route of matrix){
   if(!ownUuid(route?.driverId)||routes.has(route.driverId))return fail('Ambiguous route matrix');
   routes.set(route.driverId,route);
  }
  const ranked=[];
  for(const c of eligible){
   const route=routes.get(c.driverId);
   if(!validRouting(route,c.driverId,nowMs))continue;
   // Fairness is bounded (<= 90 sec) and never overcomes missing proof.
   const fairnessBonus=Math.min(90,Math.floor(c.idleSeconds/120));
   ranked.push({
    driverId:c.driverId,vehicleId:c.vehicleId,
    roadMeters:route.roadMeters,etaSeconds:route.etaSeconds,
    fairnessBonusSeconds:fairnessBonus,
    internalRank:route.etaSeconds-fairnessBonus,
   });
  }
  ranked.sort((a,b)=>a.internalRank-b.internalRank||
    a.etaSeconds-b.etaSeconds||a.driverId.localeCompare(b.driverId));
  return {
   ok:true,...noLive,
   offers:ranked.slice(0,maxOffers).map(c=>({
    driverId:c.driverId,vehicleId:c.vehicleId,
    routeDistanceMeters:c.roadMeters,routeEtaSeconds:c.etaSeconds
   })),
  };
 }catch{return fail('Verified driver search unavailable');}
}

/** Push is only a wake-up hint; after tap the app MUST refetch an expiring offer
 * with Supabase verified Auth. Never include addresses, passenger info, or GPS. */
export function makePrivateDriverPush({rideId,offerId,driverId,expiresAtMs,nowMs}){
 if(!ownUuid(rideId)||!ownUuid(offerId)||!ownUuid(driverId)||
  !safeInt(nowMs,0,Number.MAX_SAFE_INTEGER)||
  !safeInt(expiresAtMs,nowMs+1_000,nowMs+30_000))
  return fail('Invalid private driver offer');
 return {
  ok:true,...noLive,
  recipientDriverId:driverId,
  message:{
   title:'QORE · Nueva solicitud',
   body:'Hay una propuesta de viaje. Abrí QORE para ver detalles y decidir.',
   data:{kind:'QORE_STAGING_OFFER',offerId,rideId},
  },
  expiresAtMs,
 };
}

/**
 * Rider-facing snapshot, generated SERVER SIDE *only for the accepted driver*.
 * The caller must enforce that requesting Auth subject owns this trip.
 * A marker and minute count are included only while trusted fresh GPS AND
 * non-fallback road routing are available. Nothing is invented from Haversine.
 */
export function buildQoreArrivalSnapshot({
 tripId,passengerId,requesterId,tripStatus,assignedDriverId,
 driverProfile,location,route,nowMs,revision
}){
 if(!ownUuid(tripId)||!ownUuid(passengerId)||requesterId!==passengerId||
  !safeInt(nowMs,0,Number.MAX_SAFE_INTEGER)||!safeInt(revision,1,1_000_000_000))
  return fail('Passenger authorization missing');
 if(!['accepted','arriving','in_progress','completed','cancelled'].includes(tripStatus)||
  !ownUuid(assignedDriverId)||!asObj(driverProfile)||
  driverProfile.driverId!==assignedDriverId||
  driverProfile.verifiedForDisplay!==true||
  driverProfile.vehicleKind!=='AUTO'|| // G4 commercial MOTO gate remains CLOSED
  typeof driverProfile.displayName!=='string'||driverProfile.displayName.trim().length<2||
  driverProfile.displayName.length>70||
  typeof driverProfile.vehicleModel!=='string'||driverProfile.vehicleModel.length<2||
  driverProfile.vehicleModel.length>90||
  typeof driverProfile.plate!=='string'||!(/^[A-Z0-9-]{4,12}$/.test(driverProfile.plate))||
  !n(driverProfile.rating,0,5))
  return fail('Verified driver profile not ready');
 if(tripStatus==='completed'||tripStatus==='cancelled')
  return {ok:true,...noLive,revision,tripId,tripStatus,
    trackingAvailable:false,driver:null,location:null,roadMeters:null,
    etaSeconds:null,updatedAtMs:null,etaSource:null,
    message:'Viaje terminado: el seguimiento se ha desactivado.'};
 // Do not disclose live tracking unless trip is accepted, nor after pickup.
 const arrivalAllowed=tripStatus==='accepted';
 const driver={
  name:driverProfile.displayName,
  vehicleKind:driverProfile.vehicleKind,
  model:driverProfile.vehicleModel,
  color:typeof driverProfile.color==='string'?driverProfile.color.slice(0,30):'',
  plate:driverProfile.plate,
  rating:driverProfile.rating,
  photoUrl:null, // photo served later by short-lived authorization, not raw URLs
 };
 if(!arrivalAllowed)return {
  ok:true,...noLive,revision,tripId,tripStatus,
  trackingAvailable:false,driver,location:null,roadMeters:null,
  etaSeconds:null,updatedAtMs:null,etaSource:null,
  message:'Pasajero abordado: seguimiento de llegada cerrado.'
 };
 const valid=freshVerifiedLocation(location,nowMs)&&
  validRouting(route,assignedDriverId,nowMs);
 if(!valid)return {
  ok:true,...noLive,revision,tripId,tripStatus,
  trackingAvailable:false,driver,location:null,roadMeters:null,
  etaSeconds:null,updatedAtMs:null,etaSource:null,
  message:'Actualizando ubicación y ruta; tiempo de espera temporalmente no disponible.'
 };
 return {
  ok:true,...noLive,revision,tripId,tripStatus,
  trackingAvailable:true,driver,
  location:{lat:location.lat,lng:location.lng},
  roadMeters:route.roadMeters,
  etaSeconds:route.etaSeconds,
  updatedAtMs:location.capturedAtMs,
  etaSource:'VERIFIED_ROAD_ROUTER_TRAFFIC_AWARE',
  message:'Conductor de camino al punto de recogida.'
 };
}
