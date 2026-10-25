/**
 * G77 / F1 -- Google Routes v2 server-only AUTO route resolver.
 * Opt-in only AFTER explicit owner approval of billable API use. The function
 * MUST be injected as verifiedAutoRoute into local QA runtime; never auto-on.
 * It cannot establish QORE coverage/availability or tolls by itself.
 *
 * No secrets in source, no commercial pricing, no LIVE, no reverse geocoding
 * of arbitrary addresses. Independently proven Place IDs, zonal eligibility,
 * and road-specific toll facts are required before G73 can persist a route.
 */
import {createHmac} from 'node:crypto';

const ENDPOINT='https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELD_MASK='routes.distanceMeters,routes.duration,fallbackInfo';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PLACE=/^[A-Za-z0-9_-]{12,180}$/;
const TAG=/^[A-Z_]{3,40}$/;
const HUMAN=x=>typeof x==='string'&&x.length>=3&&x.length<=120&&x===x.trim()&&
 !/[\u0000-\u001f]/.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi;
const SERVICES=new Set(['economico','confort','xl']);
const privateTag=(secret,placeId)=>{
 const digest=createHmac('sha256',secret).update('QORE_G77_PLACE_V1\u0000')
  .update(placeId,'utf8').digest('hex').slice(0,32);
 return 'LOC_'+[...digest].map(h=>String.fromCharCode(65+parseInt(h,16))).join('');
};
const validEpoch=x=>integer(x,0,9e15);
const durationSeconds=x=>{
 if(typeof x!=='string'||!/^\d+(?:\.\d{1,9})?s$/.test(x))return null;
 const value=Math.ceil(Number(x.slice(0,-1)));
 return integer(value,1,86400)?value:null;
};
function validateCoverage(p,ctx,at){
 return obj(p)&&p.source==='INDEPENDENT_COVERAGE_AUTHORITY'&&
 p.coverageVerified===true&&p.actorId===ctx.actorId&&
 p.origin===ctx.origin&&p.destination===ctx.destination&&
 p.service===ctx.service&&UUID.test(p.evidenceId??'')&&
 integer(p.revision,1,Number.MAX_SAFE_INTEGER)&&validEpoch(p.verifiedAtMs)&&
 p.verifiedAtMs<=at&&at-p.verifiedAtMs<=60000&&
 PLACE.test(p.originPlaceId??'')&&PLACE.test(p.destinationPlaceId??'')&&
 p.originPlaceId!==p.destinationPlaceId&&
 TAG.test(p.originTag??'')&&TAG.test(p.destinationTag??'')&&
 p.originTag!==p.destinationTag&&TAG.test(p.zoneTag??'');
}
function validateCharges(p,ctx,at){
 return obj(p)&&p.source==='INDEPENDENT_TOLL_AUTHORITY'&&
 p.tollsVerified===true&&p.coverageEvidenceId===ctx.coverage.evidenceId&&
 p.originPlaceId===ctx.coverage.originPlaceId&&
 p.destinationPlaceId===ctx.coverage.destinationPlaceId&&
 p.distanceMeters===ctx.distanceMeters&&p.durationSeconds===ctx.durationSeconds&&
 UUID.test(p.evidenceId??'')&&validEpoch(p.verifiedAtMs)&&
 p.verifiedAtMs<=at&&at-p.verifiedAtMs<=60000&&
 integer(p.tollsPyg,0,1000000);
}
/** Bounded text input even when a stub has no readable stream. */
async function boundedJson(reply,maxBytes=8192){
 if(!/^application\/json(?:\s*;|$)/i.test(reply.headers?.get?.('content-type')??''))
  throw Error('Invalid routing response MIME');
 const length=reply.headers?.get?.('content-length');
 if(length!==null&&length!==undefined&&(!/^\d+$/.test(length)||
    Number(length)>maxBytes))throw Error('Routing response too large');
 let value;
 if(reply.body&&typeof reply.body.getReader==='function'){
  const reader=reply.body.getReader();
  const chunks=[];let bytes=0;
  try{
   while(true){
    const part=await reader.read();
    if(part.done)break;
    if(!(part.value instanceof Uint8Array))throw Error('Invalid routing stream');
    bytes+=part.value.byteLength;
    if(bytes>maxBytes)throw Error('Routing response too large');
    chunks.push(part.value);
   }
  }finally{reader.releaseLock();}
  value=Buffer.concat(chunks).toString('utf8');
 }else{
  if(typeof reply.text!=='function')throw Error('Routing response unavailable');
  value=await reply.text();
  if(typeof value!=='string'||Buffer.byteLength(value)>maxBytes)
   throw Error('Routing response too large');
 }
 try{return JSON.parse(value);}catch{throw Error('Unparseable routing result');}
}
export function createG77VerifiedAutoRouteResolver({
 apiKey,tagSecret,billableProviderApproved=false,resolveCoveredPlaces,
 verifyRouteTolls,request=fetch,now=Date.now
}={}){
 if(billableProviderApproved!==true)throw Error('G77 paid Routes API not approved');
 if(typeof tagSecret!=='string'||tagSecret.length<32||
  typeof apiKey!=='string'||apiKey.length<20||apiKey.length>300||
  /\s/.test(apiKey)||typeof request!=='function'||
  typeof resolveCoveredPlaces!=='function'||typeof verifyRouteTolls!=='function'||
  typeof now!=='function')
  throw Error('G77 requires private API credentials and independent zone/toll authorities');
 return async ({actorId,origin,destination,service}={})=>{
  if(typeof actorId!=='string'||!UUID.test(actorId)||
   !HUMAN(origin)||!HUMAN(destination)||
   origin.toLowerCase()===destination.toLowerCase()||
   !SERVICES.has(service))
   throw Error('Invalid G77 trusted route request');
  const at=now();
  if(!validEpoch(at))throw Error('Invalid G77 clock');
  // Verify zone/service eligibility for BOTH specific places BEFORE any
  // billable routing call; this is not a driver availability assertion.
  const ctx=Object.freeze({actorId,origin,destination,service});
  const coverage=await resolveCoveredPlaces(ctx);
  const beforeBillable=now();
  if(!validEpoch(beforeBillable)||beforeBillable<at||
   beforeBillable-at>30000||
   coverage?.verifiedAtMs>beforeBillable||
   beforeBillable-coverage?.verifiedAtMs>60000)
   throw Error('Stale route coverage before billable provider');
  if(!validateCoverage(coverage,ctx,beforeBillable))
   throw Error('No independently verified route coverage');
  const body={
   origin:{placeId:coverage.originPlaceId},
   destination:{placeId:coverage.destinationPlaceId},
   travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE',
   computeAlternativeRoutes:false,regionCode:'py',units:'METRIC',
   routeModifiers:{avoidTolls:false,avoidHighways:false,avoidFerries:false}
  };
  let reply;
  try{
   reply=await request(ENDPOINT,{
    method:'POST',redirect:'error',credentials:'omit',
    headers:{'content-type':'application/json','X-Goog-Api-Key':apiKey,
     'X-Goog-FieldMask':FIELD_MASK},
    body:JSON.stringify(body),signal:AbortSignal.timeout(8000)
   });
  }catch{throw Error('Traffic-aware road provider unavailable');}
  if(!reply||reply.ok!==true||reply.status!==200||reply.redirected===true)
   throw Error('Traffic-aware road provider unavailable');
  const payload=await boundedJson(reply);
  if(!obj(payload)||Object.hasOwn(payload,'fallbackInfo')&&payload.fallbackInfo!=null||
   !Array.isArray(payload.routes)||payload.routes.length!==1)
   throw Error('No unique non-fallback road route');
  const route=payload.routes[0];
  if(!obj(route)||!integer(route.distanceMeters,1,500000))
   throw Error('No valid trusted road distance');
  const seconds=durationSeconds(route.duration);
  if(seconds===null)throw Error('No valid traffic-aware road duration');
  const atCharges=now();
  if(!validEpoch(atCharges)||atCharges<beforeBillable||atCharges-beforeBillable>30000)
   throw Error('Road or zone evidence too old');
  // Google Routes does not by itself supply an independently approved QORE
  // toll value; reject guesses even if value is zero.
  const tollScope=Object.freeze({coverage:Object.freeze({...coverage}),
   distanceMeters:route.distanceMeters,durationSeconds:seconds});
  const charges=await verifyRouteTolls(tollScope);
  const afterTolls=now();
  if(!validEpoch(afterTolls)||afterTolls<atCharges||
   afterTolls-atCharges>30000||afterTolls-beforeBillable>60000)
   throw Error('Toll verification too old');
  if(!validateCharges(charges,tollScope,afterTolls))
   throw Error('Tolls cannot be independently verified');
  const originTag=privateTag(tagSecret,coverage.originPlaceId),
   destinationTag=privateTag(tagSecret,coverage.destinationPlaceId);
  if(originTag===destinationTag)throw Error('G77 private tag collision');
  return Object.freeze({
   routingVerified:true,coverageVerified:true,trafficAware:true,
   fallbackUsed:false,originTag,
   destinationTag,zoneTag:coverage.zoneTag,
   distanceMeters:route.distanceMeters,durationSeconds:seconds,
   tollsPyg:charges.tollsPyg
  });
 };
}
