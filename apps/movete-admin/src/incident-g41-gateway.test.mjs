import test from 'node:test';
import assert from 'node:assert/strict';
import {createIncidentTriageG41Gateway,projectG41TriagePage} from './incident-g41-gateway.mjs';
const t=1800000000000;
const uuid=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const actor=()=>({subject:uuid(99),role:'admin',mfaVerified:true,
 token:'synthetic-not-production-token',authRevision:2,expiresAt:t+90000});
const row=(n,changes={})=>({incidentId:uuid(n),category:'SAFETY',severity:'HIGH',
 status:'OPEN',createdAt:t-n*1000,revision:n,...changes});
const data=(items=[row(1)],extra={})=>({
 scope:'admin.incidents.read',priorityOrder:'SEVERITY_THEN_NEWEST',
 severityFilter:null,statusFilter:null,revision:3,items,nextCursor:null,
 generatedAt:t-1000,expiresAt:t+60000,snapshotConsistent:false,
 productionEnabled:false,...extra
});
const response=payload=>({ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(payload)});
const config={enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 getSession:async()=>actor(),fetchImpl:async()=>response(data()),now:()=>t};
test('sin evidencia de despliegue STAGING G41 no hace HTTP nunca',async()=>{
 let hits=0;
 const gw=createIncidentTriageG41Gateway({...config,stagingRuntimeVerified:false,
  fetchImpl:async()=>{hits++;return response(data());}});
 assert.equal(gw.isConfigured(),false);
 assert.equal((await gw.fetchPage()).code,'G41_RUNTIME_NOT_CERTIFIED');
 assert.equal(hits,0);
});
test('filtro GLOBAL servidor aparece exclusivamente en query segura',async()=>{
 let url,options;
 const filtered=data([row(1,{severity:'CRITICAL'})],
  {severityFilter:'CRITICAL',nextCursor:'x'.repeat(44)});
 const gw=createIncidentTriageG41Gateway({...config,
  fetchImpl:async(u,o)=>{url=u;options=o;return response(filtered);}});
 assert.equal((await gw.fetchPage({severityFilter:'CRITICAL'})).ok,true);
 assert.equal(url,'https://staging.example.invalid/v1/staging/admin/incidents/triage-queue?severity=CRITICAL');
 assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');
 assert.equal(options.headers.Authorization,'Bearer '+actor().token);
 assert.equal(Object.hasOwn(options,'body'),false);
});
test('no acepta filtro inyectado, cursor malicioso ni rol Owner',async()=>{
 let hits=0;
 const gw=createIncidentTriageG41Gateway({...config,fetchImpl:async()=>{
  hits++;return response(data());
 }});
 for(const args of [{severityFilter:'CRITICAL&role=owner'},
  {statusFilter:'OPEN?'},{cursor:'../../admin'}, {cursor:'a'.repeat(385)}])
  assert.equal((await gw.fetchPage(args)).code,'INVALID_FILTER_OR_CURSOR');
 assert.equal(hits,0);
 const owner=createIncidentTriageG41Gateway({...config,
  getSession:async()=>({...actor(),role:'owner'}),
  fetchImpl:async()=>{hits++;return response(data());}});
 assert.equal((await owner.fetchPage()).code,'FORBIDDEN');assert.equal(hits,0);
});
test('proyección rechaza filas con PII extra, colisiones y filtros inconsistentes',()=>{
 for(const page of [
  data([{...row(1),reporterName:'Juan'}]),
  data([row(1),row(1)]),
  data([row(1,{severity:'INVALID'})]),
  data([row(1)],{severityFilter:'CRITICAL'}),
  data([row(1)],{productionEnabled:true}),
  data([row(1)],{nextCursor:'fake'}),
  data([row(1)],{snapshotConsistent:true})
 ])assert.equal(projectG41TriagePage(page,{now:t}),null);
});
test('ordena 50 máximo por página, no topa plataforma en 50 registros',()=>{
 const one=Array.from({length:50},(_,i)=>row(i+1));
 const next=Array.from({length:50},(_,i)=>row(i+51));
 assert.equal(projectG41TriagePage(data(one),{now:t}).items.length,50);
 assert.equal(projectG41TriagePage(data(next),{now:t}).items.length,50);
 assert.equal(projectG41TriagePage(data([...one,row(51)]),{now:t}),null);
});
test('orden incorrecto de prioridad no se presenta como global verificado',()=>{
 assert.equal(projectG41TriagePage(data([
  row(1,{severity:'LOW'}),row(2,{severity:'CRITICAL'})
 ]),{now:t}),null);
 assert.equal(projectG41TriagePage(data([
  row(3,{createdAt:t-3000}),row(2,{createdAt:t-2000})
 ]),{now:t}),null);
});
test('cambio de cuenta durante GET descarta datos viejos',async()=>{
 let active=actor(),release;
 const waiting=new Promise(r=>release=r);
 const g=createIncidentTriageG41Gateway({...config,
  getSession:async()=>active,fetchImpl:async()=>waiting});
 const pending=g.fetchPage();await Promise.resolve();await Promise.resolve();
 active={...active,subject:uuid(88)};
 release(response(data()));
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
});
test('401 tardío tras rotación MFA no revoca nueva sesión',async()=>{
 let active=actor(),release,invalid=0;
 const waiting=new Promise(r=>release=r);
 const g=createIncidentTriageG41Gateway({...config,getSession:async()=>active,
  onSessionInvalid:()=>invalid++,fetchImpl:async()=>waiting});
 const pending=g.fetchPage();await Promise.resolve();await Promise.resolve();
 active={...active,authRevision:3};
 release({status:401,ok:false,redirected:false});
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
 assert.equal(invalid,0);
});
test('streaming de página G41 soporta filtro autoritativo y UTF8',async()=>{
 const body=JSON.stringify(data([row(1)]));
 const bytes=new TextEncoder().encode(body);
 const g=createIncidentTriageG41Gateway({...config,fetchImpl:async()=>({
  ...response(data()),body:new ReadableStream({start(c){
   c.enqueue(bytes.slice(0,8));c.enqueue(bytes.slice(8));c.close();
  }}),text:async()=>{throw Error('sin buffer texto');}
 })});
 const result=await g.fetchPage();
 assert.equal(result.ok,true);
 assert.equal(result.page.scope,'SERVER_FILTERED_PAGE_ONLY');
 assert.equal(result.page.hasGlobalTotal,false);
 assert.equal(result.page.emergencyDispatchEnabled,false);
});
test('timeout no muestra cola de incidentes tardía',async()=>{
 let tick=t;
 const g=createIncidentTriageG41Gateway({...config,now:()=>tick,timeoutMs:1000,
  fetchImpl:async()=>{tick+=1001;return response(data());}});
 assert.equal((await g.fetchPage()).code,'NETWORK_OR_TIMEOUT');
});
test('GET siguiente usa cursor firmado por A con contexto de filtro',async()=>{
 const cur='s'.repeat(50);
 const filtered=data([row(1,{status:'OPEN'})],
  {statusFilter:'OPEN',nextCursor:null});
 let url;
 const g=createIncidentTriageG41Gateway({...config,fetchImpl:async(u)=>{
  url=u;return response(filtered);
 }});
 assert.equal((await g.fetchPage({statusFilter:'OPEN',cursor:cur})).ok,true);
 assert.equal(url,'https://staging.example.invalid/v1/staging/admin/incidents/triage-queue?status=OPEN&cursor='+cur);
});

