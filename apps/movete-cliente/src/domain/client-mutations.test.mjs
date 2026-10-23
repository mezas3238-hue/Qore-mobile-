import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientMutationController} from './client-mutations.mjs';
const subject='123e4567-e89b-42d3-a456-426614174000';
const key='123e4567-e89b-42d3-a456-426614174001';
const ride={requestKey:key,originTag:'San Lorenzo centro',destinationTag:'Asunción centro',service:'economico'};
const auth=()=>({subject,role:'passenger'});
function fixture(send=async()=>({ok:true,status:201}),extras={}){
 return createClientMutationController({gateway:{send},getSession:auth,...extras});
}
test('sin preparación o sin identidad no se solicita viaje',async()=>{
 const c=fixture();
 assert.equal((await c.submit()).code,'NO_READY_REQUEST');
 assert.equal(c.prepare({operation:'rideRequest',body:ride,subject:'otro'}).code,'INVALID_INPUT');
 assert.equal(c.publicState().phase,'idle');
});
test('el requestKey preparado es el mismo enviado al backend',async()=>{
 const sent=[];
 const c=fixture(async(operation,data)=>{sent.push({operation,data});return {ok:true,status:201}});
 assert.equal(c.prepare({operation:'rideRequest',body:ride,subject}).ok,true);
 assert.equal((await c.submit()).ok,true);
 assert.equal(sent.length,1);
 assert.equal(sent[0].data.body.requestKey,key);
 assert.equal(c.publicState().phase,'acknowledged');
 assert.equal(c.publicState().requestKey,key);
 assert.equal((await c.submit()).code,'NO_READY_REQUEST');
});
test('doble toque mientras hay solicitud no crea segunda operación',async()=>{
 let resolve;
 const blocked=new Promise(done=>resolve=done);
 let n=0;
 const c=fixture(async()=>{n++;return blocked});
 c.prepare({operation:'rideRequest',body:ride,subject});
 const first=c.submit();
 await Promise.resolve();await Promise.resolve();
 assert.equal((await c.submit()).code,'NO_READY_REQUEST');
 assert.equal(c.prepare({operation:'rideRequest',body:ride,subject}).code,'REQUEST_IN_FLIGHT');
 resolve({ok:true,status:201});
 await first;
 assert.equal(n,1);
});
test('dos taps en el mismo tick no producen dos envíos',async()=>{
 let calls=0;
 let release;
 const wait=new Promise(resolve=>release=resolve);
 const c=createClientMutationController({
  gateway:{send:async()=>{calls++;return wait}},
  getSession:async()=>({subject,role:'passenger'})
 });
 c.prepare({operation:'rideRequest',body:ride,subject});
 const first=c.submit(),second=c.submit();
 assert.equal((await second).code,'NO_READY_REQUEST');
 await Promise.resolve();await Promise.resolve();
 assert.equal(calls,1);
 release({ok:true,status:201});
 assert.equal((await first).ok,true);
});
test('timeout conserva requestKey y solo reintenta explícitamente',async()=>{
 const sent=[];
 let n=0;
 const c=fixture(async(_,payload)=>{
  sent.push(payload.body.requestKey);n++;
  return n===1?{ok:false,code:'NETWORK_OR_TIMEOUT'}:{ok:true,status:201};
 });
 c.prepare({operation:'rideRequest',body:ride,subject});
 assert.equal((await c.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal((await c.submit()).code,'EXPLICIT_RETRY_REQUIRED');
 assert.equal((await c.retry()).ok,true);
 assert.deepEqual(sent,[key,key]);
});
test('requiere mismo titular; evita mezcla de cuentas',async()=>{
 const c=fixture(undefined,{getSession:()=>({subject:'123e4567-e89b-42d3-a456-426614174099',role:'passenger'})});
 c.prepare({operation:'rideRequest',body:ride,subject});
 assert.equal((await c.submit()).code,'SESSION_CHANGED');
 assert.equal(c.publicState().requestKey,null);
});
test('misma cuenta con otra revisión de sesión no envía el borrador anterior',async()=>{
 let calls=0;
 const c=createClientMutationController({
  gateway:{send:async()=>{calls++;return {ok:true,status:201};}},
  getSession:async()=>({subject,role:'passenger',sessionRevision:8})
 });
 assert.equal(c.prepare({operation:'rideRequest',body:ride,subject,
  sessionRevision:7}).ok,true);
 assert.equal((await c.submit()).code,'SESSION_CHANGED');
 assert.equal(calls,0);
 assert.equal(c.publicState().phase,'idle');
});
test('clear en logout descarta respuesta antigua y borra request',async()=>{
 let resolve;
 const delayed=new Promise(done=>resolve=done);
 const c=fixture(async()=>delayed);
 c.prepare({operation:'rideRequest',body:ride,subject});
 const task=c.submit();
 await Promise.resolve();await Promise.resolve();
 c.clear();
 resolve({ok:true,status:201});
 assert.equal((await task).code,'STALE_RESPONSE_IGNORED');
 assert.equal(c.publicState().phase,'idle');
});
test('403 y 401 invalidan estado privado y nunca se reintentan',async()=>{
 for(const code of ['AUTH_REQUIRED','FORBIDDEN']){
  let wiped=0;
  const c=fixture(async()=>({ok:false,code}),{clearSensitive:()=>wiped++});
  c.prepare({operation:'rideRequest',body:ride,subject});
  assert.equal((await c.submit()).code,code);
  assert.equal(c.publicState().phase,'idle');
  assert.equal(wiped,1);
 }
});
test('pasajeros moto, compras no certificadas y pagos reales denegados',()=>{
 const c=fixture();
 assert.equal(c.prepare({operation:'rideRequest',subject,body:{...ride,vehicleKind:'MOTO'}}).ok,false);
 assert.equal(c.prepare({operation:'orderRequest',subject,body:ride}).ok,false);
 assert.equal(c.prepare({operation:'paymentAuthorize',subject,body:{...ride,method:'CARD'}}).ok,false);
});
test('el snapshot público nunca incluye token, body ni direcciones',()=>{
 const c=fixture();
 c.prepare({operation:'rideRequest',body:ride,subject});
 const snap=c.publicState();
 assert.deepEqual(Object.keys(snap).sort(),['error','operation','phase','requestKey'].sort());
 assert.equal(JSON.stringify(snap).includes('San Lorenzo'),false);
});
test('rechazo permanente es terminal hasta nueva preparación',async()=>{
 const c=fixture(async()=>({ok:false,code:'REQUEST_REJECTED'}));
 c.prepare({operation:'rideRequest',body:ride,subject});
 assert.equal((await c.submit()).code,'REQUEST_REJECTED');
 assert.equal((await c.retry()).code,'NO_READY_REQUEST');
});


test('NUNCA reemplaza requestKey mientras el servidor pudo procesar un timeout',async()=>{
 const requests=[];let attempts=0;
 const c=fixture(async (_,arg)=>{
  requests.push(arg.body.requestKey);
  return ++attempts===1?{ok:false,code:'NETWORK_OR_TIMEOUT'}:{ok:true,status:201};
 });
 c.prepare({operation:'rideRequest',body:ride,subject});
 assert.equal((await c.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal(c.prepare({operation:'rideRequest',body:{...ride,
  requestKey:'123e4567-e89b-42d3-a456-426614174023'},subject}).code,'EXPLICIT_RETRY_REQUIRED');
 assert.equal(c.prepare({operation:'deliveryRequest',body:{...ride},subject}).code,'EXPLICIT_RETRY_REQUIRED');
 assert.equal((await c.retry()).ok,true);
 assert.deepEqual(requests,[key,key]);
});
test('rechazo ambiguo no habilita automáticamente un segundo despacho',async()=>{
 const c=fixture(async()=>({ok:false,code:'REQUEST_REJECTED',status:409}));
 c.prepare({operation:'rideRequest',body:ride,subject});
 assert.equal((await c.submit()).code,'REQUEST_REJECTED');
 assert.equal(c.prepare({operation:'rideRequest',body:{...ride,
  requestKey:'123e4567-e89b-42d3-a456-426614174023'},subject}).code,
 'RECONCILE_BEFORE_NEW_REQUEST');
});
test('logout o reinicio explícito elimina el bloqueo y la clave privada',async()=>{
 const c=fixture(async()=>({ok:false,code:'REQUEST_REJECTED'}));
 c.prepare({operation:'rideRequest',body:ride,subject});
 await c.submit();
 assert.equal(c.publicState().phase,'failed');
 c.clear();
 assert.equal(c.publicState().requestKey,null);
 assert.equal(c.prepare({operation:'rideRequest',body:ride,subject}).ok,true);
});
