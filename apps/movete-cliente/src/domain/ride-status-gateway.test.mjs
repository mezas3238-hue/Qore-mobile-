import test from 'node:test';
import assert from 'node:assert/strict';
import {createRiderStatusGateway} from './ride-status-gateway.mjs';

const clock=1800000000000,subject='123e4567-e89b-42d3-a456-426614174000';
const trip='123e4567-e89b-42d3-a456-426614174001';
const other='123e4567-e89b-42d3-a456-426614174002';
const auth=()=>({subject,role:'passenger',authRevision:4,
 token:'synthetic-passenger-jwt-long-token',expiresAt:clock+90000});
const event={source:'server',tripId:trip,passengerId:subject,serverRevision:2,
 trackingSequence:5,status:'accepted',acceptedDriver:null,tracking:null};
const data=()=>({tripId:trip,ownerId:subject,revision:2,state:'assigned',
 assignmentPersisted:true,driver:{verified:true,displayName:'Chofer QA'},
 vehicle:{kind:'AUTO',plate:'QA-2026'},gpsConsent:true,
 location:{latitude:-25.3,longitude:-57.6,observedAt:clock-1000},
 etaVerified:true,etaMinutes:4,mode:'STAGING_DEMO_ONLY',
 commercialRidesEnabled:false,event,locationVisible:true,deliveryConfirmed:false});
