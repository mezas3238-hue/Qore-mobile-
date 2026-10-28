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
// Native TLS stream avoids the Node fetch decompression/body-reader failure
// observed on the GitHub runner. Exactly ONE network call; no retry or redirect.
const {get}=await import('node:https');
const maxBytes=4194304;
const raw=await new Promise((resolve,reject)=>{
 let complete=false,bytes=0,chunks=[];
 let req;
 const fail=reason=>{
  if(complete)return;
  complete=true;
  reject(Error(reason));
  req?.destroy();
 };
 try{
  req=get(url,{
   timeout:10000,
   headers:{accept:'application/json','accept-encoding':'identity'}
  },res=>{
   if(res.statusCode!==200){
    fail('G129_GEOAPIFY_HTTP_'+String(res.statusCode??0).replace(/\D/g,''));
    return;
   }
   if(!/^application\/json(?:\s*;|$)/i.test(res.headers['content-type']??'')){
    fail('G129_RESPONSE_NOT_JSON');return;
   }
   const advertised=res.headers['content-length'];
   if(advertised!==undefined&&(!/^\d+$/.test(advertised)||
    Number(advertised)>maxBytes)){
    fail('G129_OVERSIZED_PROVIDER_RESPONSE');return;
   }
   res.on('data',chunk=>{
    if(complete)return;
    if(!Buffer.isBuffer(chunk)){fail('G129_BAD_STREAM_CHUNK');return;}
    bytes+=chunk.length;
    if(bytes>maxBytes){fail('G129_PROVIDER_RESPONSE_OVER_4MIB');return;}
    chunks.push(chunk);
   });
   res.on('aborted',()=>fail('G129_RESPONSE_ABORTED'));
   res.on('error',()=>fail('G129_RESPONSE_STREAM_UNREADABLE'));
   res.on('end',()=>{
    if(complete)return;
    complete=true;
    resolve(Buffer.concat(chunks).toString('utf8'));
   });
  });
  req.on('timeout',()=>fail('G129_ROUTING_TIMEOUT'));
  req.on('error',()=>fail('G129_ROUTING_NETWORK_UNAVAILABLE'));
 }catch{fail('G129_ROUTING_NETWORK_UNAVAILABLE');}
});
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
