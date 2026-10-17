import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingVehicleGateway,assertStagingRef} from './g2-staging-vehicle-gateway.mjs';

const userId='11111111-1111-4111-8111-111111111111';
const adminId='22222222-2222-4222-8222-222222222222';
const appId='44444444-4444-4444-8444-444444444444';
const auditId='55555555-5555-4555-8555-555555555555';
const header={authorization:'Bearer aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbb.cccccccccccccccccccc'};
const identity={id:userId,email_confirmed_at:'2026-10-16T12:00:00Z',is_anonymous:false};
const draft={
 requestKey:'33333333-3333-4333-8333-333333333333',
 kind:'AUTO',service:'economico',municipalityCode:'ASUNCION',
 plate:'ABC123',brand:'Toyota',model:'Corolla',year:2021,passengerCapacity:4
};
const review={
 requestKey:'66666666-6666-4666-8666-666666666666',
 vehicleId:'77777777-7777-4777-8777-777777777777',
 approve:true,reason:'All documents reviewed in a restricted staging environment'
};
const draftRoute='/v1/staging/vehicle-applications';
const reviewRoute='/v1/staging/admin/vehicle-reviews';
const request=(body=draft,path=draftRoute)=>({method:'POST',path,body,headers:header});
const gateway=(hooks={})=>createStagingVehicleGateway({
 projectRef:'abcdeffedcba12345678',
 verifyAccessToken:async()=>identity,
 submitDraft:async()=>appId,
 reviewVehicle:async()=>auditId,...hooks
});

test('never allows gateway configuration using Lovable production or malformed project reference',()=>{
 for(const ref of ['qdqrlgzlotnfdxzpacxs','',null,'foo','https://example.supabase.co','INVALID_REFERENCE'])
  assert.throws(()=>assertStagingRef(ref));
 assert.equal(assertStagingRef('abcdeffedcba12345678'),'abcdeffedcba12345678');
 assert.throws(()=>createStagingVehicleGateway({projectRef:'abcdeffedcba12345678'}));
});
test('valid vehicle intake binds ID from server-verified Auth, never from payload',async()=>{
 let tokenSeen,params;
 const h=gateway({
  verifyAccessToken:async t=>{tokenSeen=t;return identity},
  submitDraft:async p=>{params=p;return appId}
 });
 const res=await h(request());
 assert.equal(res.status,202);
 assert.deepEqual(res.body,{applicationId:appId,status:'pending',evidenceVerified:false,liveTripsEnabled:false});
 assert.equal(params._driver_id,userId);
 assert.equal(params._service,'economico');
 assert.equal(params._plate,'ABC123');
 assert.ok(tokenSeen.startsWith('aaaa'));
 assert.equal('approved' in params,false);
 assert.equal('_driver_verified' in params,false);
});
test('blocks forged subject, approved flag, role, document verification and excess keys',async()=>{
 let called=0;
 const h=gateway({submitDraft:async()=>{called++;return appId}});
 for(const bad of [
  {...draft,driverId:adminId},{...draft,driver_id:adminId},
  {...draft,status:'approved'},{...draft,role:'admin'},
  {...draft,insuranceVerified:true},{...draft,evidence_unverified:false},
  {...draft,service_role:'secret'},
  {...draft,plate:'abc123'},{...draft,plate:'ABC 123'},
  {...draft,municipalityCode:'asuncion'},
  {...draft,kind:'MOTO'},{...draft,service:'moto_pasajero'},
  {...draft,requestKey:'not uuid'},{...draft,passengerCapacity:2},
  {...draft,year:'2020'},{...draft,brand:' '},
  {...draft,service:'__proto__'}
 ]){
  const r=await h(request(bad));
  assert.equal(r.status,400,JSON.stringify(bad));
 }
 assert.equal(called,0);
});
test('accepts MOTO application draft but never conveys approval',async()=>{
 const h=gateway();
 const body={...draft,kind:'MOTO',service:'moto_pasajero',plate:'MOT123',passengerCapacity:1};
 const r=await h(request(body));
 assert.deepEqual(r,{status:202,body:{applicationId:appId,status:'pending',evidenceVerified:false,liveTripsEnabled:false}});
});
test('does not allow unauthenticated, revoked or unconfirmed sessions',async()=>{
 let calls=0;
 const h=gateway({submitDraft:async()=>{calls++;return appId}});
 assert.equal((await h({...request(),headers:{}})).status,401);
 assert.equal((await h({...request(),headers:{authorization:'Bearer service_role'}})).status,401);
 assert.equal((await h({...request(),headers:{authorization:'Basic user:password'}})).status,401);
 const e=gateway({verifyAccessToken:async()=>{throw new Error('revoked')},submitDraft:async()=>{calls++;return appId}});
 assert.equal((await e(request())).status,401);
 const noConfirm=gateway({verifyAccessToken:async()=>({id:userId,email_confirmed_at:null})});
 assert.equal((await noConfirm(request())).status,401);
 const anonymous=gateway({verifyAccessToken:async()=>({...identity,is_anonymous:true})});
 assert.equal((await anonymous(request())).status,401);
 assert.equal(calls,0);
});
test('only POST and explicitly named staging intake/review routes are allowed',async()=>{
 const h=gateway();
 assert.equal((await h({...request(),method:'GET'})).status,405);
 assert.equal((await h({...request(),path:'/v1/live/ride'})).status,404);
 assert.equal((await h({...request(),path:'/v1/staging/payments'})).status,404);
});
test('review binds reviewer from verified JWT and never treats approved status as ride authorization',async()=>{
 let params;
 const h=gateway({
  verifyAccessToken:async()=>({...identity,id:adminId}),
  reviewVehicle:async p=>{params=p;return auditId}
 });
 const r=await h(request(review,reviewRoute));
 assert.deepEqual(r,{status:200,body:{auditId,commercialRidesEnabled:false}});
 assert.equal(params._reviewer_id,adminId);
 assert.equal(params._vehicle_id,review.vehicleId);
 assert.equal(params._approve,true);
 assert.equal('user_role' in params,false);
});
test('review forbids spoofing reviewer role, direct approval, malformed reason',async()=>{
 let calls=0;
 const h=gateway({reviewVehicle:async()=>{calls++;return auditId}});
 for(const bad of [
  {...review,reviewerId:adminId},{...review,role:'admin'},
  {...review,driverId:adminId},{...review,review_status:'approved'},
  {...review,vehicleId:'???'},{...review,reason:'short'},
  {...review,reason:' Valid reviewer, bad whitespace'},
  {...review,approve:'true'}, {...review,requestKey:'bad'},
 ]){
  const r=await h(request(bad,reviewRoute));
  assert.equal(r.status,400,JSON.stringify(bad));
 }
 assert.equal(calls,0);
});
test('DB errors and internal details are never echoed to client',async()=>{
 const h=gateway({submitDraft:async()=>{throw new Error('private license image path or DB schema secret')}});
 const r=await h(request());
 assert.equal(r.status,409);
 assert.doesNotMatch(JSON.stringify(r),/private license|schema secret/);
 const invalid=gateway({submitDraft:async()=>({id:appId})});
 assert.equal((await invalid(request())).status,503);
});

