import test from 'node:test';
import assert from 'node:assert/strict';
import {createG51ChatInboxHttpGateway} from './g51-chat-inbox-http-gateway.mjs';
import {createPassengerChatInbox} from './passenger-chat-inbox.mjs';
const time=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const subject=id(1),cursor='p'.repeat(44);
const actor=()=>({subject,role:'passenger',token:'synthetic-only-jwt-token-123456',
 authRevision:4,sessionRevision:8,expiresAt:time+90000});
const row=n=>({conversationId:id(n+100),serviceId:id(n+500),
 serviceKind:n%3===0?'RIDE':n%3===1?'DELIVERY':'MERCHANT_ORDER',
 state:'ACTIVE',assignmentVerified:true,counterpartRole:'driver',
 revision:9,unreadCount:n,updatedAt:time-1000-n,canSend:true});
const page=(items=[row(1)],nextCursor=null)=>({ownerId:subject,
 generatedAt:time-1000,expiresAt:time+60000,revision:9,
 items,nextCursor,productionEnabled:false});
const response=(data,status=200)=>({status,ok:status===200,redirected:false,
 headers:{get:x=>x==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
const settings={
 enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 origin:'https://qa-chat.example.invalid',
 pinnedOrigin:'https://qa-chat.example.invalid',
 getSession:async()=>actor(),fetchImpl:async()=>response(page()),now:()=>time
};
const context={cursor:null,subject,sessionRevision:8};

test('R25 OFF por defecto nunca hace HTTP ni concede permiso de bandeja',async()=>{
 let hits=0;
 const gateway=createG51ChatInboxHttpGateway({...settings,
  enabled:false,fetchImpl:async()=>{hits++;return response(page());}});
 assert.equal(gateway.isConfigured(),false);
 assert.equal(gateway.enabled,false);
 assert.equal((await gateway.readInbox(context)).code,'G51_RUNTIME_NOT_CERTIFIED');
 const inbox=createPassengerChatInbox({gateway,getActor:async()=>({
  subject,role:'passenger',sessionRevision:8}),now:()=>time});
 assert.equal((await inbox.load()).code,'CHAT_INBOX_CONTRACT_NOT_CERTIFIED');
 assert.equal(hits,0);
});
test('R25 sesión Passenger y HTTPS fijado: cursor firmado via header, sin cookies',async()=>{
 let seen;
 const gateway=createG51ChatInboxHttpGateway({...settings,fetchImpl:async(url,init)=>{
  seen={url,init};return response(page());
 }});
 const r=await gateway.readInbox({...context,cursor});
 assert.equal(r.ok,true);
 assert.equal(seen.url,'https://qa-chat.example.invalid/v1/staging/chat/conversations?limit=100');
 assert.equal(seen.init.method,'GET');
 assert.equal(seen.init.credentials,'omit');
 assert.equal(seen.init.redirect,'error');
 assert.equal(seen.init.cache,'no-store');
 assert.equal(seen.init.headers['X-Qore-Chat-Cursor'],cursor);
 assert.equal(seen.init.headers.Authorization,'Bearer '+actor().token);
 assert.equal(Object.hasOwn(seen.init,'body'),false);
 assert.equal(Object.hasOwn(r.data,'token'),false);
 assert.equal(Object.isFrozen(r.data.items[0]),true);
});
test('R25 sin certificado de runtime, contrato o pin nunca habilita transporte',()=>{
 for(const patch of [
  {stagingRuntimeVerified:false},{contractCertified:false},
  {origin:'http://qa-chat.example.invalid'},
  {origin:'https://evil.example.invalid'},
  {origin:'https://user@qa-chat.example.invalid'},
  {origin:'https://qa-chat.example.invalid:8443'},
  {origin:'https://qa-chat.example.invalid/path'},
  {pinnedOrigin:'https://another.example.invalid'}
 ])assert.equal(createG51ChatInboxHttpGateway({...settings,...patch}).isConfigured(),false);
});
test('R25 deniega actor cruzado, cursor malicioso y rol Driver antes de red',async()=>{
 let calls=0;
 const gateway=createG51ChatInboxHttpGateway({...settings,
  fetchImpl:async()=>{calls++;return response(page());}});
 assert.equal((await gateway.readInbox({...context,subject:id(90)})).code,
  'STALE_SESSION_RESPONSE');
 assert.equal((await gateway.readInbox({...context,cursor:'../../driver'})).code,
  'INVALID_CHAT_INBOX_QUERY');
 assert.equal((await gateway.readInbox({...context,sessionRevision:88})).code,
  'STALE_SESSION_RESPONSE');
 const driver=createG51ChatInboxHttpGateway({...settings,
  getSession:async()=>({...actor(),role:'driver'}),
  fetchImpl:async()=>{calls++;return response(page());}});
 assert.equal((await driver.readInbox(context)).code,'AUTH_REQUIRED');
 assert.equal(calls,0);
});
test('R25 rechaza PII, producción y dueño equivocado ANTES de exponer al store',async()=>{
 for(const dto of [
  {...page(),customerPhone:'0981111111'},
  {...page(),ownerId:id(99)},
  {...page(),productionEnabled:true},
  {...page(),items:[{...row(1),driverPhone:'0981'}]},
  {...page(),items:[{...row(1),assignmentVerified:false}]},
  {...page(),items:[{...row(1),serviceId:'../admin'}]},
  {...page(),items:[{...row(1),unreadCount:-1}]},
  {...page(),items:[{...row(1),revision:10}]},
  {...page(),nextCursor:'../../admin'},
  {...page(),items:[] ,nextCursor:cursor}
 ]){
  const gateway=createG51ChatInboxHttpGateway({...settings,
   fetchImpl:async()=>response(dto)});
  assert.equal((await gateway.readInbox(context)).code,'INVALID_CHAT_INBOX_DTO');
 }
});
test('R25 endpoint inbox y store operan con DTO G51 autorizado sin mensajes privados',async()=>{
 const gateway=createG51ChatInboxHttpGateway(settings);
 const inbox=createPassengerChatInbox({gateway,getActor:async()=>({
  subject,role:'passenger',sessionRevision:8}),now:()=>time});
 assert.equal((await inbox.load()).ok,true);
 assert.equal(inbox.snapshot().items.length,1);
 assert.equal(inbox.snapshot().phoneNumbersExposed,false);
 assert.equal(inbox.snapshot().messageBodiesExposed,false);
});
test('R25 401 actual revoca sesión, pero JWT rotado en vuelo no se invalida',async()=>{
 let revoked=0;
 const old=createG51ChatInboxHttpGateway({...settings,
  fetchImpl:async()=>({status:401,ok:false,redirected:false}),
  onSessionInvalid:()=>revoked++});
 assert.equal((await old.readInbox(context)).code,'AUTH_REQUIRED');
 assert.equal(revoked,1);
 let active=actor(),release;
 const deferred=new Promise(resolve=>{release=resolve;});
 const rotated=createG51ChatInboxHttpGateway({...settings,
  getSession:async()=>active,fetchImpl:async()=>deferred,
  onSessionInvalid:()=>revoked++});
 const run=rotated.readInbox(context);
 await Promise.resolve();await Promise.resolve();
 active={...actor(),authRevision:5,token:'new-synthetic-only-jwt-token-67890'};
 release({status:401,ok:false,redirected:false});
 assert.equal((await run).code,'STALE_SESSION_RESPONSE');
 assert.equal(revoked,1);
});
test('R25 respuesta 200 atrasada después de JWT nuevo se descarta',async()=>{
 let active=actor(),release;
 const deferred=new Promise(resolve=>{release=resolve;});
 const gateway=createG51ChatInboxHttpGateway({...settings,
  getSession:async()=>active,fetchImpl:async()=>deferred});
 const run=gateway.readInbox(context);
 await Promise.resolve();await Promise.resolve();
 active={...actor(),sessionRevision:9};
 release(response(page()));
 assert.equal((await run).code,'STALE_SESSION_RESPONSE');
});
test('R25 cancelInbox invalida petición vieja aunque ignore AbortSignal',async()=>{
 let calls=0,release,firstSignal;
 const deferred=new Promise(resolve=>{release=resolve;});
 const gateway=createG51ChatInboxHttpGateway({...settings,fetchImpl:async(_url,init)=>{
  calls++;if(calls===1){firstSignal=init.signal;return deferred;}
  return response(page());
 }});
 const first=gateway.readInbox(context);
 await Promise.resolve();await Promise.resolve();
 assert.equal((await gateway.readInbox(context)).code,'CHAT_INBOX_READ_IN_FLIGHT');
 gateway.cancelInbox();
 assert.equal(firstSignal.aborted,true);
 assert.equal((await gateway.readInbox(context)).ok,true);
 release(response(page()));
 assert.equal((await first).code,'STALE_SESSION_RESPONSE');
 assert.equal(calls,2);
});
test('R25 tipo de respuesta, JSON y límite de bytes se validan',async()=>{
 for(const [patch,error] of [
  [{headers:{get:()=> 'text/html'}},'BAD_CONTENT_TYPE'],
  [{text:async()=>'{broken'},'BAD_SERVER_RESPONSE'],
  [{headers:{get:k=>k==='content-type'?'application/json':'999999'}},'RESPONSE_TOO_LARGE'],
  [{redirected:true},'UNTRUSTED_REDIRECT']
 ]){
  const gateway=createG51ChatInboxHttpGateway({...settings,
   fetchImpl:async()=>({...response(page()),...patch})});
  assert.equal((await gateway.readInbox(context)).code,error);
 }
});
test('R25 deadline caducado no expone DTO que llegó demasiado tarde',async()=>{
 let clock=time;
 const gateway=createG51ChatInboxHttpGateway({...settings,now:()=>clock,
  timeoutMs:1000,fetchImpl:async()=>{clock+=1001;return response(page());}});
 assert.equal((await gateway.readInbox(context)).code,'NETWORK_OR_TIMEOUT');
});
