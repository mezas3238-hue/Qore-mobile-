/**
 * Render HTTPS edge adapter for explicitly approved, non-commercial STAGING.
 * NOT the local G4 listener: loopback remains 127.0.0.1 and cannot be
 * published. Render terminates TLS; this ingress enforces the pinned HTTPS
 * host/origin before forwarding to exactly one fixed loopback authority.
 * Every operation still authenticates and authorizes in G4/PG. NOT LIVE.
 */
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';

const HOST=/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.(?:onrender\.com)$/;
const BEARER=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const MAX_BODY=2048;
const MAX_REPLY=32768;
const LIMIT=90;
const WINDOW_MS=60000;
// Isolated single-instance staging budget for >10k distinct 60s identities.
// It is NOT a shared cloud rate limiter or a production scale claim.
const MAX_IDENTITY_BUCKETS=16384;
const MAX_UPSTREAM_READS=256;
const MAX_UPSTREAM_WRITES=64;
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
 maxIdentityBuckets=MAX_IDENTITY_BUCKETS,
 maxUpstreamReads=MAX_UPSTREAM_READS,maxUpstreamWrites=MAX_UPSTREAM_WRITES,
 distributedQuota=null
}={}){
 let url;
 try{url=new URL(loopbackOrigin);}catch{throw Error('Fixed G4 loopback origin required');}
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||
    url.pathname!=='/'||url.username||url.password||url.search||url.hash||
    !HOST.test(expectedHost)||!validOrigin('https://'+expectedHost)||
    (adminOrigin!==null&&(!validOrigin(adminOrigin)||
      new URL(adminOrigin).hostname===expectedHost))||
    typeof request!=='function'||typeof now!=='function'||
    !Number.isSafeInteger(maxIdentityBuckets)||maxIdentityBuckets<1||
    maxIdentityBuckets>65536||
    !Number.isSafeInteger(maxUpstreamReads)||maxUpstreamReads<1||
    maxUpstreamReads>2048||
    !Number.isSafeInteger(maxUpstreamWrites)||maxUpstreamWrites<1||
    maxUpstreamWrites>1024||
    (distributedQuota!==null&&typeof distributedQuota.claim!=='function'))
  throw Error('Render ingress requires pinned STAGING hostname and fixed loopback');
 // Original fixed-window deadlines are monotonic in insertion order;
 // a request from an existing identity never extends or reorders its TTL.
 // Evict expired prefixes in amortized O(1), not scan all users per GET.
 const requests=new Map();
 let lastTime=0,inFlightReads=0,inFlightWrites=0;
 function pruneExpired(at){
  while(requests.size>0){
   const oldest=requests.entries().next().value;
   if(oldest[1].until>at)break;
   requests.delete(oldest[0]);
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
  if(!Number.isSafeInteger(at)||at<lastTime){
   json(res,503,{error:'Ingress clock unavailable'},cors);return;
  }
  lastTime=at;
  pruneExpired(at);
  // Store only a token digest. Existing identities remain enforceable even
  // at capacity; silently evicting a live bucket would reset its 90/min cap.
  const hash=createHash('sha256').update(req.headers.authorization).digest('hex');
  const bucket=requests.get(hash);
  if(bucket&&bucket.count>=LIMIT){
   json(res,429,{error:'STAGING rate limited'},{
    ...cors,'retry-after':String(Math.max(1,Math.ceil((bucket.until-at)/1000)))
   });return;
  }
  if(!bucket&&requests.size>=maxIdentityBuckets){
   json(res,429,{error:'STAGING identity capacity reached'},{
    ...cors,'retry-after':'1'
   });return;
  }
  // G171: an opt-in Redis atomic decision is shared across all replicas.
  // Local limits remain as a secondary safety ceiling; Redis failure is 503,
  // NEVER an unrestricted fallback. Do not forward a denied request to G4.
  if(distributedQuota!==null){
   let quota;
   try{quota=await distributedQuota.claim({
    credentialHash:hash,method:req.method
   });}
   catch{json(res,503,{error:'Shared STAGING quota unavailable',
    retrySafe:false},cors);return;}
   if(!quota||typeof quota.admitted!=='boolean'||
    !Number.isSafeInteger(quota.retryAfterSeconds)||
    quota.retryAfterSeconds<1||quota.retryAfterSeconds>60){
    json(res,503,{error:'Shared STAGING quota untrusted',
     retrySafe:false},cors);return;
   }
   if(!quota.admitted){
    json(res,429,{error:'Shared STAGING rate limited'},{
     ...cors,'retry-after':String(quota.retryAfterSeconds)
    });return;
   }
  }
  requests.set(hash,{until:bucket?.until??at+WINDOW_MS,
   count:(bucket?.count??0)+1});
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
  // Do not allow high-frequency GET polling to monopolize mutation capacity.
  // Reject a saturated POST before forwarding it; never buffer an unbounded
  // queue or silently repeat a possibly committed mutation.
  const write=req.method==='POST';
  if(write?inFlightWrites>=maxUpstreamWrites:inFlightReads>=maxUpstreamReads){
   json(res,503,{error:'STAGING upstream busy',retrySafe:false},{
    ...cors,'retry-after':'1'
   });return;
  }
  if(write)inFlightWrites++;else inFlightReads++;
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
   const reply=await upstream.text();
   if(Buffer.byteLength(reply)>MAX_REPLY){
    json(res,503,{error:'G4 oversized response'},cors);return;
   }
   let parsed;
   try{parsed=JSON.parse(reply);}catch{
    json(res,503,{error:'G4 non-JSON response'},cors);return;
   }
   if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed)){
    json(res,503,{error:'G4 untrusted response'},cors);return;
   }
   json(res,upstream.status,parsed,cors);
  }catch{json(res,503,{error:'G4 unavailable'},cors);}
  finally{if(write)inFlightWrites--;else inFlightReads--;}
 });
 server.requestTimeout=9000;
 server.headersTimeout=8000;
 server.keepAliveTimeout=3000;
 server.maxRequestsPerSocket=90;
 return server;
}
