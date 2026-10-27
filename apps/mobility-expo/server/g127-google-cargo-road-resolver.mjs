/**
 * G127 — Google Routes v2 for cargo delivery AUTO (DRIVE) or MOTO (TWO_WHEELER).
 * PRIVATE, opt-in STAGING adapter. No embedded credentials, no new paid
 * requests without independently verified geofence + atomic budget approval.
 * Neither Maps nor this resolver grants geographic or Driver legal permission.
 * TWO_WHEELER routes are beta and require a warning in Driver/Cliente UX.
 */
const URL='https://routes.googleapis.com/directions/v2:computeRoutes';
const MASK='routes.distanceMeters,routes.duration,fallbackInfo';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TAG=/^[A-Z_]{3,60}$/;
const ZONE=/^(AUTO|MOTO)_[A-Z_]{3,20}$/;
const PLACE=/^[A-Za-z0-9_-]{12,180}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function durationSeconds(x){
 if(typeof x!=='string'||!/^\d+(?:\.\d{1,9})?s$/.test(x))return null;
 const result=Math.ceil(Number(x.slice(0,-1)));
 return integer(result,1,86400)?result:null;
}
async function boundedJson(response){
 const mime=response.headers?.get?.('content-type')??'';
 if(!/^application\/json(?:\s*;|$)/i.test(mime))
  throw Error('G127 unexpected provider MIME');
 const size=response.headers?.get?.('content-length');
 if(size!==null&&size!==undefined&&(!/^\d+$/.test(size)||Number(size)>8192))
  throw Error('G127 oversized provider response');
 let text;
 if(response.body?.getReader){
  const reader=response.body.getReader(),parts=[];let used=0;
  try{
   for(;;){
    const {done,value}=await reader.read();if(done)break;
    if(!(value instanceof Uint8Array)|| (used+=value.byteLength)>8192)
     throw Error('G127 oversized provider stream');
    parts.push(value);
   }
  }finally{reader.releaseLock();}
  text=Buffer.concat(parts).toString('utf8');
 }else{
  text=await response.text();
  if(typeof text!=='string'||Buffer.byteLength(text)>8192)
   throw Error('G127 oversized provider response');
 }
 try{return JSON.parse(text);}catch{throw Error('G127 invalid provider JSON');}
}
export function createG127GoogleCargoRoadResolver({
 billableProviderApproved=false,apiKey,resolveCoveredCargoPlaces,
 verifyCargoTolls,reserveBillableBudget,request=fetch,now=Date.now
}={}){
 if(billableProviderApproved!==true)throw Error('G127 billable Routes not approved');
 if(typeof apiKey!=='string'||apiKey.length<20||apiKey.length>300||
    /\s/.test(apiKey)||[resolveCoveredCargoPlaces,verifyCargoTolls,
    reserveBillableBudget,request,now].some(x=>typeof x!=='function'))
  throw Error('G127 requires private credential, independent coverage/tolls and durable billing reservation');
 return async ({actorId,deliveryId,vehicleKind,pickupTag,deliveryTag}={})=>{
  if(!UUID.test(actorId??'')||!UUID.test(deliveryId??'')||
     !['AUTO','MOTO'].includes(vehicleKind)||
     !TAG.test(pickupTag??'')||!TAG.test(deliveryTag??'')||
     pickupTag===deliveryTag)
   throw Error('G127 untrusted cargo route subject');
  const ctx=Object.freeze({actorId,deliveryId,vehicleKind,pickupTag,deliveryTag});
  const at=now();if(!integer(at,1000000000000,9000000000000))
   throw Error('G127 trusted route clock unavailable');
  const coverage=await resolveCoveredCargoPlaces(ctx);
  const coveredAt=now();
  if(!object(coverage)||coverage.source!=='INDEPENDENT_COVERAGE_AUTHORITY'||
   coverage.coverageVerified!==true||coverage.actorId!==actorId||
   coverage.deliveryId!==deliveryId||coverage.vehicleKind!==vehicleKind||
   coverage.pickupTag!==pickupTag||coverage.deliveryTag!==deliveryTag||
   !UUID.test(coverage.evidenceId??'')||
   !integer(coverage.revision,1,Number.MAX_SAFE_INTEGER)||
   !PLACE.test(coverage.originPlaceId??'')||
   !PLACE.test(coverage.destinationPlaceId??'')||
   coverage.originPlaceId===coverage.destinationPlaceId||
   !ZONE.test(coverage.zoneTag??'')||
   !coverage.zoneTag.startsWith(vehicleKind+'_')||
   !integer(coverage.verifiedAtMs,coveredAt-60000,coveredAt)||
   !integer(coveredAt,at,at+30000))
   throw Error('G127 independently verified service coverage unavailable');
  // Atomic budget reservation must happen before any paid provider call.
  // The injected durable quota is shared across replicas and survives restart.
  const grant=await reserveBillableBudget(Object.freeze({
   actorId,deliveryId,vehicleKind,coverageEvidenceId:coverage.evidenceId,
   billingProduct:vehicleKind==='MOTO'?'ROUTES_TWO_WHEELER_TRAFFIC_AWARE':
    'ROUTES_DRIVE_TRAFFIC_AWARE',
   billableUnits:1
  }));
  if(!object(grant)||grant.approved!==true||grant.durable!==true||
   grant.deliveryId!==deliveryId||grant.vehicleKind!==vehicleKind||
   grant.coverageEvidenceId!==coverage.evidenceId||
   !UUID.test(grant.reservationId??''))
   throw Error('G127 external Maps budget not approved or exhausted');
  // Google sees ONLY independently verified Place IDs, not typed addresses,
  // private tags or the customer's identity.
  const body={
   origin:{placeId:coverage.originPlaceId},
   destination:{placeId:coverage.destinationPlaceId},
   travelMode:vehicleKind==='MOTO'?'TWO_WHEELER':'DRIVE',
   routingPreference:'TRAFFIC_AWARE',
   computeAlternativeRoutes:false,
   regionCode:'py',units:'METRIC',
   routeModifiers:{avoidTolls:false,avoidHighways:false,avoidFerries:false}
  };
  let response;
  try{
   response=await request(URL,{
    method:'POST',redirect:'error',credentials:'omit',
    headers:{'content-type':'application/json','X-Goog-Api-Key':apiKey,
     'X-Goog-FieldMask':MASK},
    body:JSON.stringify(body),signal:AbortSignal.timeout(8000)
   });
  }catch{throw Error('G127 road provider unavailable');}
  if(response?.ok!==true||response.status!==200||response.redirected===true)
   throw Error('G127 road provider refused route');
  const data=await boundedJson(response);
  if(!object(data)||data.fallbackInfo!=null||
   !Array.isArray(data.routes)||data.routes.length!==1)
   throw Error('G127 no unique traffic-aware route');
  const road=data.routes[0];
  const seconds=durationSeconds(road?.duration);
  if(!object(road)||road.fallbackInfo!=null||
   !integer(road.distanceMeters,1,500000)||seconds===null)
   throw Error('G127 invalid or fallback road metrics');
  const afterRoad=now();
  if(!integer(afterRoad,coveredAt,coveredAt+30000))
   throw Error('G127 provider route expired');
  const toll=await verifyCargoTolls(Object.freeze({
   coverageEvidenceId:coverage.evidenceId,
   actorId,deliveryId,vehicleKind,zoneTag:coverage.zoneTag,
   originPlaceId:coverage.originPlaceId,
   destinationPlaceId:coverage.destinationPlaceId,
   distanceMeters:road.distanceMeters,durationSeconds:seconds
  }));
  const finish=now();
  if(!integer(finish,afterRoad,afterRoad+30000)||
   !object(toll)||toll.source!=='INDEPENDENT_TOLL_AUTHORITY'||
   toll.tollsVerified!==true||
   toll.coverageEvidenceId!==coverage.evidenceId||
   toll.deliveryId!==deliveryId||toll.vehicleKind!==vehicleKind||
   toll.originPlaceId!==coverage.originPlaceId||
   toll.destinationPlaceId!==coverage.destinationPlaceId||
   toll.distanceMeters!==road.distanceMeters||
   toll.durationSeconds!==seconds||
   !integer(toll.tollsPyg,0,1000000)||
   !UUID.test(toll.evidenceId??'')||
   !integer(toll.verifiedAtMs,finish-60000,finish))
   throw Error('G127 independent toll certification missing');
  return Object.freeze({
   source:'INDEPENDENT_ROAD_ROUTING_AUTHORITY',
   routingVerified:true,coverageVerified:true,tollsVerified:true,
   trafficAware:true,fallbackUsed:false,actorId,deliveryId,vehicleKind,
   pickupTag,deliveryTag,evidenceId:coverage.evidenceId,
   zoneTag:coverage.zoneTag,distanceMeters:road.distanceMeters,
   durationSeconds:seconds,tollsPyg:toll.tollsPyg,
   verifiedAtMs:finish,expiresAtMs:finish+59000
  });
 };
}
