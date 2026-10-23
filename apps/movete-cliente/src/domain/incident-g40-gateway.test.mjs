import test from 'node:test';
import assert from 'node:assert/strict';
import {createIncidentG40Gateway,projectQaIncidentReceipt} from './incident-g40-gateway.mjs';
const t=1800000000000;
const passenger='123e4567-e89b-42d3-a456-426614174001';
const incident='123e4567-e89b-42d3-a456-426614174002';
const receipt='123e4567-e89b-42d3-a456-426614174003';
const subject='123e4567-e89b-42d3-a456-426614174004';
const requestKey='123e4567-e89b-42d3-a456-426614174005';
const actor=()=>({subject:passenger,role:'passenger',authRevision:1,
 token:'synthetic-long-jwt-not-live',expiresAt:t+90000,sessionRevision:3});
const request={requestKey,subjectKind:'RIDE',subjectId:subject,category:'QUALITY',severity:'LOW'};
const dto={incidentId:incident,receiptId:receipt,state:'open',revision:1,
 createdAt:new Date(t-1000).toISOString(),observedAt:new Date(t).toISOString(),
 receiptStatus:'RECEIVED_IN_QA_DATABASE_ONLY'};
const answer=(status=201,payload=dto)=>({ok:true,status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(payload)});
const config={enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 getSession:async()=>actor(),fetchImpl:async()=>answer(),now:()=>t};
test('G41 esquema no desplegado significa CERO POST/GET por defecto',async()=>{
 let hits=0;
 const g=createIncidentG40Gateway({...config,stagingRuntimeVerified:false,
  fetchImpl:async()=>{hits++;return answer();}});
 assert.equal(g.isConfigured(),false);
 assert.equal((await g.report(request)).code,'INCIDENT_RUNTIME_NOT_CERTIFIED');
 assert.equal((await g.status(incident)).code,'INCIDENT_RUNTIME_NOT_CERTIFIED');
 assert.equal(hits,0);
});
test('POST tipado G40 nunca transporta descripción, GPS, SOS, pasajero o PII',async()=>{
 let call;
 const g=createIncidentG40Gateway({...config,fetchImpl:async(u,opts)=>{
  call={u,opts};return answer();
 }});
 const r=await g.report(request,3);
 assert.equal(r.ok,true);assert.equal(r.qaDatabaseOnly,true);
 assert.equal(r.sosDispatched,false);assert.equal(r.operatorNotified,false);
 assert.equal(r.receipt.receiptStatus,'RECEIVED_IN_QA_DATABASE_ONLY');
 assert.equal(call.u,'https://staging.example.invalid/v1/staging/safety/incidents/report');
 assert.equal(call.opts.method,'POST');assert.equal(call.opts.credentials,'omit');
 assert.equal(call.opts.redirect,'error');assert.equal(call.opts.cache,'no-store');
 assert.equal(call.opts.headers.Authorization,'Bearer '+actor().token);
 assert.deepEqual(JSON.parse(call.opts.body),request);
 assert.equal(Object.hasOwn(JSON.parse(call.opts.body),'description'),false);
});
test('G40 rechaza crítico, severidad SOS, campos extra y categorías cliente ambiguas',async()=>{
 let hits=0;
 const g=createIncidentG40Gateway({...config,fetchImpl:async()=>{hits++;return answer();}});
 for(const invalid of [
  {...request,severity:'CRITICAL'},{...request,severity:'SOS'},
  {...request,category:'RIDE'},{...request,description:'nombre y teléfono'},
  {...request,reporterId:passenger},{...request,subjectId:'invalid'}
 ])assert.equal((await g.report(invalid)).code,'INVALID_INPUT');
 assert.equal(hits,0);
});
test('GET status propio con ID UUID y revisión monotónica exacta',async()=>{
 let call;
 const g=createIncidentG40Gateway({...config,fetchImpl:async(u,o)=>{
  call={u,o};return answer(200);
 }});
 const r=await g.status(incident,1);
 assert.equal(r.ok,true);assert.equal(r.receipt.incidentId,incident);
 assert.equal(call.u,'https://staging.example.invalid/v1/staging/safety/incidents/'+incident+'/status');
 assert.equal(call.o.method,'GET');assert.equal(Object.hasOwn(call.o,'body'),false);
 assert.equal((await g.status('invalid')).code,'INVALID_INPUT');
});
test('recibo requiere siete propiedades, sello QA, tiempo con zona y revisión',()=>{
 for(const invalid of [
  {...dto,secret:'jwt'},{...dto,receiptStatus:'SOS_SENT'},
  {...dto,revision:0},{...dto,incidentId:'wrong'},
  {...dto,createdAt:'2026-01-01T00:00:00'},
  {...dto,observedAt:new Date(t-2000).toISOString()}
 ])assert.equal(projectQaIncidentReceipt(invalid,{now:t,incidentId:incident}),null);
 assert.equal(projectQaIncidentReceipt(dto,{now:t,minimumRevision:2}),null);
 assert.equal(Object.isFrozen(projectQaIncidentReceipt(dto,{now:t})),true);
});
test('403 de JWT cambiado nunca revoca token vigente ni entrega incidente viejo',async()=>{
 let current=actor(),release,revoked=0;
 const pending=new Promise(r=>release=r);
 const g=createIncidentG40Gateway({...config,
  getSession:async()=>current,onSessionInvalid:()=>revoked++,fetchImpl:async()=>pending});
 const task=g.report(request);
 await Promise.resolve();await Promise.resolve();
 current={...current,authRevision:2};
 release({status:403,ok:false,redirected:false});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');assert.equal(revoked,0);
});
test('bloquea doble POST mientras primera solicitud está pendiente',async()=>{
 let release,hits=0;
 const pending=new Promise(r=>release=r);
 const g=createIncidentG40Gateway({...config,fetchImpl:async()=>{hits++;return pending;}});
 const first=g.report(request);
 assert.equal((await g.report(request)).code,'INCIDENT_OPERATION_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();
 release(answer());
 assert.equal((await first).ok,true);assert.equal(hits,1);
});
test('409 no crea otra requestKey ni confirma caso',async()=>{
 const g=createIncidentG40Gateway({...config,fetchImpl:async()=>({status:409,ok:false,redirected:false})});
 assert.equal((await g.report(request)).code,'RECONCILE_SAME_REQUEST_KEY');
});
test('streaming UTF-8 valida recibo sin llamar text()',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify(dto));
 const g=createIncidentG40Gateway({...config,fetchImpl:async()=>({
  ...answer(),body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}}),
  text:async()=>{throw Error('text() no permitido');}
 })});
 assert.equal((await g.report(request)).ok,true);
});
test('recibo fuera de plazo no declara incidente recibido',async()=>{
 let tick=t;
 const g=createIncidentG40Gateway({...config,now:()=>tick,timeoutMs:1000,
  fetchImpl:async()=>{tick+=1001;return answer();}});
 assert.equal((await g.report(request)).code,'NETWORK_OR_TIMEOUT');
});
test('HTTPS pin, JWT Passenger y rol denegado',async()=>{
 for(const origin of ['http://staging.example.invalid','https://evil.invalid',
  'https://user@staging.example.invalid','https://staging.example.invalid/path'])
  assert.equal(createIncidentG40Gateway({...config,origin}).isConfigured(),false);
 let calls=0;
 const denied=createIncidentG40Gateway({...config,getSession:async()=>({...actor(),role:'driver'}),
  fetchImpl:async()=>{calls++;return answer();}});
 assert.equal((await denied.report(request)).code,'AUTH_REQUIRED');
 assert.equal(calls,0);
});
