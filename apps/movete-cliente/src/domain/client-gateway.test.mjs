import test from 'node:test';
import assert from 'node:assert/strict';
import {CLIENT_ENDPOINTS,createClientGateway,validateClientOperation} from './client-gateway.mjs';
const key='123e4567-e89b-42d3-a456-426614174000';
const body={requestKey:key,originTag:'Centro Asunción',destinationTag:'Villa Morra',service:'economico'};
const subject='123e4567-e89b-42d3-a456-426614174099';
const expiry=Date.now()+90000;
const session=()=>({subject,role:'passenger',authRevision:2,token:'synthetic-jwt-of-sufficient-length',expiresAt:expiry});
const make=(fetchImpl,opts={})=>createClientGateway({
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 enabled:true,contractCertified:true,
 certifiedOperations:['rideRequest','deliveryRequest','deliveryStatus','paymentAuthorize'],
 getSession:session,fetchImpl,...opts
});
const response=(data={tripId:key},status=201)=>({ok:true,status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
const success=response();
test('CATALOGO: operaciones separadas de Cliente',()=>{
 assert.equal(Object.keys(CLIENT_ENDPOINTS).length,8);
 assert.equal(CLIENT_ENDPOINTS.rideRequest,'/v1/staging/rider/trips/request');
});
test('operaciones permanecen cerradas sin enable + origin fijado',async()=>{
 let hits=0;
 const fetchImpl=async()=>{hits++;return success};
 const gateway=createClientGateway({origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',getSession:session,fetchImpl});
 assert.equal((await gateway.send('rideRequest',{body})).code,'NOT_CONFIGURED');
 assert.equal(hits,0);
});
test('prohíbe origen http, credenciales, puertos y origen distinto',async()=>{
 for(const origin of ['http://staging.example.invalid','https://user:pass@staging.example.invalid','https://staging.example.invalid:8443','https://another.example.invalid','https://staging.example.invalid/?token=abc']){
   const gateway=make(async()=>success,{origin});
   assert.equal(gateway.isConfigured(),false,origin);
 }
});
test('payload rider exacto, sin identidad enviada ni MOTO pasajeros',()=>{
 assert.equal(validateClientOperation('rideRequest',body),true);
 assert.equal(validateClientOperation('rideRequest',{...body,userId:key}),false);
 assert.equal(validateClientOperation('rideRequest',{...body,vehicleKind:'MOTO'}),false);
 assert.equal(validateClientOperation('rideRequest',{...body,destinationTag:'centro asunción'}),false);
});
test('requestKey de idempotencia no se reescribe y JWT solo bearer',async()=>{
 const requests=[];
 const gateway=make(async(url,opts)=>{requests.push({url,opts});return success});
 assert.equal((await gateway.send('rideRequest',{body})).ok,true);
 assert.equal((await gateway.send('rideRequest',{body})).ok,true);
 assert.equal(requests.length,2);
 for(const {url,opts} of requests){
  assert.equal(url,'https://staging.example.invalid/v1/staging/rider/trips/request');
  assert.deepEqual(JSON.parse(opts.body),body);
  assert.equal(opts.credentials,'omit');
  assert.equal(opts.cache,'no-store');
  assert.equal(opts.redirect,'error');
  assert.ok(opts.headers.Authorization.startsWith('Bearer '));
 }
});
test('deniega sesiones perdidas, vencidas, driver y admin',async()=>{
 let hits=0;const fetchImpl=async()=>{hits++;return success};
 for(const bad of [null,{...session(),role:'driver'},{...session(),role:'admin'},{...session(),expiresAt:Date.now()-1},{...session(),token:'short'}]){
  const gateway=make(fetchImpl,{getSession:()=>bad});
  assert.equal((await gateway.send('rideRequest',{body})).code,'AUTH_REQUIRED');
 }
 assert.equal(hits,0);
});
test('403 y 401 invalidan sesión sin filtrar datos',async()=>{
 for(const status of [401,403]){
  let invalidated=0;
  const gateway=make(async()=>({ok:false,status,redirected:false}),{onSessionInvalid:()=>{invalidated++}});
  const result=await gateway.send('rideRequest',{body});
  assert.equal(result.ok,false);assert.equal(result.status,status);assert.equal(invalidated,1);
 }
});
test('rechaza operación ajena y UUID inválido',async()=>{
 let hits=0;const gateway=make(async()=>{hits++;return success});
 assert.equal((await gateway.send('driverOfferAccept',{body})).code,'OPERATION_DENIED');
 assert.equal((await gateway.send('rideStatus',{id:'../../other'})).code,'DEDICATED_GATEWAY_REQUIRED');
 assert.equal(hits,0);
});
test('no admite payload no validado de compra',async()=>{
 const gateway=make(async()=>success);
 assert.equal((await gateway.send('orderRequest',{body:{requestKey:key,branchId:key,vehicleKind:'AUTO',items:[{}]}})).code,'DEDICATED_GATEWAY_REQUIRED');
});
test('carga MOTO superior a 10kg y declaración restringida bloqueadas',()=>{
 const d={requestKey:key,vehicleKind:'MOTO',category:'PARCEL',grams:12000,lengthCm:10,widthCm:10,heightCm:10,pickupTag:'Origen uno',deliveryTag:'Destino dos',restrictedItemDeclared:false};
 assert.equal(validateClientOperation('deliveryRequest',d),false);
 assert.equal(validateClientOperation('deliveryRequest',{...d,grams:3000,restrictedItemDeclared:true}),false);
 assert.equal(validateClientOperation('deliveryRequest',{...d,grams:3000}),true);
});
test('compra exige líneas con itemId UUID y cantidad válida',()=>{
 const item={itemId:key,quantity:2};
 const order={requestKey:key,branchId:key,vehicleKind:'MOTO',items:[item]};
 assert.equal(validateClientOperation('orderRequest',order),true);
 assert.equal(validateClientOperation('orderRequest',{...order,items:[{itemId:key,quantity:0}]}),false);
 assert.equal(validateClientOperation('orderRequest',{...order,items:[{...item,price:0}]}),false);
});
test('pago siempre SIMULADO',()=>{
 assert.equal(validateClientOperation('paymentAuthorize',{requestKey:key,quoteId:key,method:'CARD'}),false);
 assert.equal(validateClientOperation('paymentAuthorize',{requestKey:key,quoteId:key,method:'SIMULATED_CARD'}),true);
});
test('error network, 429, 503 y JSON inválido fallan cerrados',async()=>{
 const candidates=[
  {f:async()=>{throw Error('down')},expected:'NETWORK_OR_TIMEOUT'},
  {f:async()=>({ok:false,status:429}),expected:'RATE_LIMITED'},
  {f:async()=>({ok:false,status:503}),expected:'SERVICE_UNAVAILABLE'},
  {f:async()=>response([],201),expected:'BAD_SERVER_RESPONSE'}
 ];
 for(const {f,expected} of candidates)assert.equal((await make(f).send('rideRequest',{body})).code,expected);
});

test('un origin habilitado jamás certifica una operación por sí mismo',async()=>{
 let calls=0;
 const setup={origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
  enabled:true,getSession:session,fetchImpl:async()=>{calls++;return success;}};
 const disabled=createClientGateway(setup);
 assert.equal((await disabled.send('rideRequest',{body})).code,'NOT_CONFIGURED');
 const pending=createClientGateway({...setup,contractCertified:true});
 assert.equal((await pending.send('rideRequest',{body})).code,'CONTRACT_PENDING');
 assert.equal(calls,0);
});
test('status viaje y tarifa requieren gateways dedicados',async()=>{
 const gateway=make(async()=>success);
 for(const op of ['fareQuote','rideStatus','orderRequest'])
  assert.equal((await gateway.send(op,{id:key,body})).code,'DEDICATED_GATEWAY_REQUIRED');
});
test('201 con HTML, JSON inválido, oversized o 200 no confirma mutación',async()=>{
 const cases=[
  [response({},200),'REQUEST_REJECTED'],
  [{...success,headers:{get:()=> 'text/html'}},'BAD_CONTENT_TYPE'],
  [{...success,headers:{get:k=>k==='content-length'?'99000000':'application/json'}},'RESPONSE_TOO_LARGE'],
  [{...success,text:async()=> 'x'.repeat(34000)},'RESPONSE_TOO_LARGE'],
  [{...success,text:async()=> '{bad'},'BAD_SERVER_RESPONSE'],
  [{...success,redirected:true},'UNTRUSTED_REDIRECT']
 ];
 for(const [reply,expected] of cases)
  assert.equal((await make(async()=>reply).send('rideRequest',{body})).code,expected);
});
test('401/403 tardíos de token anterior no cierran el login vigente',async()=>{
 for(const code of [401,403]){
  let current=session(),release,invalid=0;
  const pending=new Promise(resolve=>release=resolve);
  const gw=make(async()=>pending,{getSession:async()=>current,onSessionInvalid:()=>invalid++});
  const task=gw.send('rideRequest',{body});
  await Promise.resolve();await Promise.resolve();
  current={...current,authRevision:3};
  release({ok:false,status:code,redirected:false});
  assert.equal((await task).code,'STALE_SESSION_RESPONSE');
  assert.equal(invalid,0);
 }
});
test('201 tardío tras rotación no restituye datos de sesión vieja',async()=>{
 let current=session(),release;
 const pending=new Promise(resolve=>release=resolve);
 const gw=make(async()=>pending,{getSession:async()=>current});
 const task=gw.send('rideRequest',{body});
 await Promise.resolve();await Promise.resolve();
 current={...current,token:'synthetic-rotated-passenger-token'};
 release(success);
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
});
test('doble petición simultánea comparte exclusión del transporte',async()=>{
 let hits=0,release;const pending=new Promise(resolve=>release=resolve);
 const gw=make(async()=>{hits++;return pending;});
 const task=gw.send('rideRequest',{body});
 assert.equal((await gw.send('rideRequest',{body})).code,'REQUEST_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();
 assert.equal(hits,1);
 release(success);assert.equal((await task).ok,true);
});
test('JWT requiere subject validado y authRevision',async()=>{
 for(const value of [{...session(),subject:'invalid'},
  {...session(),authRevision:-1},{...session(),authRevision:undefined}]){
  const gw=make(async()=>success,{getSession:async()=>value});
  assert.equal((await gw.send('rideRequest',{body})).code,'AUTH_REQUIRED');
 }
});
test('conflicto 409 de envío exige conciliación, no una segunda clave',async()=>{
 const request={requestKey:key,vehicleKind:'MOTO',category:'PARCEL',grams:2000,
  lengthCm:10,widthCm:10,heightCm:10,pickupTag:'Centro Asuncion',
  deliveryTag:'Villa Morra',restrictedItemDeclared:false};
 const gw=make(async()=>({ok:false,status:409,redirected:false}));
 assert.equal((await gw.send('deliveryRequest',{body:request})).code,'CONFLICT_RECONCILE');
});
