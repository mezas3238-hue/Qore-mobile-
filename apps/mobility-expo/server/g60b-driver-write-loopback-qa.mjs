/**
 * G60B/A49: independent, optional Driver SEND / RECONCILE loopback QA.
 * Not imported by mobile UI; no public socket or production credentials.
 * Every adapter must verify provider JWT, G42 session, exclusive Driver role,
 * current assignment, SQL ticket/COMMIT and rate outside client input.
 */
import {createServer} from 'node:http';
import {once} from 'node:events';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const id=x=>typeof x==='string'&&new RegExp('^'+UUID+'$','i').test(x);
const endpoint=new RegExp('^/v1/staging/driver/chat/services/(RIDE|DELIVERY|MERCHANT_ORDER)/('+UUID+')/conversations/('+UUID+')/(send|reconcile)$','i');
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,k)=>plain(x)&&Object.keys(x).length===k.length&&k.every(n=>Object.hasOwn(x,n));
const ACK=['conversationId','serviceId','requestKey','messageId','senderRole',
 'body','createdAt','revision','serverStored'];
const RECEIPT=['state','ack','latestRevision','historyRefreshRequired','qaOnly',
 'productionEnabled','retrySafe'];
const HEADERS=Object.freeze({
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'pragma':'no-cache','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'"
});
const fault=(status,code)=>({status,body:{code,qaOnly:true,retrySafe:false}});
function validMessage(x){
 return typeof x==='string'&&x.length>=1&&x.length<=500&&
  x===x.trim()&&Buffer.byteLength(x,'utf8')<=2000&&
  !/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(x)&&
  !/(?:https?:\/\/|www\.)/iu.test(x)&&
  !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(x)&&
  !/(?:\+?\d[\s().-]*){7,}/u.test(x);
}
function ackOk(ack,input,at){
 return exact(ack,ACK)&&ack.conversationId===input.conversationId&&
  ack.serviceId===input.serviceId&&ack.requestKey===input.requestKey&&
  id(ack.messageId)&&ack.senderRole==='driver'&&
  ack.body===input.body&&ack.serverStored===true&&
  Number.isSafeInteger(ack.createdAt)&&ack.createdAt>=0&&ack.createdAt<=at&&
  Number.isSafeInteger(ack.revision)&&ack.revision>=2;
}
function validatedOutput(output,input,operation,at){
 if(!plain(output)||!Number.isInteger(output.status)||!plain(output.body))
  return fault(503,'G60B_UNTRUSTED_RESPONSE');
 if(output.status!==200){
  const e=output.body;
  if(![400,401,403,409,429,503].includes(output.status)||
   !exact(e,['code','qaOnly','retrySafe'])||
   typeof e.code!=='string'||!/^[-A-Z0-9_]{3,64}$/.test(e.code)||
   e.qaOnly!==true||e.retrySafe!==false)
   return fault(503,'G60B_UNTRUSTED_ERROR');
  return fault(output.status,e.code);
 }
 const b=output.body;
 if(operation==='send')return ackOk(b,input,at)?
  {status:200,body:b}:fault(503,'G60B_UNTRUSTED_ACK');
 if(!exact(b,RECEIPT)||b.state!=='COMMITTED'||b.qaOnly!==true||
  b.productionEnabled!==false||b.retrySafe!==false||
  !ackOk(b.ack,input,at)||!Number.isSafeInteger(b.latestRevision)||
  b.latestRevision<b.ack.revision||
  b.historyRefreshRequired!==(b.latestRevision>b.ack.revision))
  return fault(503,'G60B_UNTRUSTED_RECONCILIATION');
 return {status:200,body:b};
}
function safeJson(res,output){
 const string=JSON.stringify(output.body);
 if(string.length>5000){
  res.writeHead(503,HEADERS);res.end(JSON.stringify(fault(503,'G60B_UNTRUSTED_RESPONSE').body));
  return;
 }
 res.writeHead(output.status,HEADERS);res.end(string);
}
export function createG60BDriverWriteLoopbackQa({
 environment,localQaOnly,liveEnabled,
 driverSendHandler,driverReconcileHandler,verifyStopped,
 now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [driverSendHandler,driverReconcileHandler,verifyStopped,now]
  .some(x=>typeof x!=='function'))
  throw Error('G60B requires all backend-only QA authorities, no live bridge');
 let active=0;
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  if(active>=12){safeJson(res,fault(503,'G60B_CAPACITY'));return;}
  active++;
  try{
   if(req.socket.remoteAddress!=='127.0.0.1'||
    req.socket.localAddress!=='127.0.0.1'){
    safeJson(res,fault(403,'G60B_LOOPBACK_ONLY'));return;
   }
   if(req.rawHeaders.length>64){
    safeJson(res,fault(400,'G60B_EXCESS_HEADERS'));return;
   }
   const raw=req.url??'';
   if(raw.length>245||raw.includes('%')||raw.includes('?')||
    raw.includes('#')||raw.includes('//')||raw.includes('\\')||
    req.method!=='POST'){
    safeJson(res,fault(404,'G60B_UNKNOWN_ROUTE'));return;
   }
   const matched=endpoint.exec(raw);
   if(!matched){
    safeJson(res,fault(404,'G60B_UNKNOWN_ROUTE'));return;
   }
   const h=req.headers;
   if(h.origin!==undefined||h.cookie!==undefined||h.referer!==undefined||
    h['transfer-encoding']!==undefined){
    safeJson(res,fault(403,'G60B_BROWSER_DENIED'));return;
   }
   if(!/^((127\.0\.0\.1)|(localhost)):\d{1,5}$/.test(h.host??'')){
    safeJson(res,fault(403,'G60B_BAD_HOST'));return;
   }
   const entries=req.rawHeaders.filter((x,i)=>i%2===0&&x.toLowerCase()==='authorization');
   if(entries.length!==1||typeof h.authorization!=='string'||
    !/^Bearer [A-Za-z0-9._~-]{20,7900}$/.test(h.authorization)){
    safeJson(res,fault(401,'G60B_BEARER_REQUIRED'));return;
   }
   if(h['content-type']!=='application/json'||
    typeof h['content-length']!=='string'||
    !/^\d+$/.test(h['content-length'])||
    Number(h['content-length'])<2||Number(h['content-length'])>2500){
    safeJson(res,fault(415,'G60B_JSON_REQUIRED'));return;
   }
   let chunks=[],bytes=0,payload;
   try{
    for await(const piece of req){
     bytes+=piece.length;
     if(bytes>2500)throw Error('request too large');
     chunks.push(piece);
    }
    const serialized=Buffer.concat(chunks).toString('utf8');
    payload=JSON.parse(serialized);
    if(serialized!==JSON.stringify(payload)||!exact(payload,['requestKey','body'])||
     !id(payload.requestKey)||!validMessage(payload.body))
     throw Error('untrusted body');
   }catch{
    safeJson(res,fault(400,'G60B_INVALID_WRITE_BODY'));return;
   }
   const input=Object.freeze({
    bearer:h.authorization.slice(7),serviceKind:matched[1].toUpperCase(),
    serviceId:matched[2].toLowerCase(),conversationId:matched[3].toLowerCase(),
    requestKey:payload.requestKey.toLowerCase(),body:payload.body
   });
   const operation=matched[4].toLowerCase();
   // Stopped verification happens on server for sends, not from a mobile
   // toggle; reconcile does not create a message and can work after motion.
   if(operation==='send'){
    let stopped;
    try{stopped=await verifyStopped({
     bearer:input.bearer,serviceKind:input.serviceKind,
     serviceId:input.serviceId,conversationId:input.conversationId});
    }catch{safeJson(res,fault(503,'G60B_VEHICLE_STATE_UNAVAILABLE'));return;}
    const at=now();
    if(!exact(stopped,['vehicleStopped','source','observedAtMs'])||
     stopped.vehicleStopped!==true||stopped.source!=='trusted_navigation'||
     !Number.isSafeInteger(stopped.observedAtMs)||
     stopped.observedAtMs>at||at-stopped.observedAtMs>5000){
     safeJson(res,fault(409,'G60B_VEHICLE_NOT_STOPPED'));return;
    }
   }
   const fn=operation==='send'?driverSendHandler:driverReconcileHandler;
   const deadline=Symbol('G60B_COMMIT_UNKNOWN');
   let timeout;
   try{
    const output=await Promise.race([
     Promise.resolve().then(()=>fn(input)),
     new Promise(resolve=>{timeout=setTimeout(()=>resolve(deadline),2400);})
    ]);
    if(output===deadline){
     safeJson(res,fault(503,'G60B_OUTCOME_UNKNOWN'));return;
    }
    safeJson(res,validatedOutput(output,input,operation,now()));
   }catch{safeJson(res,fault(503,'G60B_PRIVATE_HANDLER_UNAVAILABLE'));}
   finally{clearTimeout(timeout);}
  }finally{active--;}
 });
 server.headersTimeout=2000;
 server.requestTimeout=3000;
 server.keepAliveTimeout=1000;
 server.timeout=3000;
 server.maxHeadersCount=32;
 server.maxRequestsPerSocket=10;
 server.maxConnections=16;
 return Object.freeze({
  server,
  async listen(){
   if(server.listening)throw Error('G60B already listening');
   server.listen(0,'127.0.0.1');
   await once(server,'listening');
   const address=server.address();
   if(!address||address.address!=='127.0.0.1'){
    server.close();throw Error('G60B non-loopback binding forbidden');
   }
   return Object.freeze({address:address.address,port:address.port});
  },
  async close(){
   if(!server.listening)return;
   const done=once(server,'close');
   server.closeAllConnections();server.close();await done;
  }
 });
}