const stageRoute='/v1/staging/admin/materialize-pending';
const pendingBody={
 requestKey:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 applicationId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
};
test('pending inventory stage takes reviewer from verified Auth, never payload',async()=>{
 let params,checked;
 const h=gateway({
  verifyAccessToken:async t=>{checked=t;return {...identity,id:adminId}},
  stagePending:async p=>{params=p;return appId}
 });
 const r=await h(request(pendingBody,stageRoute));
 assert.deepEqual(r,{status:202,body:{
  vehicleId:appId,status:'pending',evidenceVerified:false,commercialRidesEnabled:false
 }});
 assert.equal(params._reviewer_id,adminId);
 assert.equal(params._application_id,pendingBody.applicationId);
 assert.equal(params._request_key,pendingBody.requestKey);
 assert.equal('role' in params,false);
 assert.ok(checked.startsWith('aaaa'));
});
test('pending inventory stage rejects spoofed reviewer/approved flags, unknown fields and invalid UUIDs',async()=>{
 let calls=0;
 const h=gateway({stagePending:async()=>{calls++;return appId}});
 for(const invalid of [
  {...pendingBody,reviewerId:adminId},
  {...pendingBody,_reviewer_id:adminId},
  {...pendingBody,driverId:userId},
  {...pendingBody,role:'admin'},
  {...pendingBody,status:'approved'},
  {...pendingBody,evidenceVerified:true},
  {...pendingBody,commercialRidesEnabled:true},
  {...pendingBody,requestKey:'not-uuid'},
  {...pendingBody,applicationId:'not-uuid'}
 ]){
  const r=await h(request(invalid,stageRoute));
  assert.equal(r.status,400,JSON.stringify(invalid));
 }
 assert.equal(calls,0);
});
test('pending stage remains closed when backend adapter is absent or role gate fails',async()=>{
 const noAdapter=gateway();
 assert.equal((await noAdapter(request(pendingBody,stageRoute))).status,503);
 const reject=gateway({stagePending:async()=>{throw new Error('admin role absent SQL private')}})
 const r=await reject(request(pendingBody,stageRoute));
 assert.equal(r.status,409);
 assert.doesNotMatch(JSON.stringify(r),/private|role absent/);
});
