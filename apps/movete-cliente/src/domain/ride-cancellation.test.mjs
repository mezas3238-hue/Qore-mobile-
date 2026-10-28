import test from 'node:test';
import assert from 'node:assert/strict';
import {createRideCancellationGateway,createRideCancellationController} from './ride-cancellation.mjs';
const t=1800000000000;
const a='123e4567-e89b-42d3-a456-426614174001';
const trip='123e4567-e89b-42d3-a456-426614174002';
const key='123e4567-e89b-42d3-a456-426614174003';
const event='123e4567-e89b-42d3-a456-426614174004';
const session=()=>({subject:a,role:'passenger',token:'synthetic-scope-only-123456789',
 expiresAt:t+60000,authRevision:3});
const payload={mode:'STAGING_DEMO_ONLY',commercialRidesEnabled:false,
 tripId:trip,event:'cancel',eventId:event,serverPersisted:true};
const success=()=>({ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(payload)});
const opts={enabled:true,contractCertified:true,origin:'https://staging.example.invalid',
 pinnedOrigin:'https://staging.example.invalid',getSession:async()=>session(),fetchImpl:async()=>success(),now:()=>t};
test('cancelar está apagado por defecto aunque se invoque',async()=>{
 let calls=0;
 const gateway=createRideCancellationGateway({...opts,enabled:false,fetchImpl:async()=>{calls++;return success();}});
 assert.equal((await gateway.cancel(trip,key)).code,'CANCEL_CONTRACT_PENDING');
 assert.equal(calls,0);
});
test('solicita solo cancelar viaje propio con requestKey y no incluye actor ni tarifa',async()=>{
 let url,req;
 const gateway=createRideCancellationGateway({...opts,fetchImpl:async(u,o)=>{url=u;req=o;return success();}});
 const result=await gateway.cancel(trip,key);
 assert.equal(result.ok,true);
 assert.equal(result.refreshRequired,true);
 assert.equal(url,'https://staging.example.invalid/v1/staging/rider/trips/'+trip+'/cancel');
 assert.equal(req.method,'POST');
 assert.equal(req.credentials,'omit');
 assert.equal(req.redirect,'error');
 assert.equal(req.cache,'no-store');
 assert.deepEqual(JSON.parse(req.body),{requestKey:key});
 assert.equal(Object.hasOwn(result,'refundGs'),false);
});
test('cancelación preparada por sesión anterior no se transmite bajo otro JWT',async()=>{
 let hits=0;
 const gateway=createRideCancellationGateway({...opts,
  getSession:async()=>({...session(),sessionRevision:9}),
  fetchImpl:async()=>{hits++;return success();}});
 assert.equal((await gateway.cancel(trip,key,8)).code,'STALE_SESSION_RESPONSE');
 assert.equal(hits,0);
});
test('no se aceptan roles distintos, expirados ni IDs falsos',async()=>{
 for(const bad of [{...session(),role:'driver'}, {...session(),role:'owner'},
  {...session(),expiresAt:t}, {...session(),subject:'invalid'}]){
  const gateway=createRideCancellationGateway({...opts,getSession:async()=>bad});
  assert.equal((await gateway.cancel(trip,key)).code,'AUTH_REQUIRED');
 }
 const gateway=createRideCancellationGateway(opts);
 assert.equal((await gateway.cancel('invalid',key)).code,'INVALID_INPUT');
 assert.equal((await gateway.cancel(trip,'not-a-uuid')).code,'INVALID_INPUT');
});
test('cabecera de host no permite HTTP o redirección',async()=>{
 for(const origin of ['http://staging.example.invalid','https://evil.invalid',
 'https://u@staging.example.invalid','https://staging.example.invalid/path']){
  const gateway=createRideCancellationGateway({...opts,origin});
  assert.equal(gateway.isConfigured(),false);
 }
 const gateway=createRideCancellationGateway({...opts,fetchImpl:async()=>({...success(),redirected:true})});
 assert.equal((await gateway.cancel(trip,key)).code,'UNTRUSTED_REDIRECT');
});
test('reembolso, comisión, monto o respuesta no persistida no pasan DTO',async()=>{
 for(const dto of [
  {...payload,refundGs:20000},{...payload,serverPersisted:false},
  {...payload,tripId:a},{...payload,event:'refund'},
  {...payload,commercialRidesEnabled:true}, {...payload,mode:'LIVE'}
 ]){
  const gateway=createRideCancellationGateway({...opts,fetchImpl:async()=>({...success(),text:async()=>JSON.stringify(dto)})});
  assert.equal((await gateway.cancel(trip,key)).code,'INVALID_CANCEL_RECEIPT');
 }
});
test('403 de la sesión anterior nunca cierra la sesión siguiente',async()=>{
 let resume,actor=session(),revocations=0;
 const promise=new Promise(resolve=>resume=resolve);
 const gateway=createRideCancellationGateway({...opts,getSession:async()=>actor,
  onSessionInvalid:()=>revocations++,fetchImpl:async()=>promise});
 const task=gateway.cancel(trip,key);
 await Promise.resolve();await Promise.resolve();
 actor={...actor,authRevision:4};
 resume({ok:false,status:403,redirected:false});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(revocations,0);
});
test('respuesta 200 después de cambio de pasajero se descarta',async()=>{
 let resume,actor=session();
 const promise=new Promise(resolve=>resume=resolve);
 const gateway=createRideCancellationGateway({...opts,getSession:async()=>actor,
  fetchImpl:async()=>promise});
 const task=gateway.cancel(trip,key);
 await Promise.resolve();await Promise.resolve();
 actor={...actor,subject:'123e4567-e89b-42d3-a456-426614174099'};
 resume(success());
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
});
test('controller doble tap, misma requestKey y reintento solo tras error de red',async()=>{
 let calls=0,resume;
 const pending=new Promise(r=>resume=r),sent=[];
 const gateway={isConfigured:()=>true,cancel:async (id,k)=>{
  sent.push([id,k]);calls++;return calls===1?pending:{ok:true};
 }};
 const c=createRideCancellationController({gateway,getSession:async()=>session()});
 assert.equal(c.prepare({tripId:trip,requestKey:key,subject:a}).ok,true);
 const first=c.submit(),second=c.submit();
 assert.equal((await second).code,'NO_READY_CANCEL');
 await Promise.resolve();await Promise.resolve();
 resume({ok:false,code:'NETWORK_OR_TIMEOUT'});
 assert.equal((await first).code,'NETWORK_OR_TIMEOUT');
 assert.equal((await c.submit()).code,'EXPLICIT_RETRY_REQUIRED');
 assert.equal((await c.retry()).ok,true);
 assert.deepEqual(sent,[[trip,key],[trip,key]]);
 assert.equal(c.snapshot().phase,'acknowledged');
});
test('controller descarta ACK antiguo tras logout',async()=>{
 let resume;
 const wait=new Promise(r=>resume=r);
 const c=createRideCancellationController({
  gateway:{isConfigured:()=>true,cancel:async()=>wait},getSession:async()=>session()
 });
 c.prepare({tripId:trip,requestKey:key,subject:a});
 const old=c.submit();
 await Promise.resolve();await Promise.resolve();
 c.clear();resume({ok:true});
 assert.equal((await old).code,'STALE_RESPONSE_IGNORED');
 assert.equal(c.snapshot().phase,'idle');
});
test('sin respuesta 200 válida, 409 exige refrescar estado y no inventa cancelación',async()=>{
 const gw=createRideCancellationGateway({...opts,fetchImpl:async()=>({ok:false,status:409,redirected:false})});
 assert.equal((await gw.cancel(trip,key)).code,'CONFLICT_RELOAD_TRIP');
});

