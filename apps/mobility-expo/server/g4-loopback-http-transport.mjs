/**
 * QORE Radar — loopback-only HTTP transport, integration harness.
 *
 * This intentionally creates an UNBOUND Node HTTP server. It can be bound
 * only to 127.0.0.1 by listenQoreRadarLoopback(), and MUST NOT be deployed
 * or forwarded to a public interface. Auth, storage and DB are adapters
 * injected into the authenticated G4 gateways, not invented here.
 * NO LIVE, NO PSP, NO GPS devices, NO push delivery.
 */
import {createServer} from 'node:http';
import {once} from 'node:events';

const riderRoute=/^\/v1\/staging\/rider\/trips\/[0-9a-f-]{36}\/status$/i;
const offerReadRoute=/^\/v1\/staging\/driver\/offers\/[0-9a-f-]{36}$/i;
const offerDecisionRoute=/^\/v1\/staging\/driver\/offers\/(accept|decline)$/;
const tripRequestRoute=/^\/v1\/staging\/rider\/trips\/request$/;
const tripTransitionRoute=/^\/v1\/staging\/trips\/[0-9a-f-]{36}\/transition$/i;
const safe=(code,body)=>({status:code,body});
const maxBody=2048;
const JSON_HEADERS={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'pragma':'no-cache',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'",
};
function send(res,status,body) {
 if(res.writableEnded||res.destroyed)return;
 // Never echo raw request or any authentication value.
 const allowed=Number.isInteger(status)&&status>=200&&status<=599?status:503;
 res.writeHead(allowed,JSON_HEADERS);
 res.end(JSON.stringify(body));
}
export function createQoreRadarLoopbackTransport({
 riderHandler,offerHandler,tripCommandHandler,
}){
 if(typeof riderHandler!=='function'||typeof offerHandler!=='function'||
   typeof tripCommandHandler!=='function')
  throw new Error('All G4 authenticated gateways required');
 const server=createServer(async(req,res)=>{
  // No middleware, cookies, CORS, public preflight, or unrestricted proxying.
  const path=req.url;
  if(typeof path!=='string'||path.length>180||
     path.includes('?')||path.includes('#')||path.includes('%')||
     path.includes('\\')||path.includes('//')){
   send(res,404,{error:'Not found'});return;
  }
  const rider=req.method==='GET'&&riderRoute.test(path);
  const offerGet=req.method==='GET'&&offerReadRoute.test(path);
  const offerPost=req.method==='POST'&&offerDecisionRoute.test(path);
  const tripPost=req.method==='POST'&&
   (tripRequestRoute.test(path)||tripTransitionRoute.test(path));
  if(!rider&&!offerGet&&!offerPost&&!tripPost){
   send(res,404,{error:'Not found'});return;
  }
  if(req.headers.origin||req.headers.cookie){
   // The loopback test is explicitly NOT a browser or session-cookie API.
   send(res,403,{error:'Browser origins and cookies unsupported'});return;
  }
  if((rider||offerGet)&&
     (req.headers['transfer-encoding']!==undefined||
      (req.headers['content-length']!==undefined&&req.headers['content-length']!=='0'))){
   send(res,400,{error:'GET body not supported'});return;
  }
  let body;
  if(offerPost||tripPost){
   if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??'')){
    send(res,415,{error:'JSON required'});return;
   }
   const declared=Number(req.headers['content-length']??0);
   if(!Number.isSafeInteger(declared)||declared<0||declared>maxBody){
    send(res,413,{error:'Body too large'});return;
   }
   const chunks=[];let length=0;
   try{
    for await (const chunk of req){
     length+=chunk.byteLength;
     if(length>maxBody){send(res,413,{error:'Body too large'});return;}
     chunks.push(chunk);
    }
    body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   }catch{send(res,400,{error:'Invalid JSON'});return;}
  }
  try {
   const handler=rider?riderHandler:tripPost?tripCommandHandler:offerHandler;
   const out=await handler({
    method:req.method,path,headers:req.headers,body
   });
   if(out===null||typeof out!=='object'||!Number.isInteger(out.status)||
      typeof out.body!=='object'||out.body===null){
    send(res,503,{error:'Gateway unavailable'});return;
   }
   send(res,out.status,out.body);
  }catch{
   send(res,503,{error:'Gateway unavailable'});
  }
 });
 server.requestTimeout=10_000;
 server.headersTimeout=8_000;
 server.maxRequestsPerSocket=60;
 server.keepAliveTimeout=3_000;
 // The exported test-server object itself must not be bindable to all
 // interfaces, even if a future caller bypasses listenQoreRadarLoopback().
 const nativeListen=server.listen.bind(server);
 Object.defineProperty(server,'listen',{
  configurable:false,writable:false,
  value:(port,host,callback)=>{
   if(!Number.isInteger(port)||port<0||port>65535||
      (port!==0&&port<1024)||host!=='127.0.0.1')
    throw new Error('Only 127.0.0.1 QA listener is supported');
   return typeof callback==='function'?
    nativeListen(port,host,callback):nativeListen(port,host);
  }
 });
 return server;
}
export async function listenQoreRadarLoopback(server,port=0){
 if(!server||typeof server.listen!=='function'||
    !Number.isInteger(port)||port<0||port>65535||
    (port!==0&&port<1024))
  throw new Error('Invalid localhost-only test listener');
 // NEVER change the address to 0.0.0.0 or [::], including in CI.
 server.listen(port,'127.0.0.1');
 await once(server,'listening');
 const address=server.address();
 if(!address||typeof address==='string'||address.address!=='127.0.0.1')
  throw new Error('Refusing non-loopback QORE test server');
 return 'http://127.0.0.1:'+address.port;
}
