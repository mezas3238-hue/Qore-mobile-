/** G128: Geoapify Free routing (AUTO/MOTO shared DRIVE), STAGING ONLY.
 * Coordinates originate from trusted, independent coverage; not client input.
 * Geoapify traffic=approximated is NOT live traffic. No billable upgrade.
 * No quotes until coverage, toll verifier and durable credit quota are wired.
 */
const HOST='https://api.geoapify.com/v1/routing';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TAG=/^[A-Z_]{3,60}$/;
const ZONE=/^(AUTO|MOTO)_[A-Z_]{3,20}$/;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const coord=(lat,lon)=>typeof lat==='number'&&typeof lon==='number'&&
 Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-28&&lat<=-19&&
 lon>=-63&&lon<=-54; // Paraguay-only phase; verify actual geofence separately.
const distanceKm=(a,b)=>{const d=Math.PI/180,p=(b.lat-a.lat)*d,
 q=(b.lon-a.lon)*d,h=Math.sin(p/2)**2+
 Math.cos(a.lat*d)*Math.cos(b.lat*d)*Math.sin(q/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(h)));};
async function readSmallJson(res){
 if(!/^application\/json(?:\s*;|$)/i.test(res?.headers?.get?.('content-type')??''))
  throw Error('G128 provider content-type unavailable');
 const length=res.headers?.get?.('content-length');
 if(length!==null&&length!==undefined&&(!/^\d+$/.test(length)||Number(length)>16384))
  throw Error('G128 provider body oversized');
 let raw;
 try{raw=await res.text();}catch{throw Error('G128 provider response unreadable');}
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>16384)
  throw Error('G128 provider body oversized');
 try{return JSON.parse(raw);}catch{throw Error('G128 invalid Geoapify JSON');}
}
export function createG128GeoapifyCargoRoadResolver({
 freePlanApproved=false,apiKey,resolveCoveredCargoCoordinates,
 verifyCargoTolls,reserveFreeQuota,request=fetch,now=Date.now
}={}){
 if(freePlanApproved!==true)throw Error('G128 Geoapify Free provider not approved');
 if(typeof apiKey!=='string'||apiKey.length<20||apiKey.length>300||
  /\s/.test(apiKey)||[resolveCoveredCargoCoordinates,verifyCargoTolls,
  reserveFreeQuota,request,now].some(fn=>typeof fn!=='function'))
  throw Error('G128 needs server-only Geoapify key and independent quota/coverage/tolls');
 return async({actorId,deliveryId,vehicleKind,pickupTag,deliveryTag}={})=>{
  if(!UUID.test(actorId??'')||!UUID.test(deliveryId??'')||
   !['AUTO','MOTO'].includes(vehicleKind)||!TAG.test(pickupTag??'')||
   !TAG.test(deliveryTag??'')||pickupTag===deliveryTag)
   throw Error('G128 invalid delivery identity');
  const start=now();if(!int(start,1000000000000,9000000000000))
   throw Error('G128 trusted clock unavailable');
  const context=Object.freeze({actorId,deliveryId,vehicleKind,pickupTag,deliveryTag});
  const covered=await resolveCoveredCargoCoordinates(context);
  const checked=now();
  if(!obj(covered)||covered.source!=='INDEPENDENT_COVERAGE_AUTHORITY'||
   covered.coverageVerified!==true||covered.actorId!==actorId||
   covered.deliveryId!==deliveryId||covered.vehicleKind!==vehicleKind||
   covered.pickupTag!==pickupTag||covered.deliveryTag!==deliveryTag||
   !UUID.test(covered.evidenceId??'')||
   !int(covered.revision,1,2147483647)||
   !ZONE.test(covered.zoneTag??'')||
   !covered.zoneTag.startsWith(vehicleKind+'_')||
   !obj(covered.origin)||!obj(covered.destination)||
   !coord(covered.origin.lat,covered.origin.lon)||
   !coord(covered.destination.lat,covered.destination.lon)||
   distanceKm(covered.origin,covered.destination)>30||
   distanceKm(covered.origin,covered.destination)<0.02||
   !int(checked,start,start+30000)||
   !int(covered.verifiedAtMs,checked-60000,checked))
   throw Error('G128 verified Paraguayan zone and address coordinates required');
  // 3 credits reserved pessimistically per request, hard daily max 300 credits,
  // ≤100 route calls/day; adapter MUST reserve atomically across replicas.
  const quota=await reserveFreeQuota(Object.freeze({
   actorId,deliveryId,vehicleKind,coverageEvidenceId:covered.evidenceId,
   provider:'GEOAPIFY_FREE',creditReservation:3,maxDailyCredits:300,
   maxDailyCalls:100
  }));
  if(!obj(quota)||quota.approved!==true||quota.durable!==true||
   !UUID.test(quota.reservationId??'')||
   quota.deliveryId!==deliveryId||quota.vehicleKind!==vehicleKind||
   quota.coverageEvidenceId!==covered.evidenceId)
   throw Error('G128 durable free quota unavailable');
  const waypoints=[covered.origin,covered.destination].map(c=>
   c.lat.toFixed(6)+','+c.lon.toFixed(6)).join('|');
  const url=new URL(HOST);
  url.searchParams.set('waypoints',waypoints);
  url.searchParams.set('mode','drive');
  url.searchParams.set('traffic','approximated');
  url.searchParams.set('format','json');
  url.searchParams.set('apiKey',apiKey);
  // URL contains a secret. NEVER log it or include in thrown exceptions.
  let res;
  try{res=await request(url.toString(),{
   method:'GET',redirect:'error',credentials:'omit',
   headers:{accept:'application/json'},signal:AbortSignal.timeout(8000)
  });}catch{throw Error('G128 routing unavailable');}
  if(res?.ok!==true||res.status!==200||res.redirected===true)
   throw Error('G128 Geoapify routing refused');
  const data=await readSmallJson(res);
  if(!obj(data)||!Array.isArray(data.results)||data.results.length!==1)
   throw Error('G128 no unique verified road');
  const route=data.results[0];
  if(!obj(route)||route.distance_units!=='Meters'||
   !int(route.distance,1,50000)||typeof route.time!=='number'||
   !Number.isFinite(route.time)||route.time<=0||route.time>86400)
   throw Error('G128 invalid distance or estimated duration');
  const meters=route.distance,seconds=Math.ceil(route.time);
  if(!int(meters,1,50000)||!int(seconds,1,86400))
   throw Error('G128 route metric overflow');
  const after=now();
  if(!int(after,checked,checked+30000))
   throw Error('G128 road evidence stale');
  const toll=await verifyCargoTolls(Object.freeze({
   actorId,deliveryId,vehicleKind,coverageEvidenceId:covered.evidenceId,
   zoneTag:covered.zoneTag,origin:covered.origin,destination:covered.destination,
   distanceMeters:meters,durationSeconds:seconds,routeHasTolls:route.toll
  }));
  const finish=now();
  if(!int(finish,after,after+30000)||
   !obj(toll)||toll.source!=='INDEPENDENT_TOLL_AUTHORITY'||
   toll.tollsVerified!==true||toll.deliveryId!==deliveryId||
   toll.vehicleKind!==vehicleKind||
   toll.coverageEvidenceId!==covered.evidenceId||
   toll.distanceMeters!==meters||toll.durationSeconds!==seconds||
   !int(toll.tollsPyg,0,1000000)||
   !UUID.test(toll.evidenceId??'')||
   !int(toll.verifiedAtMs,finish-60000,finish))
   throw Error('G128 independent toll tariff unavailable');
  return Object.freeze({
   source:'INDEPENDENT_ROAD_ROUTING_AUTHORITY',
   routingVerified:true,coverageVerified:true,tollsVerified:true,
   // Geoapify approximated traffic is a MODEL only; not live congestion.
   trafficAware:true,liveTraffic:false,
   trafficModel:'APPROXIMATED_NOT_REALTIME',
   fallbackUsed:false,actorId,deliveryId,vehicleKind,pickupTag,deliveryTag,
   evidenceId:covered.evidenceId,zoneTag:covered.zoneTag,
   distanceMeters:meters,durationSeconds:seconds,tollsPyg:toll.tollsPyg,
   verifiedAtMs:finish,expiresAtMs:finish+59000
  });
 };
}
