import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_ACTIONS,createAdminGateway,isValidReview} from './admin-access.mjs';
const uuid='123e4567-e89b-42d3-a456-426614174000';
const review={requestKey:uuid,vehicleId:uuid,approve:false,reason:'Documento ilegible en prueba'};
const session=()=>({role:'admin',mfaVerified:true,token:'synthetic-admin-token-minimum-length',expiresAt:Date.now()+60000});
const options={
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 enabled:true,getSession:session,fetchImpl:async()=>({ok:true,status:200,json:async()=>({reviewed:true})})
};
test('no se envía review hasta contrato certificado por Arquitecto A',async()=>{
 const g=createAdminGateway(options);
 assert.equal(g.isConfigured(),false);
 assert.equal((await g.reviewVehicle(review)).code,'ADMIN_CONTRACT_PENDING');
});
test('prohíbe HTTPS sin pinning, host falso y URL con token',async()=>{
 for(const origin of ['http://staging.example.invalid','https://other.example.invalid',
  'https://staging.example.invalid?token=test','https://me@staging.example.invalid']){
  const g=createAdminGateway({...options,contractCertified:true,origin});
  assert.equal(g.isConfigured(),false,origin);
 }
});
test('DTO review sin campos de role ni actor',()=>{
 assert.equal(isValidReview(review),true);
 assert.equal(isValidReview({...review,reviewerId:uuid}),false);
 assert.equal(isValidReview({...review,reason:'corto'}),false);
 assert.equal(ADMIN_ACTIONS.vehicleReview,'/v1/staging/admin/vehicle-reviews');
});
test('prohíbe Passenger, Driver y Admin sin MFA incluso con token',async()=>{
 for(const value of [{...session(),role:'passenger'},{...session(),role:'driver'},{...session(),mfaVerified:false}]){
  const g=createAdminGateway({...options,contractCertified:true,getSession:()=>value});
  assert.equal((await g.reviewVehicle(review)).code,'AUTH_REQUIRED');
 }
});
test('403 invalida sesión y no declara aprobación local',async()=>{
 let cleared=0;
 const g=createAdminGateway({...options,contractCertified:true,
  fetchImpl:async()=>({ok:false,status:403}),onSessionInvalid:()=>cleared++});
 assert.equal((await g.reviewVehicle(review)).code,'FORBIDDEN');
 assert.equal(cleared,1);
});
test('JWT no sale del origin fijado; POST sin cookie ni caché',async()=>{
 let url='',req={};
 const g=createAdminGateway({...options,contractCertified:true,fetchImpl:async(u,r)=>{
  url=u;req=r;return {ok:true,status:200,json:async()=>({verified:true})};
 }});
 assert.equal((await g.reviewVehicle(review)).ok,true);
 assert.equal(url,'https://staging.example.invalid/v1/staging/admin/vehicle-reviews');
 assert.equal(req.credentials,'omit');assert.equal(req.cache,'no-store');
 assert.equal(req.redirect,'error');assert.equal(req.method,'POST');
 assert.ok(req.signal);
 assert.deepEqual(JSON.parse(req.body),review);
});
test('dos decisiones simultáneas sobre el mismo vehículo no se duplican',async()=>{
 let resolve,fetches=0;
 const wait=new Promise(done=>resolve=done);
 const g=createAdminGateway({...options,contractCertified:true,fetchImpl:async()=>{fetches++;return wait;}});
 const first=g.reviewVehicle(review);
 assert.equal((await g.reviewVehicle({...review,requestKey:'123e4567-e89b-42d3-a456-426614174099'})).code,'REVIEW_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();assert.equal(fetches,1);
 resolve({ok:true,status:200,json:async()=>({reviewed:true})});
 assert.equal((await first).ok,true);
});
test('respuesta mal formada y 503 cierran sin falsa aprobación',async()=>{
 for(const result of [{ok:true,status:200,json:async()=>[]},{ok:false,status:503}]){
  const g=createAdminGateway({...options,contractCertified:true,fetchImpl:async()=>result});
  assert.equal((await g.reviewVehicle(review)).ok,false);
 }
});
