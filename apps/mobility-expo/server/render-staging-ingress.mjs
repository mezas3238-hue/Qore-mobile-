/**
 * Strict HTTPS edge adapter for approved Render/Railway, non-commercial STAGING.
 * NOT the local G4 listener: loopback remains 127.0.0.1 and cannot be
 * published. The provider terminates TLS; this ingress enforces the pinned HTTPS
 * host/origin before forwarding to exactly one fixed loopback authority.
 * Every operation still authenticates and authorizes in G4/PG. NOT LIVE.
 */
import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';

const HOSTS=Object.freeze({
 render:/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/,
 railway:/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.up\.railway\.app$/
});
const BEARER=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const MAX_BODY=2048;
const MAX_REPLY=32768;
// Per-replica admission budgets; never imply a global fleet cap.
 // Read operations have a separate lane so long-running writes cannot
 // starve trip-status recovery. Tune using measured CPU/PG connection limits.
const DEFAULT_MAX_READS=256;
const DEFAULT_MAX_WRITES=128;
const DEFAULT_IDENTITY_BUCKETS=32768;
const LIMIT=90;
const WINDOW_MS=60000;
const JSON_HEADERS=Object.freeze({
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, private, max-age=0',
 'pragma':'no-cache',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'",
 'strict-transport-security':'max-age=31536000',
 'x-frame-options':'DENY'
});
const validOrigin=x=>{
 try{
  const u=new URL(x);
  return u.protocol==='https:'&&u.origin===x&&
   !u.username&&!u.password&&!u.port&&!u.search&&!u.hash;
 }catch{return false;}
};
// Read a bounded HTTP RESPONSE STREAM, never .text() before checking size:
 // an upstream error or malicious 100MB JSON must not exhaust a Render worker.
 async function boundedJsonReply(upstream){
  if(!upstream.body||typeof upstream.body.getReader!=='function')
   throw Error('Missing bounded upstream stream');
  const reader=upstream.body.getReader();
  const chunks=[];let bytes=0,complete=false;
  try{
   for(;;){
    const {value,done}=await reader.read();
    if(done){complete=true;break;}
    if(!(value instanceof Uint8Array))throw Error('Untrusted upstream chunk');
    bytes+=value.byteLength;
    if(bytes>MAX_REPLY)throw Error('G4 response exceeds configured budget');
    chunks.push(value);
   }
  }finally{
   if(!complete)await reader.cancel().catch(()=>{});
  }
  const parsed=JSON.parse(Buffer.concat(chunks,bytes).toString('utf8'));
  if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed))
   throw Error('G4 returned untrusted JSON shape');
  return parsed;
 }
 const json=(res,status,body,extra={})=>{
 if(res.writableEnded||res.destroyed)return;
 res.writeHead(status,{...JSON_HEADERS,...extra});
 res.end(JSON.stringify(body));
};
function badPath(path){
 return typeof path!=='string'||path.length>180||
  !/^\/v1\/staging\/[a-zA-Z0-9/_-]+$/.test(path)||
  path.includes('//')||path.includes('..');
}
function rawHeaderCount(req,name){
 let count=0;
 for(let i=0;i<req.rawHeaders.length;i+=2)
  if(req.rawHeaders[i].toLowerCase()===name)count++;
 return count;
}
export function createRenderStagingIngress({
 loopbackOrigin,expectedHost,adminOrigin=null,request=fetch,now=Date.now,
 maxConcurrentReads=DEFAULT_MAX_READS,
 maxConcurrentWrites=DEFAULT_MAX_WRITES,
 maxIdentityBuckets=DEFAULT_IDENTITY_BUCKETS,
 readinessKey=null,readinessProbe=null,edgeProvider='render'
}={}){
 let url;
 try{url=new URL(loopbackOrigin);}catch{throw Error('Fixed G4 loopback origin required');}
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||
    url.pathname!=='/'||url.username||url.password||url.search||url.hash||
    !Object.hasOwn(HOSTS,edgeProvider)||!HOSTS[edgeProvider].test(expectedHost)||!validOrigin('https://'+expectedHost)||
    (adminOrigin!==null&&(!validOrigin(adminOrigin)||
      new URL(adminOrigin).hostname===expectedHost))||
    typeof request!=='function'||typeof now!=='function'||
    !Number.isSafeInteger(maxConcurrentReads)||maxConcurrentReads<1||
    maxConcurrentReads>2048||
    !Number.isSafeInteger(maxConcurrentWrites)||maxConcurrentWrites<1||
    maxConcurrentWrites>1024||
    !Number.isSafeInteger(maxIdentityBuckets)||maxIdentityBuckets<1||
    maxIdentityBuckets>65536||
    !(readinessProbe===null||typeof readinessProbe==='function')||
    !(readinessKey===null||(typeof readinessKey==='string'&&
      /^[A-Za-z0-9_-]{48,128}$/.test(readinessKey)))||
    (readinessProbe!==null&&readinessKey===null))
  throw Error('Cloud STAGING ingress requires provider-pinned hostname and fixed loopback');
 // Fixed windows retain insertion order. Evict expired entries at the head
 // in amortized O(1), not an O(number-of-users) sweep on every request.
 const requests=new Map();
 let lastAt=0,readsInFlight=0,writesInFlight=0;
 let readinessInFlight=null;
 function pruneExpired(at){
  while(requests.size){
   const [key,item]=requests.entries().next().value;
   if(item.until>at)break;
   requests.delete(key);
  }
 }
 const server=createServer(async(req,res)=>{
  // Transport-only liveness; not a DB, E2E, or commercial readiness claim.
  if(req.url==='/_qore/liveness'&&req.method==='GET'&&
    req.headers.host===expectedHost&&req.headers['x-forwarded-proto']==='https'&&
    rawHeaderCount(req,'x-forwarded-proto')===1){
   json(res,200,{state:'PROCESS_UP_ONLY',commercialRidesEnabled:false});
   return;
  }
  // Operator-only infrastructure readiness. NEVER asserts trip, legal, PSP,
  // GPS or commercial availability. Secrets and dependency errors are never
  // returned to callers. This route cannot reach the G4 business handler.
  if(req.url==='/_qore/readiness'){
   const presented=req.headers['x-qore-readiness-key'];
   const trusted=req.method==='GET'&&req.headers.host===expectedHost&&
    req.headers['x-forwarded-proto']==='https'&&
    rawHeaderCount(req,'x-forwarded-proto')===1&&
    req.headers.origin===undefined&&req.headers.cookie===undefined&&
    req.headers['proxy-authorization']===undefined&&
    req.headers['transfer-encoding']===undefined&&
    (req.headers['x-forwarded-host']===undefined||
     req.headers['x-forwarded-host']===expectedHost)&&
    (req.headers['content-length']===undefined||
     req.headers['content-length']==='0')&&
    readinessProbe!==null&&readinessKey!==null&&
    rawHeaderCount(req,'x-qore-readiness-key')===1&&
    typeof presented==='string'&&
    /^[A-Za-z0-9_-]{48,128}$/.test(presented)&&
    timingSafeEqual(
     createHash('sha256').update(presented).digest(),
     createHash('sha256').update(readinessKey).digest()
    );
   if(!trusted){json(res,404,{error:'Not found'});return;}
   if(readinessInFlight===null){
    let timeout;
    const pending=(async()=>{
     try{
      const ok=await Promise.race([
       Promise.resolve().then(()=>readinessProbe()),
       new Promise(resolve=>{timeout=setTimeout(()=>resolve(false),4000);})
      ]);
      return ok===true;
     }catch{return false;}
     finally{clearTimeout(timeout);}
    })();
    readinessInFlight=pending;
    void pending.finally(()=>{if(readinessInFlight===pending)readinessInFlight=null;});
   }
   const ready=await readinessInFlight;
   json(res,ready?200:503,{
    state:ready?'INFRASTRUCTURE_READY_ONLY':'STAGING_UNAVAILABLE',
    stagingE2ECertified:false,commercialRidesEnabled:false
   });
   return;
  }
  if(req.headers.host!==expectedHost||
    req.headers['x-forwarded-proto']!=='https'||
    rawHeaderCount(req,'x-forwarded-proto')!==1||
    req.headers.cookie!==undefined||
    req.headers['proxy-authorization']!==undefined||
    req.headers['transfer-encoding']!==undefined||
    (req.headers['x-forwarded-host']!==undefined&&
      req.headers['x-forwarded-host']!==expectedHost)){
   json(res,403,{error:'Untrusted STAGING transport'});return;
  }
  const origin=req.headers.origin;
  if(origin!==undefined&&(adminOrigin===null||origin!==adminOrigin||
    rawHeaderCount(req,'origin')!==1)){
   json(res,403,{error:'Unapproved browser origin'});return;
  }
  const cors=origin===adminOrigin&&adminOrigin!==null?
   {'access-control-allow-origin':adminOrigin,'vary':'Origin'}:{};
  // G26 signed, owner-scoped cursor travels as a header, never a URL query.
  // Forward ONLY a single syntactically valid cursor on Rider History GET.
  // G26 itself verifies signature, subject and expiry after JWT validation.
  const historyCursor=req.headers['x-qore-history-cursor'];
  if(historyCursor!==undefined&&
     (req.method!=='GET'||req.url!=='/v1/staging/rider/history'||
      rawHeaderCount(req,'x-qore-history-cursor')!==1||
      typeof historyCursor!=='string'||historyCursor.length>200||
      !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(historyCursor))){
   json(res,400,{error:'Invalid history cursor header'},cors);return;
  }
  if(req.method==='OPTIONS'){
   if(origin===undefined||badPath(req.url)||
     req.headers['access-control-request-method']===undefined||
     !['GET','POST'].includes(req.headers['access-control-request-method'])||
     (req.headers['access-control-request-headers']??'').toLowerCase()
       .split(',').map(x=>x.trim()).some(x=>!['authorization','content-type'].includes(x))){
    json(res,403,{error:'Unapproved preflight'},cors);return;
   }
   res.writeHead(204,{...JSON_HEADERS,...cors,
    'access-control-allow-methods':'GET, POST, OPTIONS',
    'access-control-allow-headers':'Authorization, Content-Type',
    'access-control-max-age':'300'});res.end();return;
  }
  if(!['GET','POST'].includes(req.method)||badPath(req.url)){
   json(res,404,{error:'Not found'},cors);return;
  }
  if(rawHeaderCount(req,'authorization')!==1||
    typeof req.headers.authorization!=='string'||!BEARER.test(req.headers.authorization)){
   json(res,401,{error:'Verified bearer required'},cors);return;
  }
  const at=now();
  if(!Number.isSafeInteger(at)||at<lastAt){
   json(res,503,{error:'Ingress clock unavailable'},cors);return;
  }
  // Only digests of credentials, never bearer tokens or PII, are stored.
  // A full identity map must still serve known users; it rejects NEW users
  // without discarding the existing admission state or breaking fairness.
  lastAt=at;
  pruneExpired(at);
  const hash=createHash('sha256').update(req.headers.authorization).digest('hex');
  const bucket=requests.get(hash);
  if(!bucket&&requests.size>=maxIdentityBuckets){
   json(res,503,{error:'STAGING identity budget unavailable'},
    {...cors,'retry-after':'1'});return;
  }
  if(bucket&&bucket.until>at&&bucket.count>=LIMIT){
   json(res,429,{error:'STAGING rate limited'},cors);return;
  }
  requests.set(hash,{until:bucket?.until>at?bucket.until:at+WINDOW_MS,
   count:bucket?.until>at?bucket.count+1:1});
  if(req.method==='GET'&&
     (req.headers['content-length']!==undefined&&req.headers['content-length']!=='0')){
   json(res,400,{error:'GET body not allowed'},cors);return;
  }
  let body;
  if(req.method==='POST'){
   if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??'')){
    json(res,415,{error:'JSON body required'},cors);return;
   }
   const declared=Number(req.headers['content-length']??0);
   if(!Number.isSafeInteger(declared)||declared<0||declared>MAX_BODY){
    json(res,413,{error:'Request body too large'},cors);return;
   }
   const chunks=[];let size=0;
   try{
    for await(const chunk of req){
     size+=chunk.byteLength;
     if(size>MAX_BODY){json(res,413,{error:'Request body too large'},cors);return;}
     chunks.push(chunk);
    }
    body=Buffer.concat(chunks).toString('utf8');
    JSON.parse(body);
   }catch{json(res,400,{error:'Invalid JSON'},cors);return;}
  }
  // Admission is intentionally before the upstream call: a rejected POST
  // can NEVER create or duplicate a booking. Do not blindly replay a POST
  // after a timeout: rely on original idempotency/reconciliation in G4/PG.
  const readLane=req.method==='GET';
  if(readLane?readsInFlight>=maxConcurrentReads:
      writesInFlight>=maxConcurrentWrites){
   json(res,503,{error:'STAGING upstream busy'},{
    ...cors,'retry-after':'1'
   });return;
  }
  if(readLane)readsInFlight++;
  else writesInFlight++;
  try{
   const upstream=await request(url.origin+req.url,{
    method:req.method,
    headers:{
     authorization:req.headers.authorization,
     ...(historyCursor===undefined?{}:{'x-qore-history-cursor':historyCursor}),
     ...(req.method==='POST'?{'content-type':'application/json'}:{})
    },
    ...(req.method==='POST'?{body}:{}),
    redirect:'error',cache:'no-store',credentials:'omit',
    signal:AbortSignal.timeout(7000)
   });
   if(!upstream||upstream.redirected||!Number.isInteger(upstream.status)||
      upstream.status<200||upstream.status>599){
    json(res,503,{error:'G4 unavailable'},cors);return;
   }
   const parsed=await boundedJsonReply(upstream);
   json(res,upstream.status,parsed,cors);
  }catch{json(res,503,{error:'G4 unavailable'},cors);}
  finally{
   if(readLane)readsInFlight--;
   else writesInFlight--;
  }
 });
 server.requestTimeout=9000;
 server.headersTimeout=8000;
 server.keepAliveTimeout=3000;
 server.maxRequestsPerSocket=90;
 return server;
}
