import test from 'node:test';
import assert from 'node:assert/strict';
import {createG51ChatReadReceiptHttpGateway} from './g51-chat-read-receipt-http-gateway.mjs';

const now=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const subject=id(1),conversationId=id(2);
const actor=()=>({subject,role:'passenger',
 token:'synthetic-jwt-1234567890-test-only',authRevision:4,
 sessionRevision:8,expiresAt:now+120000});
const answer=(dto={conversationId,readThrough:101,qaOnly:true},status=200)=>({
 status,ok:status===200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(dto)
});
const settings={enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 origin:'https://qa-chat.example.invalid',
 pinnedOrigin:'https://qa-chat.example.invalid',
 getSession:async()=>actor(),now:()=>now,fetchImpl:async()=>answer()};
const query={conversationId,throughSeq:100,subject,sessionRevision:8};

test('R32 G51 read receipts OFF hasta que exista runtime STAGING certificado',async()=>{
 let hits=0;
 for(const patch of [
  {enabled:false},{contractCertified:false},{stagingRuntimeVerified:false},
  {origin:'http://qa-chat.example.invalid'},
  {origin:'https://evil.example.invalid'},
  {origin:'https://qa-chat.example.invalid:8443'},
  {origin:'https://user@qa-chat.example.invalid'},
  {origin:'https://qa-chat.example.invalid/path'}
 ]){
  const g=createG51ChatReadReceiptHttpGateway({...settings,...patch,
   fetchImpl:async()=>{hits++;return answer();}});
  assert.equal(g.isConfigured(),false);
  assert.equal((await g.markRead(query)).code,
   'G51_READ_RECEIPT_RUNTIME_NOT_CERTIFIED');
 }
 assert.equal(hits,0);
 const g=createG51ChatReadReceiptHttpGateway();
 assert.equal(g.enabled,false);
 assert.equal(typeof g.sendMessage,'undefined');
});
test('R32 POST receipt autorizado transporta exclusivamente throughSeq',async()=>{
 let seen;
 const g=createG51ChatReadReceiptHttpGateway({...settings,
  fetchImpl:async(url,init)=>{seen={url,init};return answer();}});
 const r=await g.markRead(query);
 assert.equal(r.ok,true);
 assert.equal(r.data.readThrough,101);
 assert.equal(Object.isFrozen(r.data),true);
 assert.equal(seen.url,'https://qa-chat.example.invalid/v1/staging/chat/conversations/'
  +conversationId+'/read-receipt');
 assert.equal(seen.init.method,'POST');
 assert.equal(seen.init.credentials,'omit');
 assert.equal(seen.init.redirect,'error');
 assert.equal(seen.init.cache,'no-store');
 assert.equal(seen.init.referrerPolicy,'no-referrer');
 assert.equal(seen.init.headers.Authorization,'Bearer '+actor().token);
 assert.deepEqual(JSON.parse(seen.init.body),{throughSeq:100});
 assert.equal(Object.keys(JSON.parse(seen.init.body)).length,1);
});
test('R32 solo recibe secuencias explícitas seguras, no revision ni timestamp',async()=>{
 let hits=0;
 const g=createG51ChatReadReceiptHttpGateway({...settings,
  fetchImpl:async()=>{hits++;return answer();}});
 for(const patch of [
  {conversationId:'../../other'},{subject:id(50)}, {throughSeq:-1},
  {throughSeq:1.5},{throughSeq:Infinity},
  {throughSeq:9007199254740992},{throughSeq:'100'},
  {sessionRevision:9}
 ]){
  assert.equal((await g.markRead({...query,...patch})).ok,false);
 }
 assert.equal(hits,0);
});
test('R32 Driver, JWT expirado y bearer inyectado no pueden marcar lectura',async()=>{
 let hits=0;
 for(const invalid of [
  {...actor(),role:'driver'},
  {...actor(),expiresAt:now-100},
  {...actor(),token:'valid-token-123456789\nInjected: yes'}
 ]){
  const g=createG51ChatReadReceiptHttpGateway({...settings,
   getSession:async()=>invalid,fetchImpl:async()=>{hits++;return answer();}});
  assert.equal((await g.markRead(query)).code,'AUTH_REQUIRED');
 }
 assert.equal(hits,0);
});
test('R32 nunca afirma lectura por ACK de otro hilo, watermark regresivo o PII',async()=>{
 for(const dto of [
  {conversationId:id(99),readThrough:101,qaOnly:true},
  {conversationId,readThrough:99,qaOnly:true},
  {conversationId,readThrough:-1,qaOnly:true},
  {conversationId,readThrough:101,qaOnly:false},
  {conversationId,readThrough:101,qaOnly:true,phone:'0981'},
  {conversationId,readThrough:'101',qaOnly:true}
 ]){
  const g=createG51ChatReadReceiptHttpGateway({...settings,
   fetchImpl:async()=>answer(dto)});
  assert.equal((await g.markRead(query)).code,'READ_RECEIPT_UNCONFIRMED');
 }
});
test('R32 JSON inválido, redirect o error HTTP producen lectura no confirmada',async()=>{
 for(const overrides of [
  {headers:{get:()=> 'text/html'}},
  {redirected:true},{status:409,ok:false},
  {status:503,ok:false},
  {text:async()=>'{bad-json'},
  {headers:{get:k=>k==='content-type'?'application/json':'999999999'}}
 ]){
  const g=createG51ChatReadReceiptHttpGateway({...settings,
   fetchImpl:async()=>({...answer(),...overrides})});
  assert.equal((await g.markRead(query)).code,'READ_RECEIPT_UNCONFIRMED');
 }
});
test('R32 401/403 de sesión actual revocan; JWT rotado NO revoca identidad nueva',async()=>{
 let invalid=0;
 for(const status of [401,403]){
  const g=createG51ChatReadReceiptHttpGateway({...settings,
   fetchImpl:async()=>({status,ok:false,redirected:false}),
   onSessionInvalid:()=>invalid++});
  assert.equal((await g.markRead(query)).status,status);
 }
 assert.equal(invalid,2);
 let current=actor(),release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const g=createG51ChatReadReceiptHttpGateway({...settings,
  getSession:async()=>current,fetchImpl:async()=>waiting,
  onSessionInvalid:()=>invalid++});
 const pending=g.markRead(query);
 await Promise.resolve();await Promise.resolve();
 current={...actor(),authRevision:5,token:'new-synthetic-jwt-1234567890'};
 release({status:401,ok:false,redirected:false});
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
 assert.equal(invalid,2);
});
test('R32 logout cancela POST en vuelo, descarta ACK tardío',async()=>{
 let release,signal;
 const waiting=new Promise(resolve=>{release=resolve;});
 const g=createG51ChatReadReceiptHttpGateway({...settings,fetchImpl:async(_url,init)=>{
  signal=init.signal;return waiting;
 }});
 const pending=g.markRead(query);
 await Promise.resolve();await Promise.resolve();
 g.cancelPending();
 assert.equal(signal.aborted,true);
 release(answer());
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
});
test('R32 secuencia 0 y ACK watermark 0 son válidos en hilo vacío',async()=>{
 const g=createG51ChatReadReceiptHttpGateway({...settings,
  fetchImpl:async()=>answer({conversationId,readThrough:0,qaOnly:true})});
 assert.equal((await g.markRead({...query,throughSeq:0})).ok,true);
});
test('R32 lectura 200 que llega después de JWT nuevo nunca se confirma',async()=>{
 let current=actor(),release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const g=createG51ChatReadReceiptHttpGateway({...settings,
  getSession:async()=>current,fetchImpl:async()=>waiting});
 const pending=g.markRead(query);
 await Promise.resolve();await Promise.resolve();
 current={...actor(),sessionRevision:9};
 release(answer());
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
});
test('R32 recibos no aceptan dos operaciones simultáneas dentro del mismo gateway',async()=>{
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const g=createG51ChatReadReceiptHttpGateway({...settings,fetchImpl:async()=>waiting});
 const pending=g.markRead(query);
 await Promise.resolve();await Promise.resolve();
 assert.equal((await g.markRead(query)).code,'READ_RECEIPT_IN_FLIGHT');
 release(answer());
 assert.equal((await pending).ok,true);
});
