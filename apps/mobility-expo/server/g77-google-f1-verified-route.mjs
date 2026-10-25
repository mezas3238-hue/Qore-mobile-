/**
 * G77 F1 — server-only Google Geocoding v4 + Routes v2 route authority.
 * NOT mounted by default. Maps API billing needs explicit Owner approval;
 * a geocoded point is NEVER evidence of service-zone permission or tolls.
 * G73 consumes the strictly checked output as verifiedAutoRoute().
 * No GPS/user address, key or placeId is logged or exposed to Passenger DTO.
 */
import {createHmac} from 'node:crypto';

const GEOCODE='https://geocode.googleapis.com/v4/geocode/address/';
const ROUTES='https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELDS='routes.distanceMeters,routes.duration,fallbackInfo';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SERVICES=new Set(['economico','confort','xl']);
const TAG=/^[A-Z_]{3,40}$/;
const ADDRESS=x=>typeof x==='string'&&x.trim()===x
 &&x.length>=3&&x.length<=120&&!/[\u0000-\u001f\u007f]/.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const pos=x=>Number.isFinite(x?.latitude)&&Number.isFinite(x?.longitude)
 &&x.latitude>=-28.5&&x.latitude<=-19
 &&x.longitude>=-63.5&&x.longitude<=-53.5;
