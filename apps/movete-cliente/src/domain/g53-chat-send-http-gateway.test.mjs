import test from 'node:test';
import assert from 'node:assert/strict';
import {createG53ChatSendHttpGateway} from './g53-chat-send-http-gateway.mjs';

const time=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const subject=id(1),serviceId=id(2),conversationId=id(3),requestKey=id(4),messageId=id(5);
const actor=()=>({subject,role:'passenger',token:'synthetic-jwt-1234567890-test-only',
 authRevision:4,sessionRevision:8,expiresAt:time+120000});
const dto=()=>({conversationId,serviceId,requestKey,messageId,
 senderRole:'passenger',body:'Estoy aquí',createdAt:time-2000,
 revision:9,serverStored:true});
const response=(ack=dto(),status=200)=>({status,ok:status===200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(ack)});
const settings={enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 origin:'https://qa-g53.example.invalid',
 pinnedOrigin:'https://qa-g53.example.invalid',
 getSession:async()=>actor(),fetchImpl:async()=>response(),now:()=>time};
const params={conversationId,serviceId,serviceKind:'RIDE',
 body:'Estoy aquí',requestKey,subject,sessionRevision:8};

test('R31 POST G53 OFF por defecto o sin pin/contrato: cero tráfico',async()=>{
 let hits=0;
 for(const patch of [
  {enabled:false},{contractCertified:false},{stagingRuntimeVerified:false},
  {origin:'http://qa-g53.example.invalid'},
  {origin:'https://other.example.invalid'},
  {origin:'https://qa-g53.example.invalid:8080'},
  {origin:'https://u@qa-g53.example.invalid'},
  {origin:'https://qa-g53.example.invalid/path'}
 ]){
  const g=createG53ChatSendHttpGateway({...settings,...patch,
   fetchImpl:async()=>{hits++;return response();}});
  assert.equal(g.isConfigured(),false);
  assert.equal((await g.sendMessage(params)).code,'G53_RUNTIME_NOT_CERTIFIED');
 }
 assert.equal(hits,0);
});
test('R31 POST G53 transmite requestKey una sola vez al hilo autorizado, sin cookies',async()=>{
 let sent;
 const g=createG53ChatSendHttpGateway({...settings,fetchImpl:async(url,init)=>{
  sent={url,init};return response();
 }});
 const result=await g.sendMessage(params);
 assert.equal(result.ok,true);
 assert.equal(result.data.serverStored,true);
 assert.equal(sent.url,'https://qa-g53.example.invalid/v1/staging/chat/services/RIDE/'
  +serviceId+'/conversations/'+conversationId+'/messages');
 assert.equal(sent.init.method,'POST');
 assert.equal(sent.init.cache,'no-store');
 assert.equal(sent.init.redirect,'error');
 assert.equal(sent.init.credentials,'omit');
 assert.equal(sent.init.headers.Authorization,'Bearer '+actor().token);
 assert.equal(sent.init.headers['Content-Type'],'application/json');
 assert.deepEqual(JSON.parse(sent.init.body),{body:params.body,requestKey});
 assert.equal(Object.isFrozen(result.data),true);
});
test('R31 validación previa rechaza actor cross-user, rol Driver, PII y header injection',async()=>{
 let hits=0;
 const f=async()=>{hits++;return response();};
 for(const patch of [
  {subject:id(8)},{conversationId:'../../driver'},
  {serviceKind:'ADMIN'},{requestKey:'not-uuid'},
  {body:'https://example.com'},{body:'0981111111'},
  {body:'hola\nX-Authorization: x'},
  {body:' '.repeat(4)},{body:'x'.repeat(501)}
 ]){
  const g=createG53ChatSendHttpGateway({...settings,fetchImpl:f});
  assert.equal((await g.sendMessage({...params,...patch})).ok,false);
 }
 for(const user of [{...actor(),role:'driver'},
  {...actor(),token:'synthetic-jwt\nInjected: yes'},
  {...actor(),expiresAt:time-10}]){
  const g=createG53ChatSendHttpGateway({...settings,
   getSession:async()=>user,fetchImpl:f});
  assert.equal((await g.sendMessage(params)).code,'AUTH_REQUIRED');
 }
 assert.equal(hits,0);
});
test('R31 ACK persistido debe confirmar exactamente body/key/service/conversation',async()=>{
 for(const fake of [
  {...dto(),requestKey:id(80)},{...dto(),serviceId:id(88)},
  {...dto(),conversationId:id(90)},{...dto(),body:'Otro mensaje'},
  {...dto(),senderRole:'driver'},{...dto(),serverStored:false},
  {...dto(),messageId:'not-uuid'},{...dto(),revision:1},
  {...dto(),createdAt:time+1000},{...dto(),phone:'private'}
 ]){
  const g=createG53ChatSendHttpGateway({...settings,
   fetchImpl:async()=>response(fake)});
  assert.equal((await g.sendMessage(params)).code,'CHAT_NETWORK_OR_TIMEOUT');
 }
});
test('R31 ACK corrupto o HTTP 200 sin JSON conserva incertidumbre tras POST',async()=>{
 for(const overrides of [
  {headers:{get:()=> 'text/html'}},
  {text:async()=>'{bad-json'},
  {headers:{get:k=>k==='content-type'?'application/json':'999999999'}},
  {redirected:true}
 ]){
  const g=createG53ChatSendHttpGateway({...settings,
   fetchImpl:async()=>({...response(),...overrides})});
  assert.equal((await g.sendMessage(params)).code,'CHAT_NETWORK_OR_TIMEOUT');
 }
});
test('R31 timeout, 502, 409 y transporte caído no afirman rechazo POST',async()=>{
 for(const fetchImpl of [
  async()=>{throw Error('timeout');},
  async()=>({status:502,ok:false,redirected:false}),
  async()=>({status:409,ok:false,redirected:false}),
  async()=>({status:200,ok:false,redirected:false})
 ]){
  const g=createG53ChatSendHttpGateway({...settings,fetchImpl});
  assert.equal((await g.sendMessage(params)).code,'CHAT_NETWORK_OR_TIMEOUT');
 }
});
test('R31 429/503 y JWT 401 estable ofrecen códigos y revocación segura',async()=>{
 let revoked=0;
 for(const [status,code] of [[429,'RATE_LIMITED'],[503,'SERVICE_UNAVAILABLE'],
  [401,'AUTH_REQUIRED'],[403,'FORBIDDEN']]){
  const g=createG53ChatSendHttpGateway({...settings,
   fetchImpl:async()=>({status,ok:false,redirected:false}),
   onSessionInvalid:()=>revoked++});
  assert.equal((await g.sendMessage(params)).code,code);
 }
 assert.equal(revoked,2);
});
test('R31 una rotación JWT en respuesta tardía no invalida sesión nueva',async()=>{
 let current=actor(),release,invalidations=0;
 const waiting=new Promise(resolve=>{release=resolve;});
 const g=createG53ChatSendHttpGateway({...settings,
  getSession:async()=>current,fetchImpl:async()=>waiting,
  onSessionInvalid:()=>invalidations++});
 const run=g.sendMessage(params);
 await Promise.resolve();await Promise.resolve();
 current={...actor(),token:'rotated-abcdef-1234567890',authRevision:6};
 release({status:401,ok:false,redirected:false});
 assert.equal((await run).code,'STALE_SESSION_RESPONSE');
 assert.equal(invalidations,0);
});
test('R31 logout cancela POST y descarta un ACK tardío sin marcar entrega',async()=>{
 let release,seenSignal;
 const waiting=new Promise(resolve=>{release=resolve;});
 const g=createG53ChatSendHttpGateway({...settings,fetchImpl:async(_,init)=>{
  seenSignal=init.signal;return waiting;
 }});
 const job=g.sendMessage(params);
 await Promise.resolve();await Promise.resolve();
 g.cancelPending();
 assert.equal(seenSignal.aborted,true);
 release(response());
 assert.equal((await job).code,'STALE_SESSION_RESPONSE');
});
test('R31 no admite dos POST simultáneos al mismo gateway',async()=>{
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const g=createG53ChatSendHttpGateway({...settings,fetchImpl:async()=>waiting});
 const first=g.sendMessage(params);
 await Promise.resolve();await Promise.resolve();
 assert.equal((await g.sendMessage(params)).code,'CHAT_SEND_IN_FLIGHT');
 release(response());
 assert.equal((await first).ok,true);
});
