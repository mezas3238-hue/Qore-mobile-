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
const JSON_HEADERS=Object.freeze({
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'pragma':'no-cache',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'"
});
const fail=(code,status=503)=>({status,body:{code,qaOnly:true}});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,k)=>plain(o)&&Object.keys(o).length===k.length&&k.every(n=>Object.hasOwn(o,n));
function send(res,output){
 const status=[200,400,401,403,404,409,413,415,429,503].includes(output?.status)?output.status:503;
 const body=plain(output?.body)?output.body:{code:'G58_UNAVAILABLE',qaOnly:true};
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
 const server=createServer(async(req,res)=>{
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
  try{
   const out=await handler(params);
   if(!plain(out)||!Number.isSafeInteger(out.status)||!plain(out.body))
    throw Error('untrusted adapter');
   send(res,out);
  }catch{send(res,fail('G58_SCOPED_GATEWAY_UNAVAILABLE'));}
 });
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