const result=payload=>({ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(payload)});
const config={enabled:true,contractCertified:true,
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 now:()=>clock,getSession:async()=>auth(),fetchImpl:async()=>result(data())};
test('fail-closed: sin certificado no existe GET ni GPS',async()=>{
 let calls=0;
 const gw=createRiderStatusGateway({...config,enabled:false,fetchImpl:async()=>{calls++;return result(data());}});
 assert.equal(gw.isConfigured(),false);
 assert.equal((await gw.fetchStatus(trip)).code,'STATUS_CONTRACT_PENDING');
 assert.equal(calls,0);
});
test('únicamente GET status propio, JWT Passenger y sin identidad en la URL',async()=>{
 let call;
 const gw=createRiderStatusGateway({...config,fetchImpl:async(url,req)=>{call={url,req};return result(data());}});
 const r=await gw.fetchStatus(trip);
 assert.equal(r.ok,true);
 assert.equal(r.data.driver.displayName,'Chofer QA');
 assert.equal(call.url,'https://staging.example.invalid/v1/staging/rider/trips/'+trip+'/status');
 assert.equal(call.req.method,'GET');
 assert.equal(call.req.credentials,'omit');assert.equal(call.req.cache,'no-store');
 assert.equal(call.req.redirect,'error');assert.equal(call.req.referrerPolicy,'no-referrer');
 assert.equal(call.req.headers.Authorization,'Bearer '+auth().token);
 assert.equal(Object.hasOwn(call.req,'body'),false);
});
test('rechaza inyección en ID, HTTP, origin con credenciales o puertos',async()=>{
 for(const id of [other+'/..','../../admin','',null]){
  assert.equal((await createRiderStatusGateway(config).fetchStatus(id)).code,'INVALID_TRIP_ID');
 }
 for(const origin of ['http://staging.example.invalid','https://other.invalid',
  'https://u@staging.example.invalid','https://staging.example.invalid/path',
  'https://staging.example.invalid:9999','https://staging.example.invalid/?x=y']){
  assert.equal(createRiderStatusGateway({...config,origin}).isConfigured(),false);
 }
});
test('rechaza driver/admin/token caducado y sujeto falso sin red',async()=>{
 let calls=0;
 for(const user of [{...auth(),role:'driver'},{...auth(),role:'admin'},
  {...auth(),expiresAt:clock},{...auth(),subject:'bad'},
  {...auth(),token:'small'}]){
  const gw=createRiderStatusGateway({...config,getSession:async()=>user,
    fetchImpl:async()=>{calls++;return result(data());}});
  assert.equal((await gw.fetchStatus(trip)).code,'AUTH_REQUIRED');
 }
 assert.equal(calls,0);
});
test('rechaza DTO ajeno, otro viaje, GPS vencido, flags contradictorios y propiedades extra',async()=>{
 for(const payload of [
  {...data(),ownerId:other},{...data(),tripId:other},
  {...data(),location:{...data().location,observedAt:clock-31000}},
  {...data(),state:'searching'},
  {...data(),locationVisible:false},
  {...data(),mode:'LIVE'},
  {...data(),driver:{verified:false,displayName:'X'}},
  {...data(),trackingKey:'private'},
  {...data(),event:{...event,passengerId:other}}
 ]){
  const gw=createRiderStatusGateway({...config,fetchImpl:async()=>result(payload)});
  assert.equal((await gw.fetchStatus(trip)).code,'INVALID_SERVER_SNAPSHOT');
 }
});
test('sin GPS la respuesta permite status seguro y sin ubicación',async()=>{
 const payload={...data(),gpsConsent:false,locationVisible:false,
  location:null,etaMinutes:null,etaVerified:false};
 const gw=createRiderStatusGateway({...config,fetchImpl:async()=>result(payload)});
 assert.equal((await gw.fetchStatus(trip)).ok,true);
});
test('403 obsoleto jamás invalida el token nuevo de la misma cuenta',async()=>{
 let current=auth(),release,invalid=0;
 const pending=new Promise(resolve=>release=resolve);
 const gw=createRiderStatusGateway({...config,getSession:async()=>current,
  fetchImpl:async()=>pending,onSessionInvalid:()=>invalid++});
 const task=gw.fetchStatus(trip);
 await Promise.resolve();await Promise.resolve();
 current={...current,authRevision:5};
 release({ok:false,status:403,redirected:false});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(invalid,0);
});
test('respuesta 200 tardía después de logout o rotación no restituye datos',async()=>{
 let current=auth(),release;
 const pending=new Promise(resolve=>release=resolve);
 const gw=createRiderStatusGateway({...config,getSession:async()=>current,fetchImpl:async()=>pending});
 const task=gw.fetchStatus(trip);
 await Promise.resolve();await Promise.resolve();
 current={...current,token:'new-synthetic-passenger-long-token'};
 release(result(data()));
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
});
test('doble GET concurrente y 401/403 manejados sin filtrar estado',async()=>{
 let release,calls=0;
 const pending=new Promise(resolve=>release=resolve);
 const gw=createRiderStatusGateway({...config,fetchImpl:async()=>{calls++;return pending;}});
 const first=gw.fetchStatus(trip);
 assert.equal((await gw.fetchStatus(trip)).code,'STATUS_READ_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();
 assert.equal(calls,1);
 release(result(data()));
 assert.equal((await first).ok,true);
 for(const status of [401,403]){
  let revoked=0;
  const x=createRiderStatusGateway({...config,onSessionInvalid:()=>revoked++,
   fetchImpl:async()=>({status,ok:false,redirected:false})});
  assert.equal((await x.fetchStatus(trip)).status,status);
  assert.equal(revoked,1);
 }
});
test('errores HTTP, red, contenido y tamaño fallan cerrados',async()=>{
 const candidates=[
  [{status:404,ok:false,redirected:false},'TRIP_NOT_FOUND'],
  [{status:429,ok:false,redirected:false},'RATE_LIMITED'],
  [{status:503,ok:false,redirected:false},'SERVICE_UNAVAILABLE'],
  [{...result(data()),redirected:true},'UNTRUSTED_REDIRECT'],
  [{...result(data()),headers:{get:()=> 'text/html'}},'BAD_CONTENT_TYPE'],
  [{...result(data()),text:async()=>JSON.stringify([])},'INVALID_SERVER_SNAPSHOT'],
  [{...result(data()),text:async()=> 'a'.repeat(33000)},'RESPONSE_TOO_LARGE']
 ];
 for(const [reply,code] of candidates){
  const gw=createRiderStatusGateway({...config,fetchImpl:async()=>reply});
  assert.equal((await gw.fetchStatus(trip)).code,code);
 }
 const offline=createRiderStatusGateway({...config,fetchImpl:async()=>{throw Error('no network');}});
 assert.equal((await offline.fetchStatus(trip)).code,'NETWORK_OR_TIMEOUT');
});
