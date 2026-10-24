/**
 * G58 A41 — offline-only private chat loopback contract harness.
 * Adapters already implement G42 verification, exclusive role, and delegated
 * database authorization; transport never accepts caller-supplied identity.
 * Does not create a listening socket until explicit test-only listen call.
 */
import {createServer} from 'node:http';
import {once} from 'node:events';
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const driverHistory=new RegExp('^/v1/staging/driver/chat/services/(RIDE|DELIVERY|MERCHANT_ORDER)/('+UUID+')/conversations/('+UUID+')/history-with-ordered-markers$','i');
const riderHistory=new RegExp('^/v1/staging/chat/services/(RIDE|DELIVERY|MERCHANT_ORDER)/('+UUID+')/history-with-ordered-markers$','i');
const driverRead=new RegExp('^/v1/staging/driver/chat/conversations/('+UUID+')/mark-visible-ordered$','i');
const riderRead=new RegExp('^/v1/staging/chat/conversations/('+UUID+')/mark-visible-ordered$','i');
const inbox='/v1/staging/driver/chat/conversations';
// G60B: two strictly optional localhost QA write routes. Never enabled by the
// shipped mobile app, and never backed by owner-mint from client metadata.
const driverWrite=new RegExp('^/v1/staging/driver/chat/services/(RIDE|DELIVERY|MERCHANT_ORDER)/('+UUID+')/conversations/('+UUID+')/(send|reconcile)
const JSON_HEADERS=Object.freeze({
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'pragma':'no-cache',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'"
});
const fail=(code,status=503)=>({status,body:{code,qaOnly:true}});
const PRIVATE_KEYS=new Set(['authorization','bearer','accessToken',
 'refreshToken','serviceRoleKey','password','privateKey','tokenIatMs',
 'sessionId','actorId','throughSeq','beforeSeq','nextPosition',
 'email','phone','sql','databaseUrl']);
function hasPrivateKey(data){
 const pending=[data];let count=0;
 while(pending.length){
  if(++count>10000)return true;
  const part=pending.pop();
  if(part===null||typeof part!=='object')continue;
  if(Array.isArray(part)){
   for(const item of part)pending.push(item);
  }else{
   for(const [key,value] of Object.entries(part)){
    if(PRIVATE_KEYS.has(key))return true;
    pending.push(value);
   }
  }
 }
 return false;
}
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,k)=>plain(o)&&Object.keys(o).length===k.length&&k.every(n=>Object.hasOwn(o,n));
const validId=x=>typeof x==='string'&&new RegExp('^'+UUID+'
function send(res,output){
 const requested=[200,400,401,403,404,409,413,415,429,503].includes(output?.status)?output.status:503;
 const body=plain(output?.body)&&!hasPrivateKey(output.body)?
  output.body:{code:'G58_UNTRUSTED_OUTPUT',qaOnly:true};
 const status=body.code==='G58_UNTRUSTED_OUTPUT'?503:requested;
 const safe=JSON.stringify(body);
 if(safe.length>750000){res.writeHead(503,JSON_HEADERS);res.end('{"code":"G58_UNAVAILABLE","qaOnly":true}');return;}
 res.writeHead(status,JSON_HEADERS);res.end(safe);
}
export function createG58ChatLoopbackTransportQa({
 environment,localQaOnly,liveEnabled,
 driverInboxHandler,driverHistoryHandler,driverVisibleHandler,
 passengerHistoryHandler,passengerVisibleHandler,
 driverSendHandler=null,driverReconcileHandler=null
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [driverInboxHandler,driverHistoryHandler,driverVisibleHandler,
   passengerHistoryHandler,passengerVisibleHandler].some(f=>typeof f!=='function'))
  throw Error('G58 QA requires five authenticated server-side adapters');
 if((driverSendHandler===null)!==(driverReconcileHandler===null)||
  (driverSendHandler!==null&&
   (typeof driverSendHandler!=='function'||typeof driverReconcileHandler!=='function')))
  throw Error('G60B Driver send and reconcile must be paired trusted local QA adapters');
 const driverWriteEnabled=driverSendHandler!==null;
 let activeRequests=0;
 const MAX_ACTIVE_REQUESTS=12;
 const HANDLER_DEADLINE_MS=2400;
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  if(activeRequests>=MAX_ACTIVE_REQUESTS){
   send(res,fail('G58E_GATEWAY_CAPACITY',503));return;
  }
  activeRequests++;
  try{
  // Never allow this local harness to be used from a non-loopback socket.
  if(req.socket.remoteAddress!=='127.0.0.1'||
   req.socket.localAddress!=='127.0.0.1'){
   send(res,fail('G58E_LOOPBACK_ONLY',403));return;
  }
  if(req.rawHeaders.length>64){
   send(res,fail('G58E_EXCESS_HEADERS',400));return;
  }
  const raw=req.url;
  if(typeof raw!=='string'||raw.length>240||!raw.startsWith('/')||
   raw.includes('%')||raw.includes('#')||raw.includes('\\')||
   raw.includes('//')){
   send(res,fail('G58_UNKNOWN_ROUTE',404));return;
  }
  const u=new URL(raw,'http://127.0.0.1');
  if(u.search.length>2200||[...u.searchParams.keys()].some(k=>!['limit','cursor'].includes(k))||
   [...u.searchParams.keys()].length!==new Set(u.searchParams.keys()).size){
   send(res,fail('G58_INVALID_QUERY',400));return;
  }
  const h=req.headers;
  if(h.origin!==undefined||h.cookie!==undefined||h.referer!==undefined||
   h['transfer-encoding']!==undefined){
   send(res,fail('G58_BROWSER_OR_TRANSFER_DENIED',403));return;
  }
  const host=h.host??'';
  if(!/^((127\.0\.0\.1)|(localhost)):\d{1,5}$/.test(host)){
   send(res,fail('G58_NONLOCAL_HOST_DENIED',403));return;
  }
  const authEntries=req.rawHeaders.filter((x,i)=>i%2===0&&x.toLowerCase()==='authorization');
  if(authEntries.length!==1||typeof h.authorization!=='string'||
   !/^Bearer [A-Za-z0-9._~-]{20,7900}$/.test(h.authorization)){
   send(res,fail('G58_BEARER_REQUIRED',401));return;
  }
  const bearer=h.authorization.slice(7);
  const dh=driverHistory.exec(u.pathname),ph=riderHistory.exec(u.pathname);
  const dr=driverRead.exec(u.pathname),pr=riderRead.exec(u.pathname);
  const dw=driverWrite.exec(u.pathname);
  const isInbox=u.pathname===inbox;
  const method=req.method;
  if(!(method==='GET'&&(isInbox||dh||ph)||method==='POST'&&(dr||pr||dw))){
   send(res,fail('G58_UNKNOWN_ROUTE',404));return;
  }
  if(dw&&!driverWriteEnabled){
   send(res,fail('G60B_DRIVER_WRITE_QA_OFF',503));return;
  }
  const isPost=method==='POST';
  if(isPost&&u.search.length!==0||!isPost&&(dr||pr)){
   send(res,fail('G58_INVALID_QUERY',400));return;
  }
  let body=null;
  const bodyLimit=dw?2500:256;
  if(isPost){
   if(h['content-type']!=='application/json'||
    typeof h['content-length']!=='string'||
    !/^\d+$/.test(h['content-length'])||
    Number(h['content-length'])<2||Number(h['content-length'])>bodyLimit){
    send(res,fail('G58_JSON_REQUIRED',415));return;
   }
   let buffers=[],bytes=0;
   try{
    for await(const part of req){
     bytes+=part.length;
     if(bytes>bodyLimit){send(res,fail('G58_TOO_LARGE',413));return;}
     buffers.push(part);
    }
    const rawBody=Buffer.concat(buffers).toString('utf8');
    body=JSON.parse(rawBody);
    if(rawBody!==JSON.stringify(body)||
     !(dw?(exact(body,['requestKey','body'])&&validId(body.requestKey)&&
       cleanText(body.body)):exact(body,['messageId','marker']))){
     send(res,fail(dw?'G60B_INVALID_WRITE_BODY':'G58_INVALID_VISIBLE_REQUEST',400));return;
    }
   }catch{send(res,fail('G58_INVALID_JSON',400));return;}
  }else{
   if(h['content-length']!==undefined&&h['content-length']!=='0'){
    send(res,fail('G58_GET_BODY_DENIED',400));return;
   }
   if(!isInbox&&!dh&&!ph||[...u.searchParams.keys()].some(k=>!['limit','cursor'].includes(k))){
    send(res,fail('G58_INVALID_QUERY',400));return;
   }
  }
  let limit=50,cursor=null;
  if(!isPost){
   const str=u.searchParams.get('limit');
   if(str!==null){
    if(!/^(?:[1-9]|[1-9][0-9]|100)$/.test(str)){
     send(res,fail('G58_BAD_PAGE_SIZE',400));return;
    }
    limit=Number(str);
   }
   cursor=u.searchParams.get('cursor');
   if(cursor!==null&&(cursor.length<30||cursor.length>2048||
     !/^[A-Za-z0-9_.-]+$/.test(cursor))){
    send(res,fail('G58_BAD_CURSOR',400));return;
   }
  }
  let handler,params;
  if(isInbox){
   handler=driverInboxHandler;
   params={bearer,cursor,limit};
  }else if(dh){
   handler=driverHistoryHandler;
   params={bearer,serviceKind:dh[1],serviceId:dh[2].toLowerCase(),
    conversationId:dh[3].toLowerCase(),cursor,limit};
  }else if(ph){
   handler=passengerHistoryHandler;
   params={bearer,serviceKind:ph[1],serviceId:ph[2].toLowerCase(),
    cursor,limit,expectedConversationId:null};
  }else if(dw){
   handler=dw[4].toLowerCase()==='send'?driverSendHandler:driverReconcileHandler;
   params={bearer,serviceKind:dw[1].toUpperCase(),
    serviceId:dw[2].toLowerCase(),conversationId:dw[3].toLowerCase(),
    requestKey:body.requestKey.toLowerCase(),body:body.body};
  }else{
   handler=dr?driverVisibleHandler:passengerVisibleHandler;
   params={bearer,conversationId:(dr??pr)[1].toLowerCase(),
    messageId:body.messageId,marker:body.marker};
  }
  // A completed SQL commit after a local HTTP deadline has UNKNOWN client
  // outcome; never claim rollback, and never transparently replay a write.
  let timeout;
  const timedOut=Symbol('G58E_UNCERTAIN_OUTCOME');
  try{
   const out=await Promise.race([
    Promise.resolve().then(()=>handler(params)),
    new Promise(resolve=>{
     timeout=setTimeout(()=>resolve(timedOut),HANDLER_DEADLINE_MS);
    })
   ]);
   if(out===timedOut){
    send(res,fail(dw?'G60B_OUTCOME_UNKNOWN':'G58E_OUTCOME_UNKNOWN',503));return;
   }
   if(!plain(out)||!Number.isSafeInteger(out.status)||!plain(out.body))
    throw Error('untrusted adapter');
   send(res,dw?safeWriteResult(out,params,dw[4].toLowerCase()==='reconcile',
    Date.now()):out);
  }catch{send(res,fail('G58_SCOPED_GATEWAY_UNAVAILABLE'));}
  finally{clearTimeout(timeout);}
  }finally{activeRequests--;}
 });
 // Infrastructure ceilings are effective even before handlers parse Bearer.
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
   if(server.listening)throw Error('G58 loopback already bound');
   server.listen(0,'127.0.0.1');
   await once(server,'listening');
   const address=server.address();
   if(!address||address.address!=='127.0.0.1'){
    server.close();
    throw Error('G58 refused nonlocal binding');
   }
   return Object.freeze({address:address.address,port:address.port});
  },
  async close(){
   if(!server.listening)return;
   const done=once(server,'close');server.closeAllConnections();server.close();
   await done;
  }
 });
}
,'i');
const JSON_HEADERS=Object.freeze({
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'pragma':'no-cache',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'"
});
const fail=(code,status=503)=>({status,body:{code,qaOnly:true}});
const PRIVATE_KEYS=new Set(['authorization','bearer','accessToken',
 'refreshToken','serviceRoleKey','password','privateKey','tokenIatMs',
 'sessionId','actorId','throughSeq','beforeSeq','nextPosition',
 'email','phone','sql','databaseUrl']);
