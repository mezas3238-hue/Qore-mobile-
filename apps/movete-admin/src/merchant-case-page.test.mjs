import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMerchantCasePage,createMerchantCasePageStore} from './merchant-case-page.mjs';
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const T=1800000000000;
const actor={role:'admin',subject:id(90),mfaVerified:true,authRevision:12};
const row=(n,options={})=>({caseId:id(n),subjectKind:'MERCHANT_ORDER',
 reason:'MISSING_ITEM',severity:'MEDIUM',state:'RECEIVED_QA',
 createdAt:T-5000,updatedAt:T-1000,revision:2,...options});
const page=(options={})=>({scope:'ADMIN_MERCHANT_CASES_QA_PAGE',qaOnly:true,
 generatedAt:T-500,expiresAt:T+30000,revision:8,
 hasGlobalTotal:false,notificationsEnabled:false,operationsEnabled:false,
 nextCursor:null,items:[row(1),row(2,{severity:'HIGH'})],...options});
const project=(dto=page(),options={})=>projectMerchantCasePage(dto,{
 actor,certified:true,now:T,...options
});
test('R43 no muestra filas sin certificado de servidor ni Admin MFA',()=>{
 assert.equal(projectMerchantCasePage(page(),{actor,now:T}).code,'MERCHANT_CASE_API_NOT_CERTIFIED');
 assert.equal(project(page(),{actor:{...actor,role:'owner'}}).code,'ADMIN_AUTH_REQUIRED');
 assert.equal(project(page(),{actor:{...actor,mfaVerified:false}}).code,'ADMIN_AUTH_REQUIRED');
 assert.equal(project(page(),{actor:null}).code,'ADMIN_AUTH_REQUIRED');
 assert.equal(project(page(),{actor:{...actor,subject:'bad'}}).code,'ADMIN_AUTH_REQUIRED');
});
test('R43 solo acepta fuente explícita MERCHANT_ORDER, nunca la cola genérica',()=>{
 assert.equal(project(page({scope:'admin.incidents.read'})).code,'INVALID_MERCHANT_CASE_PAGE');
 assert.equal(project(page({items:[row(1,{subjectKind:'RIDE'})]})).code,'INVALID_MERCHANT_CASE_ROW');
 assert.equal(project(page({items:[row(1,{subjectKind:'DELIVERY'})]})).code,'INVALID_MERCHANT_CASE_ROW');
 const withoutKind=row(1);delete withoutKind.subjectKind;
 assert.equal(project(page({items:[withoutKind]})).code,'INVALID_MERCHANT_CASE_ROW');
});
test('R43 proyecta únicamente metadatos y orden QA sin inventar operador',()=>{
 const res=project();
 assert.equal(res.ok,true);
 assert.deepEqual(res.items.map(x=>x.caseId),[id(2),id(1)]);
 assert.deepEqual(res.counts,{visible:2,open:2,closedQa:0,highOpen:1});
 assert.equal(res.scope,'VISIBLE_CERTIFIED_QA_PAGE_ONLY');
 assert.equal(res.totalKnown,false);
 for(const k of ['operationsEnabled','notificationsEnabled','operatorAssigned',
  'emergencyDispatchEnabled','contactConfirmed','caseResolvedInProduction'])
  assert.equal(res[k],false);
 assert.equal('orderId' in res.items[0],false);
 assert.equal('ownerId' in res.items[0],false);
 assert.equal(Object.isFrozen(res.items[0]),true);
 assert.equal(Object.isFrozen(res.items),true);
});
test('R43 closed QA va detrás de abiertos incluso con gravedad alta',()=>{
 const dto=page({items:[
  row(1,{severity:'LOW',state:'REVIEW_QA'}),
  row(2,{severity:'HIGH',state:'CLOSED_QA'}),
  row(3,{severity:'HIGH',state:'CLASSIFIED_QA'}),
  row(4,{severity:'HIGH',state:'RECEIVED_QA'})
 ]});
 const res=project(dto);
 assert.equal(res.ok,true);
 assert.deepEqual(res.items.map(x=>x.caseId),[id(4),id(3),id(1),id(2)]);
 assert.equal(res.counts.closedQa,1);
 assert.equal(res.counts.highOpen,2);
});
test('R43 rechaza PII, inyecciones y propiedades extras de servidor',()=>{
 for(const patch of [
  {phone:'0981...'},{name:'Falsa identidad'},
  {latitude:-25.2},{address:'casa privada'},{operatorId:id(7)}
 ])assert.equal(project(page({...patch})).ok,false);
 for(const extra of [
  {driverPhone:'0981...'},{userId:id(4)},
  {customerName:'N'}, {comment:'texto libre'}, {orderId:id(8)}
 ])assert.equal(project(page({items:[row(1,extra)]})).code,'INVALID_MERCHANT_CASE_ROW');
});
test('R43 no acepta capacidades operativas, ni eventos SOS fingidos',()=>{
 for(const props of [
  {qaOnly:false},{hasGlobalTotal:true},
  {notificationsEnabled:true},{operationsEnabled:true},
  {revision:0},{nextCursor:'abc'},
  {scope:'ADMIN_MERCHANT_CASES_PRODUCTION'}
 ])assert.equal(project(page(props)).ok,false);
 for(const props of [
  {severity:'CRITICAL'},{state:'OPERATOR_ASSIGNED'},
  {state:'RESOLVED_BY_HUMAN'},{reason:'PHARMACY_RX'},
  {reason:'OTHER'},{subjectKind:'SUPPORT'}
 ])assert.equal(project(page({items:[row(1,props)]})).code,'INVALID_MERCHANT_CASE_ROW');
});
test('R43 falta fecha, TTL vencido, reloj adelantado y regresión temporal se rechazan',()=>{
 for(const props of [
  {expiresAt:T},{expiresAt:T+300001},
  {generatedAt:T+1},{generatedAt:T-300001},
  {expiresAt:T-1000},{generatedAt:'2026-10-24'}
 ])assert.equal(project(page(props)).ok,false);
 for(const patch of [
  {createdAt:T+1},{createdAt:-1},{updatedAt:T+1},
  {updatedAt:T-6000},{updatedAt:NaN},{revision:9},
  {revision:1.2}
 ])assert.equal(project(page({items:[row(1,patch)]})).ok,false);
});
test('R43 páginas 50 son tamaño de lectura, jamás techo global de registros',()=>{
 const cases=Array.from({length:50},(_,i)=>row(i+1));
 const res=project(page({items:cases,nextCursor:'X'.repeat(44)}));
 assert.equal(res.ok,true);assert.equal(res.items.length,50);
 assert.equal(res.nextCursor,'X'.repeat(44));
 assert.equal(res.totalKnown,false);
 assert.equal(project(page({items:[...cases,row(51)]})).ok,false);
});
test('R43 rechaza ítems duplicados, desconocidos y página no-objeto',()=>{
 assert.equal(project(page({items:[row(1),row(1)]})).code,'INVALID_MERCHANT_CASE_ROW');
 for(const input of [null,[],{},'FAKE',page({items:[null]}),
   page({items:'FAKE'})])assert.equal(project(input).ok,false);
});
test('R43 store borra cache al cambiar actor/JWT, al caducar o perder certificado',()=>{
 let time=T;
 const store=createMerchantCasePageStore({now:()=>time});
 assert.equal(store.update(page(),{actor,certified:true}).ok,true);
 assert.equal(store.snapshot({actor,certified:true}).items.length,2);
 assert.equal(store.snapshot({actor:{...actor,authRevision:13},certified:true}),null);
 assert.equal(store.snapshot({actor,certified:true}),null);
 assert.equal(store.update(page(),{actor,certified:true}).ok,true);
 assert.equal(store.snapshot({actor,certified:false}),null);
 assert.equal(store.update(page(),{actor,certified:true}).ok,true);
 time=T+30000;
 assert.equal(store.snapshot({actor,certified:true}),null);
});
test('R43 store rechaza respuesta regresiva y nunca retiene filas anteriores',()=>{
 const store=createMerchantCasePageStore({now:()=>T});
 assert.equal(store.update(page(),{actor,certified:true}).ok,true);
 assert.equal(store.update(page({revision:7,
  items:[row(1,{revision:2})]}),{actor,certified:true}).code,'REGRESSIVE_CASE_PAGE');
 assert.equal(store.snapshot({actor,certified:true}),null);
});
test('R43 no autoriza real contact/case management aunque se haya validado página',()=>{
 const store=createMerchantCasePageStore({now:()=>T});
 const data=store.update(page(),{actor,certified:true});
 assert.equal(data.ok,true);
 for(const operation of ['reply','assign','resolve','notify','dispatch','refund'])
  assert.equal(operation in store,false);
 assert.equal('sendEnabled' in data,false);
 assert.equal(data.operationsEnabled,false);
});