const place=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{12,160}$/.test(x);
const safe=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const duration=x=>{
 if(typeof x!=='string'||!/^\d+(?:\.\d{1,9})?s$/.test(x))return null;
 const number=Math.ceil(Number(x.slice(0,-1)));
 return safe(number,1,86400)?number:null;
};
function privateTag(secret,placeId){
 const h=createHmac('sha256',secret).update('QORE_G77_PLACE_V1\u0000')
  .update(placeId,'utf8').digest('hex').slice(0,32);
 return 'LOC_'+[...h].map(hex=>String.fromCharCode(65+parseInt(hex,16))).join('');
}
async function json(request,url,init){
 const response=await request(url,{
  redirect:'error',credentials:'omit',cache:'no-store',
  referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000),...init
 });
 if(!response?.ok||response.redirected===true
  ||!/^application\/json(?:\s*;|$)/i.test(response.headers?.get?.('content-type')??''))
  throw Error('G77 provider unavailable');
 const size=response.headers?.get?.('content-length');
 if(size!==null&&size!==undefined&&(!/^\d+$/.test(size)||Number(size)>32768))
  throw Error('G77 provider response too large');
 const text=await response.text();
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>32768)
  throw Error('G77 provider response too large');
 const parsed=JSON.parse(text);
 if(!obj(parsed))throw Error('G77 invalid provider data');
 return parsed;
}
export function createG77GoogleF1VerifiedRoute({
 enabled=false,billingApproved=false,apiKey,tagSecret,
 authorizeCoverage,verifyTolls,request=fetch,now=Date.now
}={}){
 // Both billing and runtime opt-ins required; absence is a hard rejection.
 if(enabled!==true||billingApproved!==true||
  typeof apiKey!=='string'||apiKey.trim().length<20||
  typeof tagSecret!=='string'||tagSecret.length<32||
  typeof authorizeCoverage!=='function'||typeof verifyTolls!=='function'||
  typeof request!=='function'||typeof now!=='function')
  throw Error('G77 certified paid provider, zone/toll authorities and secrets required');
 async function geocode(address){
  const data=await json(request,GEOCODE+encodeURIComponent(address)
   +'?regionCode=PY&languageCode=es',{
    method:'GET',headers:{'X-Goog-Api-Key':apiKey,Accept:'application/json'}
   });
  if(!Array.isArray(data.results)||data.results.length!==1)
   throw Error('G77 ambiguous address');
  const item=data.results[0];
  if(!obj(item)||item.postalAddress?.regionCode!=='PY'
   ||!['ROOFTOP','RANGE_INTERPOLATED'].includes(item.granularity)
   ||!place(item.placeId)||!pos(item.location))
   throw Error('G77 precise Paraguayan geocode unavailable');
  return Object.freeze({
   placeId:item.placeId,
   latitude:item.location.latitude,longitude:item.location.longitude
  });
 }
 return async function resolveVerifiedRoute({
  actorId,origin,destination,service
 }={}){
  if(typeof actorId!=='string'||!UUID.test(actorId)||
   !ADDRESS(origin)||!ADDRESS(destination)||
   origin.toLocaleLowerCase()===destination.toLocaleLowerCase()||
   !SERVICES.has(service))throw Error('G77 invalid Passenger route intent');
  const start=now();
  if(!safe(start,1,Number.MAX_SAFE_INTEGER))
   throw Error('G77 server clock unavailable');
  // Geocode each human-readable address independently; no client coordinates.
  const [from,to]=await Promise.all([geocode(origin),geocode(destination)]);
  if(from.placeId===to.placeId)throw Error('G77 identical resolved points');
  const provider=await json(request,ROUTES,{
   method:'POST',
   headers:{'X-Goog-Api-Key':apiKey,'Content-Type':'application/json',
    'X-Goog-FieldMask':FIELDS,Accept:'application/json'},
   body:JSON.stringify({
    origin:{placeId:from.placeId},destination:{placeId:to.placeId},
    travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE',
    computeAlternativeRoutes:false,regionCode:'py'
   })
  });
  if(provider.fallbackInfo!==undefined||
   !Array.isArray(provider.routes)||provider.routes.length!==1)
   throw Error('G77 no trustworthy traffic route');
  const road=provider.routes[0],seconds=duration(road?.duration);
  if(!obj(road)||road.fallbackInfo!==undefined||
   !safe(road.distanceMeters,100,500000)||seconds===null)
   throw Error('G77 unavailable route metrics');
  // Geocoding and traffic routing DO NOT certify geofenced service coverage.
  // The injected authority must verify BOTH points and the service revision.
  const coverage=await authorizeCoverage({
   actorId,from,to,service,distanceMeters:road.distanceMeters,
   durationSeconds:seconds
  });
  if(!obj(coverage)||coverage.verified!==true||
   coverage.approved!==true||coverage.country!=='PY'||
   coverage.service!==service||!TAG.test(coverage.zoneTag)||
   coverage.originPlaceId!==from.placeId||
   coverage.destinationPlaceId!==to.placeId||
   !safe(coverage.revision,1,Number.MAX_SAFE_INTEGER))
   throw Error('G77 current service coverage not independently certified');
  // No silent zero. The toll source must independently attest the exact
  // route+zone, including zero only when the source authoritatively says zero.
  const toll=await verifyTolls({
   actorId,originPlaceId:from.placeId,
   destinationPlaceId:to.placeId,zoneTag:coverage.zoneTag,
   distanceMeters:road.distanceMeters,durationSeconds:seconds
  });
  if(!obj(toll)||toll.verified!==true||
   toll.originPlaceId!==from.placeId||
   toll.destinationPlaceId!==to.placeId||
   toll.zoneTag!==coverage.zoneTag||
   toll.distanceMeters!==road.distanceMeters||
   !safe(toll.tollsPyg,0,1000000))
   throw Error('G77 toll amount not independently certified');
  const completedAt=now();
  if(!safe(completedAt,start,start+15000))
   throw Error('G77 stale route evidence');
  const originTag=privateTag(tagSecret,from.placeId);
  const destinationTag=privateTag(tagSecret,to.placeId);
  if(originTag===destinationTag)throw Error('G77 tag collision');
  // Exact G73 contract; coordinates, addresses and private place IDs are
  // intentionally NOT returned, while SQL receives opaque keyed tags.
  return Object.freeze({
   routingVerified:true,coverageVerified:true,trafficAware:true,
   fallbackUsed:false,originTag,destinationTag,
   zoneTag:coverage.zoneTag,distanceMeters:road.distanceMeters,
   durationSeconds:seconds,tollsPyg:toll.tollsPyg
  });
 };
}
