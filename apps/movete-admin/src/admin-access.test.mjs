import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_ACTIONS,createAdminGateway,isValidReview} from './admin-access.mjs';
const uuid='123e4567-e89b-42d3-a456-426614174000';
const review={requestKey:uuid,vehicleId:uuid,approve:false,reason:'Documento ilegible en prueba'};
const session=()=>({role:'admin',token:'synthetic-admin-token-minimum-length',expiresAt:Date.now()+60000});
const options={
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 enabled:true,getSession:session,fetchImpl:async()=>({ok:true,status:200,json:async()=>({reviewed:true})})
};
test('no se envía un review hasta contrato certificado por A',async()=>{
 const g=createAdminGateway(options);
 assert.equal(g.isConfigured(),false);
 assert.equal((await g.reviewVehicle(review)).code,'ADMIN_CONTRACT_PENDING');
});
test('prohíbe explícitamente admin sin HTTPS pinning',async()=>{
 const g=createAdminGateway({...options,contractCertified:true,pinnedOrigin:'https://other.example.invalid'});
 assert.equal(g.isConfigured(),false);
});
test('validación exacta review sin campos de role ni actor',()=>{
 assert.equal(isValidReview(review),true);
 assert.equal(isValidReview({...review,reviewerId:uuid}),false);
 assert.equal(isValidReview({...review,reason:'corto'}),false);
 assert.equal(ADMIN_ACTIONS.vehicleReview,'/v1/staging/admin/vehicle-reviews');
});
test('prohíbe rol passenger y driver aunque presenten token',async()=>{
 for(const role of ['passenger','driver']){
  const g=createAdminGateway({...options,contractCertified:true,getSession:()=>({...session(),role})});
  assert.equal((await g.reviewVehicle(review)).code,'AUTH_REQUIRED');
 }
});
test('rechaza 403 y no declara aprobación local',async()=>{
 const g=createAdminGateway({...options,contractCertified:true,fetchImpl:async()=>({ok:false,status:403})});
 assert.equal((await g.reviewVehicle(review)).code,'FORBIDDEN');
});
test('JWT nunca viaja fuera del pin y revisión no añade identidad client-side',async()=>{
 let url='',req={};
 const g=createAdminGateway({...options,contractCertified:true,fetchImpl:async(u,r)=>{
  url=u;req=r;return {ok:true,status:200,json:async()=>({verified:true})};
 }});
 assert.equal((await g.reviewVehicle(review)).ok,true);
 assert.equal(url,'https://staging.example.invalid/v1/staging/admin/vehicle-reviews');
 assert.equal(req.credentials,'omit');
 assert.equal(req.redirect,'error');
 assert.deepEqual(JSON.parse(req.body),review);
});
