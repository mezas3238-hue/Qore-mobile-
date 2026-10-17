/**
 * QORE Radar — Google Routes API v2 matrix adapter, SERVER ONLY.
 * NOT connected to the app, not deployed, no API key stored in repository.
 * One destination (pickup), <=20 eligible driver origins to bound paid API costs.
 * Requires traffic aware DRIVE, explicit field mask, fallback rejection.
 */
const ENDPOINT='https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const MASK='originIndex,destinationIndex,status,condition,distanceMeters,duration,fallbackInfo';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const goodPoint=p=>p&&typeof p==='object'&&
 Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&
 p.lat>=-90&&p.lat<=90&&p.lng>=-180&&p.lng<=180;
const durationSeconds=x=>{
 if(typeof x!=='string'||!(/^[0-9]+(?:\.[0-9]{1,9})?s$/.test(x)))return null;
 const t=Math.ceil(Number(x.slice(0,-1)));
 return Number.isSafeInteger(t)&&t>=0&&t<=21_600?t:null;
};
const waypoint=p=>({waypoint:{location:{latLng:{latitude:p.lat,longitude:p.lng}}}});
export function createGoogleTrafficMatrixRouter({apiKey,request=fetch,now=Date.now}){
 if(typeof apiKey!=='string'||apiKey.trim().length<20||typeof request!=='function'||typeof now!=='function')
  throw new Error('Trusted Routes server adapter requires private server-only API credential');
 return async function calculateRoutes({origins,destination,service,trafficAware}){
  if(!Array.isArray(origins)||origins.length<1||origins.length>20||
     !goodPoint(destination)||!['economico','confort','xl'].includes(service)||
     trafficAware!==true||!origins.every(x=>UUID.test(x.driverId??'')&&goodPoint(x))||
     new Set(origins.map(x=>x.driverId)).size!==origins.length)
   throw new Error('Invalid QORE Radar origin matrix');
  const body={
   origins:origins.map(waypoint),
   destinations:[waypoint(destination)],
   travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE',
   regionCode:'py',
  };
  const reply=await request(ENDPOINT,{
   method:'POST',redirect:'error',
   headers:{'content-type':'application/json','X-Goog-Api-Key':apiKey,
    'X-Goog-FieldMask':MASK},
   body:JSON.stringify(body),signal:AbortSignal.timeout(8000)
  });
  if(!reply?.ok)throw new Error('Trusted road routing API unavailable');
  const rows=await reply.json();
  if(!Array.isArray(rows)||rows.length>origins.length)
   throw new Error('Invalid trusted route matrix format');
  const used=new Set(),out=[];
  const at=now();
  if(!Number.isSafeInteger(at)||at<0)throw new Error('Invalid route timestamp');
  for(const row of rows){
   if(!Number.isSafeInteger(row?.originIndex)||row.originIndex<0||
      row.originIndex>=origins.length||row.destinationIndex!==0||
      used.has(row.originIndex))
    throw new Error('Ambiguous route-matrix index');
   used.add(row.originIndex);
   // We must not treat a provider-fallback as traffic-aware.
   if(row.condition!=='ROUTE_EXISTS'||row.fallbackInfo||
       (row.status?.code!==undefined&&row.status.code!==0))
    continue;
   const duration=durationSeconds(row.duration);
   if(duration===null||!Number.isSafeInteger(row.distanceMeters)||
      row.distanceMeters<0||row.distanceMeters>250_000)
    continue;
   out.push({
    driverId:origins[row.originIndex].driverId,
    provider:'VERIFIED_ROAD_ROUTER',trafficAware:true,
    fallbackUsed:false,calculatedAtMs:at,
    roadMeters:row.distanceMeters,etaSeconds:duration
   });
  }
  return out;
 };
}