test('timeout nunca permite preparar cancelación con un segundo eventKey',async()=>{
 const keys=[];
 const gateway={isConfigured:()=>true,cancel:async (_id,k)=>{
  keys.push(k);return keys.length===1?{ok:false,code:'NETWORK_OR_TIMEOUT'}:{ok:true};
 }};
 const c=createRideCancellationController({gateway,getSession:async()=>session()});
 assert.equal(c.prepare({tripId:trip,requestKey:key,subject:a}).ok,true);
 assert.equal((await c.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal(c.prepare({tripId:trip,requestKey:event,subject:a}).code,'EXPLICIT_RETRY_REQUIRED');
 assert.equal((await c.retry()).ok,true);
 assert.deepEqual(keys,[key,key]);
 assert.equal(c.prepare({tripId:trip,requestKey:event,subject:a}).code,'ALREADY_ACKNOWLEDGED');
});
test('409 exige lectura autoritativa y bloquea nueva clave para el mismo viaje',async()=>{
 const c=createRideCancellationController({
  gateway:{isConfigured:()=>true,cancel:async()=>({ok:false,code:'CONFLICT_RELOAD_TRIP',status:409})},
  getSession:async()=>session()
 });
 c.prepare({tripId:trip,requestKey:key,subject:a});
 assert.equal((await c.submit()).code,'CONFLICT_RELOAD_TRIP');
 assert.equal(c.prepare({tripId:trip,requestKey:event,subject:a}).code,'RELOAD_TRIP_BEFORE_NEW_CANCEL');
});

test('cancelación que retorna 200 tras plazo no confirma evento ni recibo',async()=>{
 let tick=t;
 const g=createRideCancellationGateway({...opts,now:()=>tick,timeoutMs:1000,
  fetchImpl:async()=>{tick+=1001;return success();}});
 assert.equal((await g.cancel(trip,key)).code,'NETWORK_OR_TIMEOUT');
});
test('cancelación 401 tardía no revoca identidad vigente',async()=>{
 let tick=t,invalid=0;
 const g=createRideCancellationGateway({...opts,now:()=>tick,timeoutMs:1000,
  onSessionInvalid:()=>invalid++,
  fetchImpl:async()=>{tick+=1001;return {status:401,ok:false,redirected:false};}});
 assert.equal((await g.cancel(trip,key)).code,'NETWORK_OR_TIMEOUT');
 assert.equal(invalid,0);
});
test('cancelación con body tardío no se confirma',async()=>{
 let tick=t;
 const g=createRideCancellationGateway({...opts,now:()=>tick,timeoutMs:1000,
  fetchImpl:async()=>({...success(),text:async()=>{
   tick+=1001;return JSON.stringify(payload);}})});
 assert.equal((await g.cancel(trip,key)).code,'NETWORK_OR_TIMEOUT');
});
test('respuesta de cancelación Unicode > 8KB falla cerrada',async()=>{
 const g=createRideCancellationGateway({...opts,fetchImpl:async()=>({
  ...success(),text:async()=>JSON.stringify({...payload,extra:'á'.repeat(4300)})
 })});
 assert.equal((await g.cancel(trip,key)).code,'BAD_SERVER_RESPONSE');
});
test('el controlador conserva la misma clave en un timeout del gateway real',async()=>{
 let tick=t,attempt=0;const seen=[];
 const real=createRideCancellationGateway({...opts,now:()=>tick,timeoutMs:1000,
  fetchImpl:async(_url,req)=>{
   attempt++;seen.push(JSON.parse(req.body).requestKey);
   if(attempt===1){tick+=1001;return success();}
   return success();
  }});
 const c=createRideCancellationController({gateway:real,getSession:async()=>session()});
 assert.equal(c.prepare({tripId:trip,requestKey:key,subject:a}).ok,true);
 assert.equal((await c.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal(c.snapshot().phase,'retryable');
 assert.equal((await c.retry()).ok,true);
 assert.deepEqual(seen,[key,key]);
});
