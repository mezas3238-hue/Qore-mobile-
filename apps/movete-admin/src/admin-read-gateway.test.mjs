import test from 'node:test';
import assert from 'node:assert/strict';
import {READ_CONTRACTS,createAdminReadGateway} from './admin-read-gateway.mjs';
const t=1800000000000;
const owner='123e4567-e89b-42d3-a456-426614174000';
const admin='123e4567-e89b-42d3-a456-426614174001';
const token='synthetic-only-opaque-token-222';
const session=(role='admin')=>({role,subject:role==='owner'?owner:admin,mfaVerified:true,token,expiresAt:t+90000});
const response=(data={scope:'synthetic'})=>({
 ok:true,status:200,redirected:false,
 headers:{get:key=>key==='content-type'?'application/json; charset=utf-8':null},
 text:async()=>JSON.stringify(data)
});
const settings={
 enabled:true,certifiedContracts:['kyc','zones','incidents','audit','finance'],
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 getSession:async()=>session(),fetchImpl:async()=>response(),now:()=>t
};
test('sin certificación individual no se transmite nunca a URL remota',async()=>{
 let hits=0;
 const gateway=createAdminReadGateway({...settings,certifiedContracts:[],
  fetchImpl:async()=>{hits++;return response();}});
 assert.equal(gateway.isConfigured('kyc'),false);
 assert.equal((await gateway.read('kyc')).code,'READ_CONTRACT_NOT_CERTIFIED');
 assert.equal(hits,0);
 assert.equal(createAdminReadGateway().isConfigured('kyc'),false);
});
test('solo acepta HTTPS con host fijado e impide host injection',async()=>{
 for(const origin of [
  'http://staging.example.invalid','https://evil.example.invalid',
  'https://staging.example.invalid/path','https://u@staging.example.invalid',
  'https://staging.example.invalid/?access=secret',
  'https://staging.example.invalid:1234','https://staging.example.invalid\\@evil.test'
 ]){
  const gateway=createAdminReadGateway({...settings,origin});
  assert.equal(gateway.isConfigured('kyc'),false,origin);
 }
});
test('no permite operación no declarada ni endpoint generado por entrada externa',async()=>{
 const gateway=createAdminReadGateway({...settings,certifiedContracts:['kyc','../../../etc','constructor']});
 assert.equal(gateway.isConfigured('kyc'),true);
 assert.equal(gateway.isConfigured('constructor'),false);
 assert.equal((await gateway.read('constructor')).code,'READ_CONTRACT_NOT_CERTIFIED');
 assert.equal(Object.keys(READ_CONTRACTS).length,5);
});
test('GET Admin sin cookies ni redirecciones, sin secrets en respuesta pública',async()=>{
 let url,req;
 const gateway=createAdminReadGateway({...settings,fetchImpl:async(u,options)=>{url=u;req=options;return response();}});
 const result=await gateway.read('kyc');
 assert.equal(result.ok,true);
 assert.equal(url,'https://staging.example.invalid/v1/staging/admin/vehicle-review-queue');
 assert.equal(req.method,'GET');assert.equal(req.redirect,'error');
 assert.equal(req.credentials,'omit');assert.equal(req.cache,'no-store');
 assert.equal(req.referrerPolicy,'no-referrer');
 assert.ok(req.signal);
 assert.equal(req.headers.Authorization,'Bearer '+token);
 assert.equal(Object.hasOwn(result,'token'),false);
});
test('owner no puede usar rutas Admin y Admin no puede ver Finance',async()=>{
 const adminGateway=createAdminReadGateway(settings);
 assert.equal((await adminGateway.read('finance')).code,'FORBIDDEN');
 const ownerGateway=createAdminReadGateway({...settings,getSession:async()=>session('owner')});
 assert.equal((await ownerGateway.read('kyc')).code,'FORBIDDEN');
 assert.equal((await ownerGateway.read('finance')).ok,true);
});
test('MFA faltante, token vencido o cuenta inválida rechazan antes de fetch',async()=>{
 let calls=0;
 for(const bad of [{...session(),mfaVerified:false},{...session(),expiresAt:t},
  {...session(),subject:'../bad'},{...session(),role:'driver'}]){
  const gateway=createAdminReadGateway({...settings,getSession:async()=>bad,
   fetchImpl:async()=>{calls++;return response();}});
  assert.equal((await gateway.read('kyc')).code,'FORBIDDEN');
 }
 assert.equal(calls,0);
});
test('simultaneidad de misma lectura solo manda un GET',async()=>{
 let resolve;const wait=new Promise(done=>resolve=done);
 let requests=0;
 const gateway=createAdminReadGateway({...settings,fetchImpl:async()=>{requests++;return wait;}});
 const first=gateway.read('kyc');
 assert.equal((await gateway.read('kyc')).code,'READ_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();
 assert.equal(requests,1);
 resolve(response());
 assert.equal((await first).ok,true);
});
test('401 y 403 invalidan la sesión mediante callback, sin datos',async()=>{
 for(const status of [401,403]){
  let count=0;
  const gateway=createAdminReadGateway({...settings,
   onSessionInvalid:()=>count++,fetchImpl:async()=>({ok:false,status,redirected:false})});
  assert.equal((await gateway.read('kyc')).ok,false);
  assert.equal(count,1);
 }
});
test('respuesta no JSON, array o demasiado grande falla cerrada',async()=>{
 for(const r of [
  {...response(),headers:{get:()=> 'text/html'}},
  response([]),
  {...response(),headers:{get:k=>k==='content-length'?'999999999':'application/json'}},
  {...response(),text:async()=>'{nojson'},
  {...response(),text:async()=> 'x'.repeat(300000)}
 ]){
  const gateway=createAdminReadGateway({...settings,fetchImpl:async()=>r});
  assert.equal((await gateway.read('kyc')).ok,false);
 }
});
test('login cambiado durante la solicitud no puede insertar respuesta en otra cuenta',async()=>{
 let active=session(),resume;
 const wait=new Promise(done=>resume=done);
 const gateway=createAdminReadGateway({...settings,getSession:async()=>active,fetchImpl:async()=>wait});
 const pending=gateway.read('kyc');
 await Promise.resolve();await Promise.resolve();
 active={...session(),subject:'123e4567-e89b-42d3-a456-426614174099'};
 resume(response());
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
});
test('cambio de token en mismo actor invalida respuesta antigua',async()=>{
 let active=session(),resume;
 const wait=new Promise(done=>resume=done);
 const gateway=createAdminReadGateway({...settings,getSession:async()=>active,fetchImpl:async()=>wait});
 const pending=gateway.read('kyc');
 await Promise.resolve();await Promise.resolve();
 active={...session(),token:'synthetic-rotated-token-987'};
 resume(response());
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
});
test('fallo de red o 503 no muestra respuesta certificada',async()=>{
 const dead=createAdminReadGateway({...settings,fetchImpl:async()=>{throw Error('sin red');}});
 assert.equal((await dead.read('kyc')).code,'NETWORK_OR_TIMEOUT');
 const busy=createAdminReadGateway({...settings,fetchImpl:async()=>({ok:false,status:503})});
 assert.equal((await busy.read('kyc')).code,'SERVICE_UNAVAILABLE');
});
