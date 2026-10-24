/**
 * G70/A59: loopback-only sender custody GET, never a production listener.
 * The caller supplies a G69 authority; it must authenticate/authorize on
 * server only. This transport is deliberately unable to mint SQL tickets.
 */
import {createServer} from 'node:http';
import {once} from 'node:events';
export const G70_SENDER_LOOPBACK_LIVE_ENABLED=false;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ROUTE=new RegExp('^/v1/staging/sender/deliveries/('+UUID+')/custody$','i');
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const KEYS=['mode','deliveryId','ownerId','state','revision','vehicleKind',
 'assignmentPersisted','proofVerified','qaOnly','productionEnabled',
 'liveDeliveriesEnabled'];
const STATES=new Set(['requested','accepted','picked_up','delivered','disputed','returned','cancelled']);
const HEADERS=Object.freeze({
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'pragma':'no-cache','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'",
 'x-frame-options':'DENY'
});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,k)=>plain(o)&&Object.keys(o).length===k.length&&
 k.every(key=>Object.hasOwn(o,key));
const fault=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,qaOnly:true,productionEnabled:false,retrySafe:false
})});
function checked(reply,id){
 if(!plain(reply)||reply.status!==200||!exact(reply.body,KEYS))
  return fault(503,'G70_UNTRUSTED_PRIVATE_RESULT');
 const r=reply.body;
 if(r.mode!=='STAGING_DEMO_ONLY'||r.deliveryId!==id||
  typeof r.ownerId!=='string'||
  !new RegExp('^'+UUID+'$','i').test(r.ownerId)||
  !STATES.has(r.state)||!Number.isSafeInteger(r.revision)||r.revision<1||
  !['AUTO','MOTO'].includes(r.vehicleKind)||
  typeof r.assignmentPersisted!=='boolean'||
  typeof r.proofVerified!=='boolean'||
  r.qaOnly!==true||r.productionEnabled!==false||
  r.liveDeliveriesEnabled!==false||
  (['delivered','disputed','returned'].includes(r.state)&&
   (!r.assignmentPersisted||!r.proofVerified))||
  (r.state==='requested'&&(r.assignmentPersisted||r.proofVerified)))
  return fault(503,'G70_UNTRUSTED_PRIVATE_RESULT');
 return {status:200,body:r};
}
function send(res,out){
 if(res.headersSent||res.destroyed||res.writableEnded)return;
 let content=JSON.stringify(out.body);
 if(content.length>2800){
  out=fault(503,'G70_RESPONSE_TOO_LARGE');
  content=JSON.stringify(out.body);
 }
 res.writeHead(out.status,HEADERS);
 res.end(content);
}
export function createG70SenderCustodyLoopbackQa({
 environment,localQaOnly,liveEnabled,privateSenderRead
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
  liveEnabled!==false||typeof privateSenderRead!=='function')
  throw Error('G70 local-only QA cannot start without private G69 authority');
 let active=0;
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  if(active>=12){send(res,fault(503,'G70_CAPACITY'));return;}
  active++;
  try{
   if(req.socket.remoteAddress!=='127.0.0.1'||
     req.socket.localAddress!=='127.0.0.1'){
    send(res,fault(403,'G70_LOOPBACK_ONLY'));return;
   }
   const path=req.url??'';
   const match=typeof path==='string'&&path.length<=150&&
    !path.includes('%')&&!path.includes('?')&&!path.includes('#')&&
    !path.includes('//')&&!path.includes('\\')?ROUTE.exec(path):null;
   if(req.method!=='GET'||!match){
    send(res,fault(404,'G70_ROUTE_NOT_FOUND'));return;
   }
   const h=req.headers;
   if(req.rawHeaders.length>60||h.origin!==undefined||
     h.cookie!==undefined||h.referer!==undefined||
     h['transfer-encoding']!==undefined||
     h['content-type']!==undefined||
     (h['content-length']!==undefined&&h['content-length']!=='0')){
    send(res,fault(403,'G70_HEADERS_REJECTED'));return;
   }
   const authEntries=req.rawHeaders.filter((v,i)=>i%2===0&&
    v.toLowerCase()==='authorization');
   if(authEntries.length!==1||typeof h.authorization!=='string'||
    !TOKEN.test(h.authorization)){
    send(res,fault(401,'G70_PRIVATE_BEARER_REQUIRED'));return;
   }
   if(!/^127\.0\.0\.1:\d{1,5}$/.test(h.host??'')){
    send(res,fault(403,'G70_HOST_NOT_LOOPBACK'));return;
   }
   const id=match[1].toLowerCase();
   const bearer=h.authorization.slice(7);
   let result;
   try{
    // G69 verifies jwt AND provider/G42 session, exclusive Passenger,
    // rate, owner attestation and one-use delegated PostgreSQL exchange.
    result=await privateSenderRead({accessToken:bearer,deliveryId:id});
   }catch{
    send(res,fault(503,'G70_AUTHORITY_UNAVAILABLE'));return;
   }
   if(result?.status!==200){
    send(res,fault(503,'G70_PRIVATE_READ_UNAVAILABLE'));return;
   }
   send(res,checked(result,id));
  }catch{
   send(res,fault(503,'G70_PRIVATE_FAILURE'));
  }finally{active--;}
 });
 server.headersTimeout=2000;
 server.requestTimeout=3000;
 server.keepAliveTimeout=500;
 server.timeout=3000;
 server.maxHeadersCount=30;
 server.maxRequestsPerSocket=8;
 server.maxConnections=16;
 return Object.freeze({
  async listen(){
   if(server.listening)throw Error('G70 already listening');
   server.listen(0,'127.0.0.1');
   await once(server,'listening');
   const a=server.address();
   if(!a||a.address!=='127.0.0.1'){
    server.close();throw Error('G70 refused non-loopback interface');
   }
   return Object.freeze({address:a.address,port:a.port});
  },
  async close(){
   if(!server.listening)return;
   const closing=once(server,'close');
   server.closeAllConnections();server.close();await closing;
  }
 });
}