test('gateway G41 cancela el fetch viejo y permite GET de sesión nueva',async()=>{
 let releaseOld,firstSignal,hits=0;
 const hanging=new Promise(resolve=>{releaseOld=resolve;});
 const g=createIncidentTriageG41Gateway({...config,
  fetchImpl:async(_url,opts)=>{
   hits++;
   if(hits===1){firstSignal=opts.signal;return hanging;}
   return response(data());
  }
 });
 const old=g.fetchPage();
 await Promise.resolve();await Promise.resolve();
 assert.equal(hits,1);
 assert.equal((await g.fetchPage()).code,'TRIAGE_READ_IN_FLIGHT');
 g.cancelPending();
 assert.equal(firstSignal.aborted,true);
 const current=await g.fetchPage();
 assert.equal(current.ok,true);
 assert.equal(hits,2);
 releaseOld(response(data()));
 assert.equal((await old).code,'STALE_SESSION_RESPONSE');
 const subsequent=await g.fetchPage();
 assert.equal(subsequent.ok,true);
});
test('G41 revocado mientras Auth espera no realiza GET tardío',async()=>{
 let release,hits=0;
 const waiting=new Promise(resolve=>{release=resolve;});
 const g=createIncidentTriageG41Gateway({...config,
  getSession:()=>waiting,
  fetchImpl:async()=>{hits++;return response(data());}
 });
 const task=g.fetchPage();
 g.cancelPending();release(actor());
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(hits,0);
});
