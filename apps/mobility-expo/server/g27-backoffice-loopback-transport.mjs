/**
 * A05.2 — unbound, localhost-only HTTP test transport for backoffice reads.
 * No real Auth providers / no SQL / no remote HTTPS / no LIVE.
 * Invariant: this server can NEVER bind to any host except 127.0.0.1.
 */
import {createServer} from 'node:http';
import {once} from 'node:events';

const ROUTES=new Set([
 '/v1/staging/admin/vehicle-review-queue',
 '/v1/staging/admin/zones/overview',
 '/v1/staging/admin/incidents/queue',
 '/v1/staging/admin/audit/events',
 '/v1/staging/owner/finance/summary'
]);
const HEADERS={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'pragma':'no-cache','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'"
};
function send(res,status,body){
 if(res.writableEnded||res.destroyed)return;
 const code=Number.isInteger(status)&&status>=200&&status<=599?status:503;
 res.writeHead(code,HEADERS);
 res.end(JSON.stringify(body));
}
export function createQoreBackofficeLoopbackTransport({readHandler}){
 if(typeof readHandler!=='function')throw Error('Trusted QA handler required');
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  const path=req.url,route=typeof path==='string'?path.split('?')[0]:'';
  if(!ROUTES.has(route)||typeof path!=='string'||path.length>600||
   path.includes('#')||path.includes('%')||path.includes('\\')||
   path.includes('//')||path.split('?').length>2){
   send(res,404,{error:'Not found'});return;
  }
  if(req.method!=='GET'){
   send(res,405,{error:'Read-only QA transport'});return;
  }
  if(req.headers.origin||req.headers.cookie||req.headers['x-forwarded-host']||
   !/^127\.0\.0\.1:\d{1,5}$/.test(req.headers.host||'')){
   send(res,403,{error:'Browser origins, cookies and proxies unsupported in local QA'});
   return;
  }
  if(req.headers['transfer-encoding']||
    (req.headers['content-length']&&req.headers['content-length']!=='0')){
   send(res,400,{error:'GET body not supported'});return;
  }
  try{
   const out=await readHandler({method:'GET',path,headers:req.headers,body:undefined});
   if(!out||typeof out!=='object'||!Number.isInteger(out.status)||
      !out.body||typeof out.body!=='object'){
    send(res,503,{error:'Invalid QA gateway'});return;
   }
   send(res,out.status,out.body);
  }catch{send(res,503,{error:'QA gateway unavailable'});}
 });
 server.requestTimeout=10000;
 server.headersTimeout=8000;
 server.keepAliveTimeout=3000;
 server.maxRequestsPerSocket=60;
 const nativeListen=server.listen.bind(server);
 Object.defineProperty(server,'listen',{
  configurable:false,writable:false,
  value:(port,host,callback)=>{
   if(!Number.isInteger(port)||port<0||port>65535||
     (port!==0&&port<1024)||host!=='127.0.0.1')
    throw Error('Backoffice QA must listen only on 127.0.0.1');
   return typeof callback==='function'?
    nativeListen(port,host,callback):nativeListen(port,host);
  }
 });
 return server;
}
export async function listenQoreBackofficeLoopback(server,port=0){
 if(!server||typeof server.listen!=='function'||!Number.isInteger(port)||
   port<0||port>65535||(port!==0&&port<1024))
  throw Error('Invalid backoffice QA listener');
 server.listen(port,'127.0.0.1');
 await once(server,'listening');
 const address=server.address();
 if(!address||typeof address==='string'||address.address!=='127.0.0.1')
  throw Error('Refusing non-loopback backoffice listener');
 return 'http://127.0.0.1:'+address.port;
}
