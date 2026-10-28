/**
 * G134: connect the real server-only G128 Geoapify Free routing adapter to
 * G73 AUTO passenger prequote. A quote request key, NOT an existing trip, is
 * the idempotent routing identity. No production, legal coverage, traffic-live
 * or driver allocation may be inferred from a road response.
 *
 * The caller MUST inject independent, server-side address/geofence evidence,
 * a toll authority and a durable atomic G130 Free quota repository.
 */
import {createHmac} from 'node:crypto';
import {createG128GeoapifyCargoRoadResolver}
 from './g128-geoapify-cargo-road-resolver.mjs';

const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const NAME=x=>typeof x==='string'&&x===x.trim()&&x.length>=3&&
 x.length<=120&&!/[\u0000-\u001f]/.test(x);
const SERVICE=new Set(['economico','confort','xl']);
const validTime=x=>Number.isSafeInteger(x)&&x>=1000000000000&&x<=9000000000000;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function tag(secret,actor,address){
 const digest=createHmac('sha256',secret).update('G134_V1\u0000')
  .update(actor).update('\u0000').update(address).digest('hex').slice(0,32);
 return 'LOC_'+Array.from(digest,h=>
  String.fromCharCode(65+parseInt(h,16))).join('');
}
export function createG134GeoapifyAutoRouteResolver({
 freePlanApproved=false,apiKey,tagSecret,resolveCoveredAutoCoordinates,
 verifyAutoTolls,reserveFreeQuota,request=fetch,now=Date.now
}={}){
 if(freePlanApproved!==true)throw Error('G134 Free Geoapify authority not approved');
 if(typeof tagSecret!=='string'||tagSecret.length<32||
  [resolveCoveredAutoCoordinates,verifyAutoTolls,reserveFreeQuota,
   request,now].some(fn=>typeof fn!=='function'))
  throw Error('G134 independent coverage/tolls/quota authority required');
 // G128 also validates server-only key and prohibits a billable fallback.
 const mapRoad=createG128GeoapifyCargoRoadResolver({
  freePlanApproved,apiKey,request,now,
  resolveCoveredCargoCoordinates:async scope=>{
   const key=scope.deliveryId;
   const requestScope=pending.get(key);
   if(!requestScope||scope.actorId!==requestScope.actorId||
    scope.vehicleKind!=='AUTO'||scope.pickupTag!==requestScope.originTag||
    scope.deliveryTag!==requestScope.destinationTag)
    throw Error('G134 unbound route coverage');
   const covered=await resolveCoveredAutoCoordinates(Object.freeze({
    actorId:requestScope.actorId,quoteRequestKey:key,
    origin:requestScope.origin,destination:requestScope.destination,
    service:requestScope.service
   }));
   if(!obj(covered)||covered.source!=='INDEPENDENT_COVERAGE_AUTHORITY'||
    covered.coverageVerified!==true||
    covered.actorId!==requestScope.actorId||
    covered.quoteRequestKey!==key||
    covered.originAddress!==requestScope.origin||
    covered.destinationAddress!==requestScope.destination||
    covered.service!==requestScope.service||
    !validTime(covered.verifiedAtMs)||covered.verifiedAtMs>now())
    throw Error('G134 independently verified addresses unavailable');
   return Object.freeze({
    source:covered.source,coverageVerified:true,actorId:scope.actorId,
    deliveryId:key,vehicleKind:'AUTO',pickupTag:scope.pickupTag,
    deliveryTag:scope.deliveryTag,evidenceId:covered.evidenceId,
    revision:covered.revision,zoneTag:covered.zoneTag,
    origin:covered.originCoordinates,
    destination:covered.destinationCoordinates,
    verifiedAtMs:covered.verifiedAtMs
   });
  },
  reserveFreeQuota:scope=>reserveFreeQuota(Object.freeze({
   ...scope,quoteRequestKey:scope.deliveryId,serviceKind:'AUTO_RIDE'
  })),
  verifyCargoTolls:async scope=>{
   const key=scope.deliveryId,original=pending.get(key);
   if(!original)throw Error('G134 toll scope disappeared');
   const proof=await verifyAutoTolls(Object.freeze({
    actorId:original.actorId,quoteRequestKey:key,
    origin:original.origin,destination:original.destination,
    service:original.service,coverageEvidenceId:scope.coverageEvidenceId,
    zoneTag:scope.zoneTag,originCoordinates:scope.origin,
    destinationCoordinates:scope.destination,
    distanceMeters:scope.distanceMeters,
    durationSeconds:scope.durationSeconds,routeHasTolls:scope.routeHasTolls
   }));
   if(!obj(proof)||proof.quoteRequestKey!==key||
    proof.actorId!==original.actorId||
    proof.source!=='INDEPENDENT_TOLL_AUTHORITY'||
    proof.tollsVerified!==true)
    throw Error('G134 independently verified tolls unavailable');
   return Object.freeze({
    source:proof.source,tollsVerified:true,deliveryId:key,
    vehicleKind:'AUTO',coverageEvidenceId:scope.coverageEvidenceId,
    distanceMeters:scope.distanceMeters,
    durationSeconds:scope.durationSeconds,tollsPyg:proof.tollsPyg,
    evidenceId:proof.evidenceId,verifiedAtMs:proof.verifiedAtMs
   });
  }
 });
 // Scoped only during the awaited server-side route call; never retain
 // plaintext user addresses once the provider/toll resolution finishes.
 const pending=new Map();
 return async({actorId,quoteRequestKey,origin,destination,service}={})=>{
  if(!UUID.test(actorId??'')||!UUID.test(quoteRequestKey??'')||
   !NAME(origin)||!NAME(destination)||
   origin.toLocaleLowerCase('es-PY')===destination.toLocaleLowerCase('es-PY')||
   !SERVICE.has(service)||pending.has(quoteRequestKey))
   throw Error('G134 invalid or concurrent quote route request');
  const originTag=tag(tagSecret,actorId,origin);
  const destinationTag=tag(tagSecret,actorId,destination);
  if(originTag===destinationTag)throw Error('G134 address identity collision');
  pending.set(quoteRequestKey,{actorId,origin,destination,service,
   originTag,destinationTag});
  try{
   const road=await mapRoad({actorId,deliveryId:quoteRequestKey,
    vehicleKind:'AUTO',pickupTag:originTag,deliveryTag:destinationTag});
   if(road.routingVerified!==true||road.coverageVerified!==true||
    road.tollsVerified!==true||road.liveTraffic!==false)
    throw Error('G134 route authority incomplete');
   return Object.freeze({
    routingVerified:true,coverageVerified:true,trafficAware:true,
    fallbackUsed:false,originTag,destinationTag,zoneTag:road.zoneTag,
    distanceMeters:road.distanceMeters,
    durationSeconds:road.durationSeconds,tollsPyg:road.tollsPyg
   });
  }finally{pending.delete(quoteRequestKey);}
 };
}
