/** G129 one-route LIVE PROVIDER SMOKE, no backend activation or payment.
 * Only on trusted push, with repository secret GEOAPIFY_API_KEY injected by CI.
 * One GET to Free plan. NEVER print the request URL, key, provider body,
 * untrusted exception stack or authenticated request headers.
 * The waypoints below are public landmarks, not a customer order.
 */
import assert from 'node:assert/strict';
if(process.env.CI!=='true'||process.env.GITHUB_REPOSITORY!=='mezas3238-hue/Qore-mobile-'||
 process.env.GITHUB_REF!=='refs/heads/feature/mobility-monorepo-isolated-20261016'||
 process.env.GITHUB_EVENT_NAME!=='push')
 throw Error('G129 live smoke restricted to original trusted CI branch push');
const secret=process.env.GEOAPIFY_API_KEY;
if(typeof secret!=='string'||secret.length<20||secret.length>300||
 /\s/.test(secret))throw Error('G129_SECRET_UNAVAILABLE_OR_INVALID');
const url=new URL('https://api.geoapify.com/v1/routing');
url.searchParams.set('waypoints','-25.2773434,-57.6371671|-25.2828767,-57.5674503');
url.searchParams.set('mode','drive');
url.searchParams.set('traffic','approximated');
url.searchParams.set('format','json');
url.searchParams.set('apiKey',secret);
let response;
try{
 response=await fetch(url,{method:'GET',redirect:'error',
  signal:AbortSignal.timeout(10000),headers:{accept:'application/json'}});
}catch{throw Error('G129_ROUTING_NETWORK_UNAVAILABLE');}
if(response.status!==200||!response.ok||response.redirected===true)
 throw Error('G129_GEOAPIFY_HTTP_'+String(response.status).replace(/\D/g,''));
if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??''))
 throw Error('G129_RESPONSE_NOT_JSON');
const advertised=response.headers.get('content-length');
if(advertised!==null&&(!/^\d+$/.test(advertised)||Number(advertised)>524288))
 throw Error('G129_OVERSIZED_PROVIDER_RESPONSE');
let raw;
try{
 const chunks=[];let bytes=0;
 if(!response.body?.getReader())throw Error('missing reader');
 const rd=response.body.getReader();
 try{
  for(;;){const {done,value}=await rd.read();if(done)break;
   if(!(value instanceof Uint8Array)||(bytes+=value.byteLength)>524288)
    throw Error('oversize');
   chunks.push(value);
  }
 }finally{rd.releaseLock();}
 raw=Buffer.concat(chunks).toString('utf8');
}catch{throw Error('G129_UNREADABLE_OR_LARGE_RESPONSE');}
let payload;try{payload=JSON.parse(raw);}catch{throw Error('G129_INVALID_JSON');}
if(!Array.isArray(payload?.results)||payload.results.length!==1)
 throw Error('G129_WRONG_ROUTE_RESULT_COUNT');
const r=payload.results[0];
if(!/^meters$/i.test(r.distance_units??'')||
 !Number.isSafeInteger(r.distance)||r.distance<3000||r.distance>25000||
 typeof r.time!=='number'||!Number.isFinite(r.time)||
 r.time<120||r.time>7200)
 throw Error('G129_INVALID_ROUTE_METRICS');
console.log('G129 GEOAPIFY FREE REAL API PASS, Asuncion public landmarks, mode=drive, format=json');
console.log('distance_meters='+r.distance+' duration_seconds='+Math.ceil(r.time));
console.log('API credential omitted. No customer data, dispatch, payment or production enabled.');
