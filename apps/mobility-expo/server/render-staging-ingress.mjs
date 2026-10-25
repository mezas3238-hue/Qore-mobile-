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
 loopbackOrigin,expectedHost,adminOrigin=null,request=fetch,now=Date.now
}={}){
 let url;
 try{url=new URL(loopbackOrigin);}catch{throw Error('Fixed G4 loopback origin required');}
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||
    url.pathname!=='/'||url.username||url.password||url.search||url.hash||
    !HOST.test(expectedHost)||!validOrigin('https://'+expectedHost)||
    (adminOrigin!==null&&(!validOrigin(adminOrigin)||
      new URL(adminOrigin).hostname===expectedHost))||
    typeof request!=='function'||typeof now!=='function')
  throw Error('Render ingress requires pinned STAGING hostname and fixed loopback');
 const requests=new Map();
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
  if(!Number.isSafeInteger(at)||at<0){
   json(res,503,{error:'Ingress clock unavailable'},cors);return;
  }
  // Store only a salted digest (never raw JWT). Bound memory and requests for
  // a single STAGING instance. Distributed protection is a separate GO gate.
  for(const [key,entry] of requests)
   if(entry.until<=at)requests.delete(key);
  if(requests.size>=4096){
   json(res,503,{error:'STAGING capacity unavailable'},cors);return;
  }
  const hash=createHash('sha256').update(req.headers.authorization).digest('hex');
  const bucket=requests.get(hash);
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
  try{
   const upstream=await request(url.origin+req.url,{
    method:req.method,
    headers:{
     authorization:req.headers.authorization,
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
 });
 server.requestTimeout=9000;
 server.headersTimeout=8000;
 server.keepAliveTimeout=3000;
 server.maxRequestsPerSocket=90;
 return server;
}
