import test from 'node:test';
import assert from 'node:assert/strict';
import {createFareQuoteGateway} from './fare-quote-gateway.mjs';
const t=1800000000000,owner='123e4567-e89b-42d3-a456-426614174000',
 trip='123e4567-e89b-42d3-a456-426614174001',
 qid='123e4567-e89b-42d3-a456-426614174002',
 key='123e4567-e89b-42d3-a456-426614174003';
const session=()=>({subject:owner,role:'passenger',token:'synthetic-token-for-passenger',expiresAt:t+90000,authRevision:2});
const dto=()=>({mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,serverPriced:true,
 ownerId:owner,quoteId:qid,amountGs:15000,fareMode:'AUTO',subjectKind:'RIDE',subjectId:trip,
 expiresAt:t+60000,fareVersion:'g24',routingVerified:true,
 quote:{id:qid,mode:'AUTO',subjectKind:'RIDE',subjectId:trip,ruleVersion:'g24',
 totalPyg:15000,expiresAt:new Date(t+60000).toISOString()}});
const reply=data=>({status:201,ok:true,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},text:async()=>JSON.stringify(data)});
const opts={enabled:true,contractCertified:true,origin:'https://staging.example.invalid',
 pinnedOrigin:'https://staging.example.invalid',getSession:async()=>session(),
 fetchImpl:async()=>reply(dto()),now:()=>t};
test('OFF por defecto no envía solicitud',async()=>{
 let hits=0;
 const g=createFareQuoteGateway({...opts,contractCertified:false,fetchImpl:async()=>{hits++;return reply(dto());}});
 assert.equal((await g.fetchQuote(trip,key)).code,'FARE_CONTRACT_PENDING');assert.equal(hits,0);
});
test('POST G24 exacto, sin precio, GPS ni identidad arbitraria',async()=>{
 let request;
 const g=createFareQuoteGateway({...opts,fetchImpl:async(url,o)=>{request={url,o};return reply(dto());}});
 assert.equal((await g.fetchQuote(trip,key)).ok,true);
 assert.equal(request.url,'https://staging.example.invalid/v1/staging/fares/quote');
 assert.deepEqual(JSON.parse(request.o.body),{requestKey:key,fareMode:'AUTO',subjectKind:'RIDE',subjectId:trip});
 assert.equal(request.o.method,'POST');assert.equal(request.o.credentials,'omit');assert.equal(request.o.redirect,'error');
});
test('cotización preparada por JWT anterior no sale con la nueva sesión',async()=>{
 let hits=0;
 const g=createFareQuoteGateway({...opts,
  getSession:async()=>({...session(),sessionRevision:5}),
  fetchImpl:async()=>{hits++;return reply(dto());}});
 assert.equal((await g.fetchQuote(trip,key,4)).code,'STALE_SESSION_RESPONSE');
 assert.equal(hits,0);
});
test('rechaza roles y orígenes falsos',async()=>{
 for(const wrong of [{...session(),role:'driver'},{...session(),role:'owner'},
  {...session(),expiresAt:t},{...session(),subject:'invalid'}]){
  const g=createFareQuoteGateway({...opts,getSession:async()=>wrong});
  assert.equal((await g.fetchQuote(trip,key)).code,'AUTH_REQUIRED');
 }
 for(const h of ['http://staging.example.invalid','https://evil.invalid','https://u@staging.example.invalid','https://staging.example.invalid/path']){
  assert.equal(createFareQuoteGateway({...opts,origin:h}).isConfigured(),false);
 }
});
test('DTO importe/actor/vencimiento/flags inconsistentes no se muestran',async()=>{
 for(const data of [{...dto(),ownerId:trip},{...dto(),amountGs:15001},
  {...dto(),fareMode:'MOTO'},{...dto(),serverPriced:false},
  {...dto(),livePaymentsEnabled:true},{...dto(),expiresAt:t},
  {...dto(),amountFromClient:1},{...dto(),quote:{...dto().quote,totalPyg:1}}]){
  const g=createFareQuoteGateway({...opts,fetchImpl:async()=>reply(data)});
  assert.equal((await g.fetchQuote(trip,key)).code,'INVALID_SERVER_QUOTE');
 }
});
test('403 antiguo no revoca nuevo login; 201 antiguo no entrega datos',async()=>{
 for(const code of [403,201]){
  let current=session(),resume,invalid=0;
  const waiting=new Promise(resolve=>resume=resolve);
  const g=createFareQuoteGateway({...opts,getSession:async()=>current,
   fetchImpl:async()=>waiting,onSessionInvalid:()=>invalid++});
  const task=g.fetchQuote(trip,key);
  await Promise.resolve();await Promise.resolve();
  current={...current,authRevision:3};
  resume(code===403?{status:403,ok:false,redirected:false}:reply(dto()));
  assert.equal((await task).code,'STALE_SESSION_RESPONSE');assert.equal(invalid,0);
 }
});
test('errores 409 429 503 y sin red no crean cotización',async()=>{
 for(const [status,code] of [[409,'QUOTE_CONFLICT'],[429,'RATE_LIMITED'],[503,'SERVICE_UNAVAILABLE']]){
  const g=createFareQuoteGateway({...opts,fetchImpl:async()=>({status,ok:false,redirected:false})});
  assert.equal((await g.fetchQuote(trip,key)).code,code);
 }
 const g=createFareQuoteGateway({...opts,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal((await g.fetchQuote(trip,key)).code,'NETWORK_OR_TIMEOUT');
});

test('precio 201 recibido fuera del plazo no se muestra como cotización',async()=>{
 let tick=t;
 const g=createFareQuoteGateway({...opts,now:()=>tick,timeoutMs:1000,
  fetchImpl:async()=>{tick+=1001;return reply(dto());}});
 assert.equal((await g.fetchQuote(trip,key)).code,'NETWORK_OR_TIMEOUT');
});
test('precio 401 tardío no revoca identidad actual del cliente',async()=>{
 let tick=t,invalid=0;
 const g=createFareQuoteGateway({...opts,now:()=>tick,timeoutMs:1000,
  onSessionInvalid:()=>invalid++,
  fetchImpl:async()=>{tick+=1001;return {status:401,ok:false,redirected:false};}});
 assert.equal((await g.fetchQuote(trip,key)).code,'NETWORK_OR_TIMEOUT');
 assert.equal(invalid,0);
});
test('recepción tardía del body cotización nunca acepta importe obsoleto',async()=>{
 let tick=t;
 const g=createFareQuoteGateway({...opts,now:()=>tick,timeoutMs:1000,
  fetchImpl:async()=>({...reply(dto()),text:async()=>{tick+=1001;return JSON.stringify(dto());}})});
 assert.equal((await g.fetchQuote(trip,key)).code,'NETWORK_OR_TIMEOUT');
});
test('JSON con Unicode sobre 32 KB se rechaza por bytes aunque no alcance caracteres',async()=>{
 const content='á'.repeat(17000);
 const g=createFareQuoteGateway({...opts,
  fetchImpl:async()=>reply({...dto(),unexpected:content})});
 assert.equal((await g.fetchQuote(trip,key)).code,'RESPONSE_TOO_LARGE');
});
