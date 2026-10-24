import test from 'node:test';
import assert from 'node:assert/strict';
import {createG52ChatHistoryHttpGateway} from './g52-chat-history-http-gateway.mjs';

const clock=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const owner=id(1),serviceId=id(2),conversationId=id(3);
const cursor='v'.repeat(44);
const actor=()=>({subject:owner,role:'passenger',
 token:'synthetic-jwt-token-1234567890',authRevision:4,
 sessionRevision:8,expiresAt:clock+120000});
const row=(n=1)=>({messageId:id(10+n),senderRole:n%2?'passenger':'driver',
 body:n%2?'Estoy aquí':'En camino',createdAt:clock-n*1000,revision:7});
const page=()=>({conversationId,serviceId,serviceKind:'RIDE',ownerId:owner,
 counterpartRole:'driver',assignmentVerified:true,state:'ACTIVE',
 revision:7,generatedAt:clock-1000,expiresAt:clock+60000,
 messages:[row(1),row(2)],nextCursor:null,
 canSend:true,productionEnabled:false});
const res=(dto=page(),status=200)=>({status,ok:status===200,
 redirected:false,headers:{get:k=>k==='content-type'
  ?'application/json':null},text:async()=>JSON.stringify(dto)});
const settings={enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 origin:'https://qa-g52.example.invalid',pinnedOrigin:'https://qa-g52.example.invalid',
 getSession:async()=>actor(),fetchImpl:async()=>res(),now:()=>clock};
const query={serviceId,serviceKind:'RIDE',subject:owner,sessionRevision:8};