function hasPrivateKey(data){
 const pending=[data];let count=0;
 while(pending.length){
  if(++count>10000)return true;
  const part=pending.pop();
  if(part===null||typeof part!=='object')continue;
  if(Array.isArray(part)){
   for(const item of part)pending.push(item);
  }else{
   for(const [key,value] of Object.entries(part)){
    if(PRIVATE_KEYS.has(key))return true;
    pending.push(value);
   }
  }
 }
 return false;
}
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,k)=>plain(o)&&Object.keys(o).length===k.length&&k.every(n=>Object.hasOwn(o,n));
function send(res,output){
 const requested=[200,400,401,403,404,409,413,415,429,503].includes(output?.status)?output.status:503;
 const body=plain(output?.body)&&!hasPrivateKey(output.body)?
  output.body:{code:'G58_UNTRUSTED_OUTPUT',qaOnly:true};
 const status=body.code==='G58_UNTRUSTED_OUTPUT'?503:requested;
 const safe=JSON.stringify(body);
 if(safe.length>750000){res.writeHead(503,JSON_HEADERS);res.end('{"code":"G58_UNAVAILABLE","qaOnly":true}');return;}
 res.writeHead(status,JSON_HEADERS);res.end(safe);
}
export function createG58ChatLoopbackTransportQa({
 environment,localQaOnly,liveEnabled,
 driverInboxHandler,driverHistoryHandler,driverVisibleHandler,
 passengerHistoryHandler,passengerVisibleHandler
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [driverInboxHandler,driverHistoryHandler,driverVisibleHandler,
   passengerHistoryHandler,passengerVisibleHandler].some(f=>typeof f!=='function'))
  throw Error('G58 QA requires five authenticated server-side adapters');
 let activeRequests=0;
 const MAX_ACTIVE_REQUESTS=12;
 const HANDLER_DEADLINE_MS=2400;
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  if(activeRequests>=MAX_ACTIVE_REQUESTS){
   send(res,fail('G58E_GATEWAY_CAPACITY',503));return;
  }
  activeRequests++;
  try{
  // Never allow this local harness to be used from a non-loopback socket.
  if(req.socket.remoteAddress!=='127.0.0.1'||
   req.socket.localAddress!=='127.0.0.1'){
   send(res,fail('G58E_LOOPBACK_ONLY',403));return;
  }
  if(req.rawHeaders.length>64){
   send(res,fail('G58E_EXCESS_HEADERS',400));return;
  }
  const raw=req.url;
  if(typeof raw!=='string'||raw.length>240||!raw.startsWith('/')||
   raw.includes('%')||raw.includes('#')||raw.includes('\\')||
   raw.includes('//')){
   send(res,fail('G58_UNKNOWN_ROUTE',404));return;
  }
  const u=new URL(raw,'http://127.0.0.1');
  if(u.search.length>2200||[...u.searchParams.keys()].some(k=>!['limit','cursor'].includes(k))||
   [...u.searchParams.keys()].length!==new Set(u.searchParams.keys()).size){
   send(res,fail('G58_INVALID_QUERY',400));return;
  }
  const h=req.headers;
  if(h.origin!==undefined||h.cookie!==undefined||h.referer!==undefined||
   h['transfer-encoding']!==undefined){
   send(res,fail('G58_BROWSER_OR_TRANSFER_DENIED',403));return;
  }
  const host=h.host??'';
  if(!/^((127\.0\.0\.1)|(localhost)):\d{1,5}$/.test(host)){
   send(res,fail('G58_NONLOCAL_HOST_DENIED',403));return;
  }
  const authEntries=req.rawHeaders.filter((x,i)=>i%2===0&&x.toLowerCase()==='authorization');
  if(authEntries.length!==1||typeof h.authorization!=='string'||
   !/^Bearer [A-Za-z0-9._~-]{20,7900}$/.test(h.authorization)){
   send(res,fail('G58_BEARER_REQUIRED',401));return;
  }
  const bearer=h.authorization.slice(7);
  const dh=driverHistory.exec(u.pathname),ph=riderHistory.exec(u.pathname);
  const dr=driverRead.exec(u.pathname),pr=riderRead.exec(u.pathname);
  const isInbox=u.pathname===inbox;
  const method=req.method;
  if(!(method==='GET'&&(isInbox||dh||ph)||method==='POST'&&(dr||pr))){
   send(res,fail('G58_UNKNOWN_ROUTE',404));return;
  }
  const isPost=method==='POST';
  if(isPost&&u.search.length!==0||!isPost&&(dr||pr)){
   send(res,fail('G58_INVALID_QUERY',400));return;
  }
  let body=null;
  if(isPost){
   if(h['content-type']!=='application/json'||
    typeof h['content-length']!=='string'||
    !/^\d+$/.test(h['content-length'])||
    Number(h['content-length'])<2||Number(h['content-length'])>256){
    send(res,fail('G58_JSON_REQUIRED',415));return;
   }
   let buffers=[],bytes=0;
   try{
    for await(const part of req){
     bytes+=part.length;
     if(bytes>256){send(res,fail('G58_TOO_LARGE',413));return;}
     buffers.push(part);
    }
    const rawBody=Buffer.concat(buffers).toString('utf8');
    body=JSON.parse(rawBody);
    if(rawBody!==JSON.stringify(body)||!exact(body,['messageId','marker'])){
     send(res,fail('G58_INVALID_VISIBLE_REQUEST',400));return;
    }
   }catch{send(res,fail('G58_INVALID_JSON',400));return;}
  }else{
   if(h['content-length']!==undefined&&h['content-length']!=='0'){
    send(res,fail('G58_GET_BODY_DENIED',400));return;
   }
   if(!isInbox&&!dh&&!ph||[...u.searchParams.keys()].some(k=>!['limit','cursor'].includes(k))){
    send(res,fail('G58_INVALID_QUERY',400));return;
   }
  }
  let limit=50,cursor=null;
  if(!isPost){
   const str=u.searchParams.get('limit');
   if(str!==null){
    if(!/^(?:[1-9]|[1-9][0-9]|100)$/.test(str)){
     send(res,fail('G58_BAD_PAGE_SIZE',400));return;
    }
    limit=Number(str);
   }
   cursor=u.searchParams.get('cursor');
   if(cursor!==null&&(cursor.length<30||cursor.length>2048||
     !/^[A-Za-z0-9_.-]+$/.test(cursor))){
    send(res,fail('G58_BAD_CURSOR',400));return;
   }
  }
  let handler,params;
  if(isInbox){
   handler=driverInboxHandler;
   params={bearer,cursor,limit};
  }else if(dh){
   handler=driverHistoryHandler;
   params={bearer,serviceKind:dh[1],serviceId:dh[2].toLowerCase(),
    conversationId:dh[3].toLowerCase(),cursor,limit};
  }else if(ph){
   handler=passengerHistoryHandler;
   params={bearer,serviceKind:ph[1],serviceId:ph[2].toLowerCase(),
    cursor,limit,expectedConversationId:null};
  }else{
   handler=dr?driverVisibleHandler:passengerVisibleHandler;
   params={bearer,conversationId:(dr??pr)[1].toLowerCase(),
    messageId:body.messageId,marker:body.marker};
  }
  // A completed SQL commit after a local HTTP deadline has UNKNOWN client
  // outcome; never claim rollback, and never transparently replay a write.
  let timeout;
  const timedOut=Symbol('G58E_UNCERTAIN_OUTCOME');
  try{
   const out=await Promise.race([
    Promise.resolve().then(()=>handler(params)),
    new Promise(resolve=>{
     timeout=setTimeout(()=>resolve(timedOut),HANDLER_DEADLINE_MS);
    })
   ]);
   if(out===timedOut){
    send(res,fail('G58E_OUTCOME_UNKNOWN',503));return;
   }
   if(!plain(out)||!Number.isSafeInteger(out.status)||!plain(out.body))
    throw Error('untrusted adapter');
   send(res,out);
  }catch{send(res,fail('G58_SCOPED_GATEWAY_UNAVAILABLE'));}
  finally{clearTimeout(timeout);}
  }finally{activeRequests--;}
 });
 // Infrastructure ceilings are effective even before handlers parse Bearer.
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
   if(server.listening)throw Error('G58 loopback already bound');
   server.listen(0,'127.0.0.1');
   await once(server,'listening');
   const address=server.address();
   if(!address||address.address!=='127.0.0.1'){
    server.close();
    throw Error('G58 refused nonlocal binding');
   }
   return Object.freeze({address:address.address,port:address.port});
  },
  async close(){
   if(!server.listening)return;
   const done=once(server,'close');server.closeAllConnections();server.close();
   await done;
  }
 });
}
,'i').test(x);
const ACK=['conversationId','serviceId','requestKey','messageId',
 'senderRole','body','createdAt','revision','serverStored'];
