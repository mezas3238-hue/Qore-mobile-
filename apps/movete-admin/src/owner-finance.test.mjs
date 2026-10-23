import test from 'node:test';
import assert from 'node:assert/strict';
import {OWNER_TOTAL_FIELDS,projectOwnerFinance,createOwnerFinanceStore} from './owner-finance.mjs';
const owner='123e4567-e89b-42d3-a456-426614174000';
const outsider='123e4567-e89b-42d3-a456-426614174099';
const now=1761180000000;
const totals={
 completedRides:12,completedDeliveries:7,completedMerchantOrders:5,
 grossCollectedGs:200000,driverPayoutGs:150000,platformCommissionGs:30000,
 refundsGs:9000,processingFeesGs:4000,netPlatformGs:17000
};
const data={
 scope:'owner.finance.read',ownerId:owner,
 period:{from:'2026-10-01',to:'2026-10-22',timezone:'America/Asuncion'},
 currency:'PYG',revision:5,ledgerRevision:25,reconciliationStatus:'RECONCILED',
 generatedAt:now-5000,expiresAt:now+30000,totals
};
const session={role:'owner',subject:owner};
test('autoriza sólo propietario de la misma identidad con MFA validado en Auth aparte',()=>{
 const view=projectOwnerFinance(data,{role:'owner',subject:owner,now});
 assert.equal(view.totals.netPlatformGs,17000);
 assert.equal(view.ledgerRevision,25);
 for(const role of ['admin','passenger','driver',undefined]){
  assert.equal(projectOwnerFinance(data,{role,subject:owner,now}),null);
 }
 assert.equal(projectOwnerFinance(data,{role:'owner',subject:outsider,now}),null);
});
test('estricta lista blanca impide PII, secretos y cuentas en respuesta',()=>{
 for(const [field,value] of [['bankAccount','123'],['driverName','Persona'],
   ['card','4242'],['service_role','SECRET']]){
  assert.equal(projectOwnerFinance({...data,[field]:value},{role:'owner',subject:owner,now}),null);
 }
 assert.deepEqual(Object.keys(projectOwnerFinance(data,{role:'owner',subject:owner,now}).totals).sort(),
  [...OWNER_TOTAL_FIELDS].sort());
});
test('no interpreta montos fraccionarios, negativos, NaN o String como guaraníes',()=>{
 for(const invalid of [15.25,-1,NaN,Infinity,'17000',Number.MAX_SAFE_INTEGER]){
  assert.equal(projectOwnerFinance({...data,totals:{...totals,netPlatformGs:invalid}},
   {role:'owner',subject:owner,now}),null);
 }
});
test('diferencia bruto, transferencias y neto según columnas del ledger servidor',()=>{
 const view=projectOwnerFinance(data,{role:'owner',subject:owner,now});
 assert.equal(view.totals.grossCollectedGs,200000);
 assert.equal(view.totals.driverPayoutGs,150000);
 assert.equal(view.totals.platformCommissionGs,30000);
 assert.equal(view.totals.netPlatformGs,17000);
});
test('rechaza información sin conciliación o sin revisión ledger',()=>{
 for(const reconciliationStatus of ['PENDING','UNKNOWN','ESTIMATED']){
  assert.equal(projectOwnerFinance({...data,reconciliationStatus},{role:'owner',subject:owner,now}),null);
 }
 assert.equal(projectOwnerFinance({...data,ledgerRevision:0},{role:'owner',subject:owner,now}),null);
});
test('rechaza fecha inventada, rangos enormes y timezone errónea',()=>{
 for(const period of [
  {...data.period,from:'2026-02-30'},
  {...data.period,from:'2026-01-01'},
  {...data.period,timezone:'UTC'},
  {...data.period,to:'2026-09-01'}
 ]){
  assert.equal(projectOwnerFinance({...data,period},{role:'owner',subject:owner,now}),null);
 }
});
test('TTL y revisión generada bloquean métricas antiguas',()=>{
 assert.equal(projectOwnerFinance({...data,expiresAt:now},{role:'owner',subject:owner,now}),null);
 assert.equal(projectOwnerFinance({...data,generatedAt:now-400000},{role:'owner',subject:owner,now}),null);
 assert.equal(projectOwnerFinance({...data,expiresAt:now+400000},{role:'owner',subject:owner,now}),null);
});
test('store limpia estado al pasar plazo o cambiar de propietario',()=>{
 let time=now;
 const store=createOwnerFinanceStore({now:()=>time});
 assert.equal(store.replace(data,session),true);
 assert.equal(store.current(session).totals.netPlatformGs,17000);
 assert.equal(store.current({role:'admin',subject:owner}),null);
 assert.equal(store.current(session),null);
 assert.equal(store.replace(data,session),true);
 time=now+30001;
 assert.equal(store.current(session),null);
});
test('revisión financiera antigua no reemplaza una conciliación reciente',()=>{
 const store=createOwnerFinanceStore({now:()=>now});
 assert.equal(store.replace(data,session),true);
 assert.equal(store.replace({...data,ledgerRevision:24},session),false);
 assert.equal(store.current(session),null);
});
test('store impide reutilizar datos entre sesiones owner distintas',()=>{
 const store=createOwnerFinanceStore({now:()=>now});
 store.replace(data,session);
 const bad={...data,ownerId:outsider};
 assert.equal(store.replace(bad,{role:'owner',subject:outsider}),false);
 assert.equal(store.current(session),null);
});
