import test from 'node:test';
import assert from 'node:assert/strict';
import {createIncidentReportFlow} from './incident-report-flow.mjs';
const t=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const actor=()=>({subject:id(1),role:'passenger',sessionRevision:7});
const request={requestKey:id(2),subjectKind:'RIDE',subjectId:id(3),
 category:'QUALITY',severity:'LOW'};
const receipt={incidentId:id(4),receiptId:id(5),state:'open',revision:1,
 createdAt:new Date(t-1000).toISOString(),observedAt:new Date(t).toISOString(),
 receiptStatus:'RECEIVED_IN_QA_DATABASE_ONLY'};
const answer=(dto=receipt)=>({ok:true,qaDatabaseOnly:true,sosDispatched:false,
 operatorNotified:false,receipt:dto});
const make=(gateway,context=async()=>actor())=>createIncidentReportFlow({
 gateway,getActor:context,now:()=>t
});
const gateway=(send=async()=>answer(),read=async()=>answer())=>({
 isConfigured:()=>true,report:send,status:read
});
test('sin contrato G40 activo, no permite preparar reporte',()=>{
 const flow=make({isConfigured:()=>false});
 assert.equal(flow.prepare({request,subject:id(1),sessionRevision:7}).code,'INCIDENT_RUNTIME_NOT_CERTIFIED');
 assert.equal(flow.snapshot().phase,'idle');
});
test('preparación no envía ni publica datos de viaje como remitente',()=>{
 const f=make(gateway());
 assert.equal(f.prepare({request,subject:id(1),sessionRevision:7}).ok,true);
 const snap=f.snapshot();
 assert.equal(snap.phase,'ready');assert.equal(snap.receipt,null);
 assert.equal(JSON.stringify(snap).includes(request.subjectId),false);
 assert.equal(snap.sosDispatched,false);
 assert.equal(f.discard().ok,true);assert.equal(f.snapshot().phase,'idle');
});
test('un recibo válido significa persistencia QA, no SOS ni atención',async()=>{
 const f=make(gateway());f.prepare({request,subject:id(1),sessionRevision:7});
 assert.equal((await f.submit()).ok,true);
 const snap=f.snapshot();
 assert.equal(snap.phase,'acknowledged');assert.equal(snap.receipt.incidentId,id(4));
 assert.equal(snap.qaDatabaseOnly,true);assert.equal(snap.operatorNotified,false);
 assert.equal(f.discard().code,'NOT_UNSENT_INCIDENT');
 assert.equal(f.prepare({request,subject:id(1),sessionRevision:7}).code,'ALREADY_RECEIVED_IN_QA');
});
test('timeout: reintento explícito conserva la misma requestKey sin segundo incidente',async()=>{
 const keys=[];let calls=0;
 const g=gateway(async payload=>{
  keys.push(payload.requestKey);calls++;
  return calls===1?{ok:false,code:'NETWORK_OR_TIMEOUT'}:answer();
 });
 const f=make(g);f.prepare({request,subject:id(1),sessionRevision:7});
 assert.equal((await f.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal(f.discard().code,'NOT_UNSENT_INCIDENT');
 assert.equal(f.prepare({request:{...request,requestKey:id(6)},subject:id(1),sessionRevision:7}).code,'EXPLICIT_RETRY_REQUIRED');
 assert.equal((await f.submit()).code,'EXPLICIT_RETRY_REQUIRED');
 assert.equal((await f.retry()).ok,true);
 assert.deepEqual(keys,[id(2),id(2)]);
});
test('409 no admite cambiar clave ni fingir registro',async()=>{
 const f=make(gateway(async()=>({ok:false,code:'RECONCILE_SAME_REQUEST_KEY'})));
 f.prepare({request,subject:id(1),sessionRevision:7});
 assert.equal((await f.submit()).code,'RECONCILE_SAME_REQUEST_KEY');
 assert.equal(f.snapshot().receipt,null);assert.equal(f.snapshot().phase,'failed');
 assert.equal(f.prepare({request,subject:id(1),sessionRevision:7}).code,'RECONCILIATION_REQUIRED');
});
test('recibos falsos o flags SOS se rechazan',async()=>{
 for(const r of [
  {...answer(),sosDispatched:true},
  {...answer(),qaDatabaseOnly:false},
  answer({...receipt,ownerId:id(1)}),
  answer({...receipt,receiptStatus:'RECEIVED_BY_OPERATOR'})
 ]){
  const f=make(gateway(async()=>r));f.prepare({request,subject:id(1),sessionRevision:7});
  assert.equal((await f.submit()).code,'INVALID_INCIDENT_RECEIPT');
  assert.equal(f.snapshot().receipt,null);
 }
});
test('logout mientras hay POST descarta recibo tardío',async()=>{
 let resume;const pending=new Promise(done=>resume=done);
 const f=make(gateway(async()=>pending));f.prepare({request,subject:id(1),sessionRevision:7});
 const result=f.submit();await Promise.resolve();await Promise.resolve();
 f.clear();resume(answer());
 assert.equal((await result).code,'STALE_RESPONSE_IGNORED');
 assert.equal(f.snapshot().receipt,null);assert.equal(f.snapshot().phase,'idle');
});
test('cambio de JWT de misma cuenta descarta el ACK anterior',async()=>{
 let active=actor(),resume;
 const pending=new Promise(done=>resume=done);
 const f=make(gateway(async()=>pending),async()=>active);
 f.prepare({request,subject:id(1),sessionRevision:7});
 const result=f.submit();await Promise.resolve();await Promise.resolve();
 active={...active,sessionRevision:8};resume(answer());
 assert.equal((await result).code,'SESSION_CHANGED');
 assert.equal(f.snapshot().phase,'idle');
});
test('rechaza doble tap sin duplicar POST',async()=>{
 let resume,hits=0;const pending=new Promise(done=>resume=done);
 const f=make(gateway(async()=>{hits++;return pending;}));
 f.prepare({request,subject:id(1),sessionRevision:7});
 const first=f.submit();
 assert.equal((await f.submit()).code,'NO_READY_INCIDENT');
 await Promise.resolve();await Promise.resolve();
 resume(answer());assert.equal((await first).ok,true);assert.equal(hits,1);
});
test('GET confirma misma identidad, revisiones y receiptId',async()=>{
 let observed;
 const next={...receipt,state:'investigating',revision:3,
  observedAt:new Date(t+1000).toISOString()};
 const f=make(gateway(async()=>answer(),async (idArg,rev)=>{
  observed=[idArg,rev];return answer(next);
 }));
 f.prepare({request,subject:id(1),sessionRevision:7});
 await f.submit();
 assert.equal((await f.refresh()).ok,true);
 assert.deepEqual(observed,[id(4),1]);
 assert.equal(f.snapshot().receipt.revision,3);assert.equal(f.snapshot().statusFresh,true);
});
test('GET con revisión obsoleta u otro recibo no reemplaza el estado conocido',async()=>{
 for(const invalid of [
  {...receipt,revision:0},{...receipt,incidentId:id(9)},
  {...receipt,receiptId:id(7)}
 ]){
  const f=make(gateway(async()=>answer(),async()=>answer(invalid)));
  f.prepare({request,subject:id(1),sessionRevision:7});
  await f.submit();
  assert.equal((await f.refresh()).ok,false);
  assert.equal(f.snapshot().receipt.revision,1);
  assert.equal(f.snapshot().statusFresh,false);
 }
});
test('nueva sesión al consultar status borra detalles privados',async()=>{
 let active=actor(),resume;
 const pending=new Promise(done=>resume=done);
 const f=make(gateway(async()=>answer(),async()=>pending),async()=>active);
 f.prepare({request,subject:id(1),sessionRevision:7});await f.submit();
 const checking=f.refresh();await Promise.resolve();await Promise.resolve();
 active={...active,subject:id(8)};resume(answer());
 assert.equal((await checking).code,'SESSION_CHANGED');
 assert.equal(f.snapshot().receipt,null);
});
test('no acepta campos de reporte extra, severidad crítica ni actor inválido',async()=>{
 const f=make(gateway());
 for(const body of [{...request,description:'PII'},{...request,severity:'CRITICAL'},
  {...request,subjectId:'bad'}]){
  assert.equal(f.prepare({request:body,subject:id(1),sessionRevision:7}).code,'INVALID_INPUT');
 }
 assert.equal(f.prepare({request,subject:id(1),sessionRevision:-1}).code,'INVALID_INPUT');
});