const RECOVERY=['state','ack','latestRevision','historyRefreshRequired',
 'qaOnly','productionEnabled','retrySafe'];
const cleanText=x=>typeof x==='string'&&x.length>=1&&x.length<=500&&
 x===x.trim()&&Buffer.byteLength(x,'utf8')<=2000&&
 !/[\\u0000-\\u001f\\u007f<>\\u202a-\\u202e\\u2066-\\u2069\\u200e\\u200f]/u.test(x)&&
 !/(?:https?:\\/\\/|www\\.)/iu.test(x)&&
 !/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/iu.test(x)&&
 !/(?:\\+?\\d[\\s().-]*){7,}/u.test(x);
function safeWriteAck(ack,req,now){
 return exact(ack,ACK)&&ack.conversationId===req.conversationId&&
  ack.serviceId===req.serviceId&&ack.requestKey===req.requestKey&&
  validId(ack.messageId)&&ack.senderRole==='driver'&&
  ack.body===req.body&&ack.serverStored===true&&
  Number.isSafeInteger(ack.createdAt)&&ack.createdAt>=0&&
  ack.createdAt<=now&&Number.isSafeInteger(ack.revision)&&ack.revision>=2;
}
function safeWriteResult(result,req,reconcile,now){
 if(!plain(result)||result.status!==200||!plain(result.body))
  return result;
 if(!reconcile)return safeWriteAck(result.body,req,now)?result:
  fail('G60B_UNTRUSTED_WRITE_ACK');
 const d=result.body;
 return exact(d,RECOVERY)&&d.state==='COMMITTED'&&
  d.qaOnly===true&&d.productionEnabled===false&&d.retrySafe===false&&
  Number.isSafeInteger(d.latestRevision)&&
  safeWriteAck(d.ack,req,now)&&d.latestRevision>=d.ack.revision&&
  d.historyRefreshRequired===(d.latestRevision>d.ack.revision)?
  result:fail('G60B_UNTRUSTED_RECONCILIATION');
}
function send(res,output){
 const requested=[200,400,401,403,404,409,413,415,429,503].includes(output?.status)?output.status:503;
 const body=plain(output?.body)&&!hasPrivateKey(output.body)?
  output.body:{code:'G58_UNTRUSTED_OUTPUT',qaOnly:true};
 const status=body.code==='G58_UNTRUSTED_OUTPUT'?503:requested;
 const safe=JSON.stringify(body);
 if(safe.length>750000){res.writeHead(503,JSON_HEADERS);res.end('{"code":"G58_UNAVAILABLE","qaOnly":true}');return;}
 res.writeHead(status,JSON_HEADERS);res.end(safe);
}
export function createG58ChatLoopbackTransportQa({
 environment,localQaOnly,liveEnabled,
 driverInboxHandler,driverHistoryHandler,driverVisibleHandler,
 passengerHistoryHandler,passengerVisibleHandler
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [driverInboxHandler,driverHistoryHandler,driverVisibleHandler,
   passengerHistoryHandler,passengerVisibleHandler].some(f=>typeof f!=='function'))
  throw Error('G58 QA requires five authenticated server-side adapters');
 let activeRequests=0;
 const MAX_ACTIVE_REQUESTS=12;
 const HANDLER_DEADLINE_MS=2400;
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  if(activeRequests>=MAX_ACTIVE_REQUESTS){
   send(res,fail('G58E_GATEWAY_CAPACITY',503));return;
  }
  activeRequests++;
  try{
  // Never allow this local harness to be used from a non-loopback socket.
  if(req.socket.remoteAddress!=='127.0.0.1'||
   req.socket.localAddress!=='127.0.0.1'){
   send(res,fail('G58E_LOOPBACK_ONLY',403));return;
  }
  if(req.rawHeaders.length>64){
   send(res,fail('G58E_EXCESS_HEADERS',400));return;
  }
  const raw=req.url;
  if(typeof raw!=='string'||raw.length>240||!raw.startsWith('/')||
   raw.includes('%')||raw.includes('#')||raw.includes('\\')||
   raw.includes('//')){
   send(res,fail('G58_UNKNOWN_ROUTE',404));return;
  }
  const u=new URL(raw,'http://127.0.0.1');
  if(u.search.length>2200||[...u.searchParams.keys()].some(k=>!['limit','cursor'].includes(k))||
   [...u.searchParams.keys()].length!==new Set(u.searchParams.keys()).size){
   send(res,fail('G58_INVALID_QUERY',400));return;
  }
  const h=req.headers;
  if(h.origin!==undefined||h.cookie!==undefined||h.referer!==undefined||
   h['transfer-encoding']!==undefined){
   send(res,fail('G58_BROWSER_OR_TRANSFER_DENIED',403));return;
  }
  const host=h.host??'';
  if(!/^((127\.0\.0\.1)|(localhost)):\d{1,5}$/.test(host)){
   send(res,fail('G58_NONLOCAL_HOST_DENIED',403));return;
  }
  const authEntries=req.rawHeaders.filter((x,i)=>i%2===0&&x.toLowerCase()==='authorization');
  if(authEntries.length!==1||typeof h.authorization!=='string'||
   !/^Bearer [A-Za-z0-9._~-]{20,7900}$/.test(h.authorization)){
   send(res,fail('G58_BEARER_REQUIRED',401));return;
  }
  const bearer=h.authorization.slice(7);
  const dh=driverHistory.exec(u.pathname),ph=riderHistory.exec(u.pathname);
  const dr=driverRead.exec(u.pathname),pr=riderRead.exec(u.pathname);
  const isInbox=u.pathname===inbox;
  const method=req.method;
  if(!(method==='GET'&&(isInbox||dh||ph)||method==='POST'&&(dr||pr))){
   send(res,fail('G58_UNKNOWN_ROUTE',404));return;
  }
  const isPost=method==='POST';
  if(isPost&&u.search.length!==0||!isPost&&(dr||pr)){
   send(res,fail('G58_INVALID_QUERY',400));return;
  }
  let body=null;
  if(isPost){
   if(h['content-type']!=='application/json'||
    typeof h['content-length']!=='string'||
    !/^\d+$/.test(h['content-length'])||
    Number(h['content-length'])<2||Number(h['content-length'])>256){
    send(res,fail('G58_JSON_REQUIRED',415));return;
   }
   let buffers=[],bytes=0;
   try{
    for await(const part of req){
     bytes+=part.length;
     if(bytes>256){send(res,fail('G58_TOO_LARGE',413));return;}
     buffers.push(part);
    }
    const rawBody=Buffer.concat(buffers).toString('utf8');
    body=JSON.parse(rawBody);
    if(rawBody!==JSON.stringify(body)||!exact(body,['messageId','marker'])){
     send(res,fail('G58_INVALID_VISIBLE_REQUEST',400));return;
    }
   }catch{send(res,fail('G58_INVALID_JSON',400));return;}
  }else{
   if(h['content-length']!==undefined&&h['content-length']!=='0'){
    send(res,fail('G58_GET_BODY_DENIED',400));return;
   }
   if(!isInbox&&!dh&&!ph||[...u.searchParams.keys()].some(k=>!['limit','cursor'].includes(k))){
    send(res,fail('G58_INVALID_QUERY',400));return;
   }
  }
  let limit=50,cursor=null;
  if(!isPost){
   const str=u.searchParams.get('limit');
   if(str!==null){
    if(!/^(?:[1-9]|[1-9][0-9]|100)$/.test(str)){
     send(res,fail('G58_BAD_PAGE_SIZE',400));return;
    }
    limit=Number(str);
   }
   cursor=u.searchParams.get('cursor');
   if(cursor!==null&&(cursor.length<30||cursor.length>2048||
     !/^[A-Za-z0-9_.-]+$/.test(cursor))){
    send(res,fail('G58_BAD_CURSOR',400));return;
   }
  }
  let handler,params;
  if(isInbox){
   handler=driverInboxHandler;
   params={bearer,cursor,limit};
  }else if(dh){
   handler=driverHistoryHandler;
   params={bearer,serviceKind:dh[1],serviceId:dh[2].toLowerCase(),
    conversationId:dh[3].toLowerCase(),cursor,limit};
  }else if(ph){
   handler=passengerHistoryHandler;
   params={bearer,serviceKind:ph[1],serviceId:ph[2].toLowerCase(),
    cursor,limit,expectedConversationId:null};
  }else{
   handler=dr?driverVisibleHandler:passengerVisibleHandler;
   params={bearer,conversationId:(dr??pr)[1].toLowerCase(),
    messageId:body.messageId,marker:body.marker};
  }
  // A completed SQL commit after a local HTTP deadline has UNKNOWN client
  // outcome; never claim rollback, and never transparently replay a write.
  let timeout;
  const timedOut=Symbol('G58E_UNCERTAIN_OUTCOME');
  try{
   const out=await Promise.race([
    Promise.resolve().then(()=>handler(params)),
    new Promise(resolve=>{
     timeout=setTimeout(()=>resolve(timedOut),HANDLER_DEADLINE_MS);
    })
   ]);
   if(out===timedOut){
    send(res,fail('G58E_OUTCOME_UNKNOWN',503));return;
   }
   if(!plain(out)||!Number.isSafeInteger(out.status)||!plain(out.body))
    throw Error('untrusted adapter');
   send(res,out);
  }catch{send(res,fail('G58_SCOPED_GATEWAY_UNAVAILABLE'));}
  finally{clearTimeout(timeout);}
  }finally{activeRequests--;}
 });
 // Infrastructure ceilings are effective even before handlers parse Bearer.
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
   if(server.listening)throw Error('G58 loopback already bound');
   server.listen(0,'127.0.0.1');
   await once(server,'listening');
   const address=server.address();
   if(!address||address.address!=='127.0.0.1'){
    server.close();
    throw Error('G58 refused nonlocal binding');
   }
   return Object.freeze({address:address.address,port:address.port});
  },
  async close(){
   if(!server.listening)return;
   const done=once(server,'close');server.closeAllConnections();server.close();
   await done;
  }
 });
}
,'i');
const JSON_HEADERS=Object.freeze({
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'pragma':'no-cache',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'"
});
const fail=(code,status=503)=>({status,body:{code,qaOnly:true}});
const PRIVATE_KEYS=new Set(['authorization','bearer','accessToken',
 'refreshToken','serviceRoleKey','password','privateKey','tokenIatMs',
 'sessionId','actorId','throughSeq','beforeSeq','nextPosition',
 'email','phone','sql','databaseUrl']);
