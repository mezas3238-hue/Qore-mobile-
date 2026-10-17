/**
 * QORE Radar G4 — passenger-facing, JWT-bound status/arrival API contract.
 * Staging only / adapter-injected / NO DEPLOYMENT / no synthetic live location.
 * Requires a server-side authoritative trip read and independently verified
 * driver/profile/GPS/traffic routing to show real distances and ETA.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
import {buildQoreArrivalSnapshot} from './g4-qore-radar-core.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH=/^\/v1\/staging\/rider\/trips\/([0-9a-f-]{36})\/status$/i;
const STATUS=new Set(['searching','accepted','arriving','in_progress','completed','cancelled']);
const RESP=(status,body)=>({status,body});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const verified=u=>plain(u)&&UUID.test(u.id??'')&&u.is_anonymous!==true&&
 (typeof u.email_confirmed_at==='string'||typeof u.phone_confirmed_at==='string');
const token=headers=>{
 const auth=headers?.authorization??headers?.Authorization;
 return typeof auth==='string'&&auth.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(auth)?.[1]??null:null;
};
const safeTrip=(trip,id,passenger)=>plain(trip)&&trip.id===id&&
 trip.passengerId===passenger&&STATUS.has(trip.status)&&
 Number.isSafeInteger(trip.revision)&&trip.revision>0&&
 Number.isSafeInteger(trip.trackingSequence)&&trip.trackingSequence>=0&&
 // No driver can be associated while still searching.
 (trip.status!=='searching'||(trip.driverId===null&&trip.vehicleId===null))&&
 (['searching','cancelled'].includes(trip.status)||
   (UUID.test(trip.driverId??'')&&UUID.test(trip.vehicleId??'')));
/**
 * Polling contract. Postgres and Realtime adapters must use the SAME policy:
 * getUser(jwt), SQL filter by trip ID and passenger ID, then server-owned
 * snapshots; never trust a client-carried passengerId or event 'source'.
 */
export function createQoreRiderStatusGateway({
 projectRef,verifyAccessToken,authorizePassenger,loadOwnTrip,
 loadArrivalEvidence,allowRequest,now=Date.now
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizePassenger,loadOwnTrip,
   loadArrivalEvidence,allowRequest,now].every(x=>typeof x==='function'))
  throw new Error('Rider server-side authentication and evidence adapters are mandatory');
 return async({method,path,headers,body})=>{
  const found=typeof path==='string'?PATH.exec(path):null;
  if(method!=='GET'||!found||!UUID.test(found[1]))return RESP(404,{error:'Not found'});
  if(body!==undefined&&body!==null)return RESP(400,{error:'GET cannot contain a body'});
  const bearer=token(headers);
  if(!bearer)return RESP(401,{error:'Verified passenger session required'});
  let user;
  try{user=await verifyAccessToken(bearer);}catch{return RESP(401,{error:'Session unavailable'});}
  if(!verified(user))return RESP(401,{error:'Confirmed passenger account required'});
  let role;
  try{role=await authorizePassenger(user.id);}catch{
   return RESP(503,{error:'Passenger role lookup unavailable'});
  }
  if(role!==true)return RESP(403,{error:'Passenger account required'});
  try{
   if(allowRequest({userId:user.id,operation:'rider_status'})!==true)
    return RESP(429,{error:'Status polling limit exceeded'});
  }catch{return RESP(503,{error:'Status limiter unavailable'});}
  const timestamp=now();
  if(!Number.isSafeInteger(timestamp)||timestamp<0)
   return RESP(503,{error:'Server clock invalid'});
  let trip;
  try{trip=await loadOwnTrip({tripId:found[1],passengerId:user.id});}
  catch{return RESP(503,{error:'Trip status temporarily unavailable'});}
  if(!safeTrip(trip,found[1],user.id))
   return RESP(404,{error:'Trip not found'});
  const base={
   source:'server',tripId:trip.id,passengerId:user.id,
   serverRevision:trip.revision,trackingSequence:trip.trackingSequence,
  };
  if(['searching','cancelled','completed'].includes(trip.status)){
   return RESP(200,{mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
    event:{...base,status:trip.status,acceptedDriver:null,tracking:null},
    locationVisible:false,deliveryConfirmed:false});
  }
  // Every verified trip participant is already assigned to exactly one driver.
  // Request GPS ONLY while en route to the pickup, never after pickup.
  let evidence;
  try{
   evidence=await loadArrivalEvidence({
    tripId:trip.id,passengerId:user.id,driverId:trip.driverId,
    vehicleId:trip.vehicleId,includeLocation:trip.status==='accepted'
   });
  }catch{return RESP(503,{error:'Verified driver evidence temporarily unavailable'});}
  if(!plain(evidence)||!plain(evidence.driverProfile)||
     evidence.driverProfile.driverId!==trip.driverId||
     evidence.driverProfile.vehicleId!==trip.vehicleId)
   return RESP(503,{error:'Verified driver evidence unavailable'});
  const arrival=buildQoreArrivalSnapshot({
   tripId:trip.id,passengerId:user.id,requesterId:user.id,
   tripStatus:trip.status,assignedDriverId:trip.driverId,
   driverProfile:evidence.driverProfile,
   location:trip.status==='accepted'?evidence.location:null,
   route:trip.status==='accepted'?evidence.route:null,
   nowMs:timestamp,revision:trip.revision
  });
  if(arrival.ok!==true)
   return RESP(503,{error:'Verified driver evidence unavailable'});
  const profile=arrival.driver;
  if(!profile)return RESP(503,{error:'Verified driver identity unavailable'});
  const {name,vehicleKind,model,color,plate,rating}=profile;
  const event={...base,
   status:trip.status==='arriving'?'at_pickup':trip.status,
   acceptedDriver:{name,vehicleKind,model,color,plate,rating},
   tracking:arrival.trackingAvailable===true?{
    lat:arrival.location.lat,lng:arrival.location.lng,
    roadMeters:arrival.roadMeters,etaSeconds:arrival.etaSeconds,
    locationUpdatedAtMs:arrival.updatedAtMs,
    routeUpdatedAtMs:evidence.route.calculatedAtMs,
    trafficAware:true,fallbackUsed:false,
   }:null,
  };
  return RESP(200,{mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
   event,locationVisible:arrival.trackingAvailable===true,
   deliveryConfirmed:false});
 };
}