test('R28 no hace HTTP sin todos los gates y origen HTTPS pinned',async()=>{
 let hits=0;
 for(const patch of [
  {enabled:false},{contractCertified:false},{stagingRuntimeVerified:false},
  {origin:'http://qa-g52.example.invalid'},
  {origin:'https://qa-g52.example.invalid:9443'},
  {origin:'https://u@qa-g52.example.invalid'},
  {origin:'https://qa-g52.example.invalid/path'},
  {pinnedOrigin:'https://another.example.invalid'}
 ]){
  const g=createG52ChatHistoryHttpGateway({...settings,...patch,
   fetchImpl:async()=>{hits++;return res();}});
  assert.equal(g.isConfigured(),false);
  assert.equal((await g.readMessages(query)).code,'G52_RUNTIME_NOT_CERTIFIED');
 }
 assert.equal(hits,0);
 const g=createG52ChatHistoryHttpGateway();
 assert.equal(g.enabled,false);
 assert.equal(typeof g.sendMessage,'undefined');
});
test('R28 GET fija JWT/servicio/hilo/cursor en la ubicación documentada G52',async()=>{
 let seen;
 const g=createG52ChatHistoryHttpGateway({...settings,
  fetchImpl:async(url,init)=>{seen={url,init};return res();}});
 const result=await g.readMessages({...query,cursor,
  expectedConversationId:conversationId});
 assert.equal(result.ok,true);
 assert.equal(seen.url,'https://qa-g52.example.invalid/v1/staging/chat/services/RIDE/'
  +serviceId+'/messages?limit=100&expectedConversationId='+conversationId);
 assert.equal(seen.init.method,'GET');
 assert.equal(seen.init.headers.Authorization,'Bearer '+actor().token);
 assert.equal(seen.init.headers['X-Qore-Chat-History-Cursor'],cursor);
 assert.equal(seen.init.cache,'no-store');
 assert.equal(seen.init.redirect,'error');
 assert.equal(seen.init.credentials,'omit');
 assert.equal(Object.hasOwn(seen.init,'body'),false);
 assert.equal(result.data.ownerId,owner);
 assert.equal(result.data.messages.length,2);
 assert.equal(Object.isFrozen(result.data.messages[0]),true);
});
test('R28 no acepta rol ajeno, cross-user, cursor o token con headers inyectados',async()=>{
 let calls=0;
 for(const [context,session,expected] of [
  [{...query,subject:id(8)},actor(),'STALE_SESSION_RESPONSE'],
  [{...query,serviceId:'../driver'},actor(),'INVALID_CHAT_HISTORY_QUERY'],
  [{...query,cursor:'../../admin'},actor(),'INVALID_CHAT_HISTORY_QUERY'],
  [{...query,expectedConversationId:'not-uuid'},actor(),'INVALID_CHAT_HISTORY_QUERY'],
  [{...query,sessionRevision:13},actor(),'STALE_SESSION_RESPONSE'],
  [query,{...actor(),role:'driver'},'AUTH_REQUIRED'],
  [query,{...actor(),token:'synthetic-jwt-token\nAuthorization:evil'},'AUTH_REQUIRED']
 ]){
  const g=createG52ChatHistoryHttpGateway({...settings,
   getSession:async()=>session,
   fetchImpl:async()=>{calls++;return res();}});
  assert.equal((await g.readMessages(context)).code,expected);
 }
 assert.equal(calls,0);
});
test('R28 rechaza mensajes falsificados, timestamp desordenado y permisos revocados',async()=>{
 const invalid=[
  {...page(),ownerId:id(90)},
  {...page(),conversationId:id(90)},
  {...page(),state:'CLOSED'},
  {...page(),assignmentVerified:false},
  {...page(),canSend:false},
  {...page(),productionEnabled:true},
  {...page(),messages:[{...row(1),driverPhone:'private'}]},
  {...page(),messages:[{...row(1),body:'https://phishing.invalid'}]},
  {...page(),messages:[{...row(1),body:'0981111111'}]},
  {...page(),messages:[{...row(1),revision:8}]},
  {...page(),messages:[row(2),row(1)]},
  {...page(),messages:[row(1),row(1)]},
  {...page(),nextCursor:cursor,messages:[]},
  {...page(),nextCursor:cursor,messages:[row(1)]},
  {...page(),expiresAt:clock-1},
  {...page(),senderEmail:'x@example.com'}
 ];
 for(const dto of invalid){
  const g=createG52ChatHistoryHttpGateway({...settings,fetchImpl:async()=>res(dto)});
  const result=await g.readMessages({...query,cursor,
   expectedConversationId:conversationId});
  assert.equal(result.code,'INVALID_CHAT_PAGE');
 }
});
test('R28 paginación legítima distinta al cursor previo sigue abierta',async()=>{
 const next='z'.repeat(44);
 const g=createG52ChatHistoryHttpGateway({...settings,
  fetchImpl:async()=>res({...page(),nextCursor:next})});
 const r=await g.readMessages({...query,cursor});
 assert.equal(r.ok,true);
 assert.equal(r.data.nextCursor,next);
});
test('R28 401 de sesión estable invalida, 401 de sesión rotada no invalida',async()=>{
 let invalidations=0;
 const g=createG52ChatHistoryHttpGateway({...settings,
  fetchImpl:async()=>({status:401,redirected:false,ok:false}),
  onSessionInvalid:()=>invalidations++});
 assert.equal((await g.readMessages(query)).code,'AUTH_REQUIRED');
 assert.equal(invalidations,1);
 let identity=actor(),release;
 const wait=new Promise(resolve=>{release=resolve;});
 const newer=createG52ChatHistoryHttpGateway({...settings,
  getSession:async()=>identity,fetchImpl:async()=>wait,
  onSessionInvalid:()=>invalidations++});
 const task=newer.readMessages(query);
 await Promise.resolve();await Promise.resolve();
 identity={...actor(),authRevision:5,token:'rotated-jwt-token-abcdefghij'};
 release({status:401,redirected:false,ok:false});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(invalidations,1);
});
test('R28 respuesta 200 de JWT rotado no expone historial anterior',async()=>{
 let identity=actor(),release;
 const wait=new Promise(resolve=>{release=resolve;});
 const g=createG52ChatHistoryHttpGateway({...settings,
  getSession:async()=>identity,fetchImpl:async()=>wait});
 const task=g.readMessages(query);
 await Promise.resolve();await Promise.resolve();
 identity={...actor(),sessionRevision:9};
 release(res());
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
});
test('R28 cancelación descarta respuesta vieja y permite nueva lectura',async()=>{
 let release,count=0,signal;
 const wait=new Promise(resolve=>{release=resolve;});
 const g=createG52ChatHistoryHttpGateway({...settings,fetchImpl:async(_,init)=>{
  count++;
  if(count===1){signal=init.signal;return wait;}
  return res();
 }});
 const old=g.readMessages(query);
 await Promise.resolve();await Promise.resolve();
 assert.equal((await g.readMessages(query)).code,'CHAT_HISTORY_READ_IN_FLIGHT');
 g.cancelPending();
 assert.equal(signal.aborted,true);
 assert.equal((await g.readMessages(query)).ok,true);
 release(res());
 assert.equal((await old).code,'STALE_SESSION_RESPONSE');
 assert.equal(count,2);
});
test('R28 rechaza media type incorrecto, contenido extra e HTTP redirect',async()=>{
 for(const [overrides,expected] of [
  [{headers:{get:()=> 'text/html'}},'BAD_CONTENT_TYPE'],
  [{text:async()=>'{bad-json'},'BAD_SERVER_RESPONSE'],
  [{headers:{get:k=>k==='content-type'?'application/json':'9999999'}},'RESPONSE_TOO_LARGE'],
  [{redirected:true},'UNTRUSTED_REDIRECT']
 ]){
  const g=createG52ChatHistoryHttpGateway({...settings,fetchImpl:async()=>({
   ...res(),...overrides
  })});
  assert.equal((await g.readMessages(query)).code,expected);
 }
});
test('R28 vencimiento de deadline en red descarta respuesta ya descargada',async()=>{
 let time=clock;
 const g=createG52ChatHistoryHttpGateway({...settings,now:()=>time,
  timeoutMs:1000,fetchImpl:async()=>{time+=1001;return res();}});
 assert.equal((await g.readMessages(query)).code,'NETWORK_OR_TIMEOUT');
});