function hasPrivateKey(data){
 const pending=[data];let count=0;
 while(pending.length){
  if(++count>10000)return true;
  const part=pending.pop();
  if(part===null||typeof part!=='object')continue;
  if(Array.isArray(part)){
   for(const item of part)pending.push(item);
  }else{
   for(const [key,value] of Object.entries(part)){
    if(PRIVATE_KEYS.has(key))return true;
    pending.push(value);
   }
  }
 }
 return false;
}
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,k)=>plain(o)&&Object.keys(o).length===k.length&&k.every(n=>Object.hasOwn(o,n));
function send(res,output){
 const requested=[200,400,401,403,404,409,413,415,429,503].includes(output?.status)?output.status:503;
 const body=plain(output?.body)&&!hasPrivateKey(output.body)?
  output.body:{code:'G58_UNTRUSTED_OUTPUT',qaOnly:true};
 const status=body.code==='G58_UNTRUSTED_OUTPUT'?503:requested;
 const safe=JSON.stringify(body);
 if(safe.length>750000){res.writeHead(503,JSON_HEADERS);res.end('{"code":"G58_UNAVAILABLE","qaOnly":true}');return;}
 res.writeHead(status,JSON_HEADERS);res.end(safe);
}
export function createG58ChatLoopbackTransportQa({
 environment,localQaOnly,liveEnabled,
 driverInboxHandler,driverHistoryHandler,driverVisibleHandler,
 passengerHistoryHandler,passengerVisibleHandler
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [driverInboxHandler,driverHistoryHandler,driverVisibleHandler,
   passengerHistoryHandler,passengerVisibleHandler].some(f=>typeof f!=='function'))
  throw Error('G58 QA requires five authenticated server-side adapters');
 let activeRequests=0;
 const MAX_ACTIVE_REQUESTS=12;
 const HANDLER_DEADLINE_MS=2400;
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  if(activeRequests>=MAX_ACTIVE_REQUESTS){
   send(res,fail('G58E_GATEWAY_CAPACITY',503));return;
  }
  activeRequests++;
  try{
  // Never allow this local harness to be used from a non-loopback socket.
  if(req.socket.remoteAddress!=='127.0.0.1'||
   req.socket.localAddress!=='127.0.0.1'){
   send(res,fail('G58E_LOOPBACK_ONLY',403));return;
  }
  if(req.rawHeaders.length>64){
   send(res,fail('G58E_EXCESS_HEADERS',400));return;
  }
  const raw=req.url;
  if(typeof raw!=='string'||raw.length>240||!raw.startsWith('/')||
   raw.includes('%')||raw.includes('#')||raw.includes('\\')||
   raw.includes('//')){
   send(res,fail('G58_UNKNOWN_ROUTE',404));return;
  }
  const u=new URL(raw,'http://127.0.0.1');
  if(u.search.length>2200||[...u.searchParams.keys()].some(k=>!['limit','cursor'].includes(k))||
   [...u.searchParams.keys()].length!==new Set(u.searchParams.keys()).size){
   send(res,fail('G58_INVALID_QUERY',400));return;
  }
  const h=req.headers;
  if(h.origin!==undefined||h.cookie!==undefined||h.referer!==undefined||
   h['transfer-encoding']!==undefined){
   send(res,fail('G58_BROWSER_OR_TRANSFER_DENIED',403));return;
  }
  const host=h.host??'';
  if(!/^((127\.0\.0\.1)|(localhost)):\d{1,5}$/.test(host)){
   send(res,fail('G58_NONLOCAL_HOST_DENIED',403));return;
  }
  const authEntries=req.rawHeaders.filter((x,i)=>i%2===0&&x.toLowerCase()==='authorization');
  if(authEntries.length!==1||typeof h.authorization!=='string'||
   !/^Bearer [A-Za-z0-9._~-]{20,7900}$/.test(h.authorization)){
   send(res,fail('G58_BEARER_REQUIRED',401));return;
  }
  const bearer=h.authorization.slice(7);
  const dh=driverHistory.exec(u.pathname),ph=riderHistory.exec(u.pathname);
  const dr=driverRead.exec(u.pathname),pr=riderRead.exec(u.pathname);
  const isInbox=u.pathname===inbox;
  const method=req.method;
  if(!(method==='GET'&&(isInbox||dh||ph)||method==='POST'&&(dr||pr))){
   send(res,fail('G58_UNKNOWN_ROUTE',404));return;
  }
  const isPost=method==='POST';
  if(isPost&&u.search.length!==0||!isPost&&(dr||pr)){
   send(res,fail('G58_INVALID_QUERY',400));return;
  }
  let body=null;
  if(isPost){
   if(h['content-type']!=='application/json'||
    typeof h['content-length']!=='string'||
    !/^\d+$/.test(h['content-length'])||
    Number(h['content-length'])<2||Number(h['content-length'])>256){
    send(res,fail('G58_JSON_REQUIRED',415));return;
   }
   let buffers=[],bytes=0;
   try{
    for await(const part of req){
     bytes+=part.length;
     if(bytes>256){send(res,fail('G58_TOO_LARGE',413));return;}
     buffers.push(part);
    }
    const rawBody=Buffer.concat(buffers).toString('utf8');
    body=JSON.parse(rawBody);
    if(rawBody!==JSON.stringify(body)||!exact(body,['messageId','marker'])){
     send(res,fail('G58_INVALID_VISIBLE_REQUEST',400));return;
    }
   }catch{send(res,fail('G58_INVALID_JSON',400));return;}
  }else{
   if(h['content-length']!==undefined&&h['content-length']!=='0'){
    send(res,fail('G58_GET_BODY_DENIED',400));return;
   }
   if(!isInbox&&!dh&&!ph||[...u.searchParams.keys()].some(k=>!['limit','cursor'].includes(k))){
    send(res,fail('G58_INVALID_QUERY',400));return;
   }
  }
  let limit=50,cursor=null;
  if(!isPost){
   const str=u.searchParams.get('limit');
   if(str!==null){
    if(!/^(?:[1-9]|[1-9][0-9]|100)$/.test(str)){
     send(res,fail('G58_BAD_PAGE_SIZE',400));return;
    }
    limit=Number(str);
   }
   cursor=u.searchParams.get('cursor');
   if(cursor!==null&&(cursor.length<30||cursor.length>2048||
     !/^[A-Za-z0-9_.-]+$/.test(cursor))){
    send(res,fail('G58_BAD_CURSOR',400));return;
   }
  }
  let handler,params;
  if(isInbox){
   handler=driverInboxHandler;
   params={bearer,cursor,limit};
  }else if(dh){
   handler=driverHistoryHandler;
   params={bearer,serviceKind:dh[1],serviceId:dh[2].toLowerCase(),
    conversationId:dh[3].toLowerCase(),cursor,limit};
  }else if(ph){
   handler=passengerHistoryHandler;
   params={bearer,serviceKind:ph[1],serviceId:ph[2].toLowerCase(),
    cursor,limit,expectedConversationId:null};
  }else{
   handler=dr?driverVisibleHandler:passengerVisibleHandler;
   params={bearer,conversationId:(dr??pr)[1].toLowerCase(),
    messageId:body.messageId,marker:body.marker};
  }
  // A completed SQL commit after a local HTTP deadline has UNKNOWN client
  // outcome; never claim rollback, and never transparently replay a write.
  let timeout;
  const timedOut=Symbol('G58E_UNCERTAIN_OUTCOME');
  try{
   const out=await Promise.race([
    Promise.resolve().then(()=>handler(params)),
    new Promise(resolve=>{
     timeout=setTimeout(()=>resolve(timedOut),HANDLER_DEADLINE_MS);
    })
   ]);
   if(out===timedOut){
    send(res,fail('G58E_OUTCOME_UNKNOWN',503));return;
   }
   if(!plain(out)||!Number.isSafeInteger(out.status)||!plain(out.body))
    throw Error('untrusted adapter');
   send(res,out);
  }catch{send(res,fail('G58_SCOPED_GATEWAY_UNAVAILABLE'));}
  finally{clearTimeout(timeout);}
  }finally{activeRequests--;}
 });
 // Infrastructure ceilings are effective even before handlers parse Bearer.
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
   if(server.listening)throw Error('G58 loopback already bound');
   server.listen(0,'127.0.0.1');
   await once(server,'listening');
   const address=server.address();
   if(!address||address.address!=='127.0.0.1'){
    server.close();
    throw Error('G58 refused nonlocal binding');
   }
   return Object.freeze({address:address.address,port:address.port});
  },
  async close(){
   if(!server.listening)return;
   const done=once(server,'close');server.closeAllConnections();server.close();
   await done;
  }
 });
}
