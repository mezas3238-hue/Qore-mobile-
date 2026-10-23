import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverEnrollmentGateway,G18_ENROLLMENT_LIVE_ENABLED as API_LIVE}
 from './g18-driver-enrollment-gateway.mjs';
import {createDriverEnrollmentRepository,G18_ENROLLMENT_LIVE_ENABLED as DB_LIVE}
 from './g18-driver-enrollment-repository.mjs';
const passenger='11111111-1111-4111-8111-111111111111';
const driverId='22222222-2222-4222-8222-222222222222';
const requestKey='33333333-3333-4333-8333-333333333333';
const receipt='44444444-4444-4444-8444-444444444444';
const token='a'.repeat(60);
const request={method:'POST',path:'/v1/staging/driver/enrollment',
 headers:{authorization:'Bearer '+token},
 body:{requestKey,driverConsent:true}};
function gateway(overrides={}){
 const calls=[];
 const handle=createDriverEnrollmentGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async()=>({id:passenger,is_anonymous:false,
   phone_confirmed_at:'2026-10-22T00:00:00Z'}),
  authorizeNewDriver:async id=>id===passenger,
  allowRequest:details=>{calls.push(['rate',details]);return true;},
  enroll:async input=>{calls.push(['enroll',input]);return receipt;},
  ...overrides
 });
 return {handle,calls};
}
test('G18 always denies LIVE and transitions only verified consenting identity',async()=>{
 assert.equal(API_LIVE,false);assert.equal(DB_LIVE,false);
 const {handle,calls}=gateway();
 const reply=await handle(request);
 assert.deepEqual(reply,{status:202,body:{mode:'STAGING_DEMO_ONLY',
  enrollmentId:receipt,status:'pending_compliance',
  driverEligible:false,liveOperationsEnabled:false}});
 assert.deepEqual(calls.at(-1),['enroll',
  {driverId:passenger,requestKey,consent:true}]);
 assert.doesNotMatch(JSON.stringify(reply),/phone|email|driverId|passengerId|token/i);
});
test('G18 rejects auto-enrollment, forged identities and invalid role',async()=>{
 for(const body of [
  {...request.body,driverConsent:false},
  {...request.body,driverId:driverId},
  {...request.body,requestKey:'invalid'},
  {...request.body,driverConsent:'true'},null,{}
 ]){
  assert.equal((await gateway().handle({...request,body})).status,400);
 }
 assert.equal((await gateway().handle({...request,headers:{}})).status,401);
 assert.equal((await gateway({verifyAccessToken:async()=>{throw Error('invalid')}})
  .handle(request)).status,401);
 assert.equal((await gateway({verifyAccessToken:async()=>({id:passenger,
  is_anonymous:true,email_confirmed_at:'2026-10-22'})}).handle(request)).status,401);
 assert.equal((await gateway({authorizeNewDriver:async()=>false})
  .handle(request)).status,403);
 assert.equal((await gateway({allowRequest:()=>false}).handle(request)).status,429);
 assert.equal((await gateway().handle({...request,method:'GET'})).status,404);
 assert.equal((await gateway().handle({...request,path:request.path+'?role=driver'})).status,404);
});
test('G18 fails closed on backend errors and invalid receipts',async()=>{
 assert.equal((await gateway({authorizeNewDriver:async()=>{throw Error('db')}})
  .handle(request)).status,503);
 assert.equal((await gateway({enroll:async()=>{throw Error('private')}})
  .handle(request)).status,409);
 assert.equal((await gateway({enroll:async()=>null}).handle(request)).status,409);
});
test('G18 repository only sends verified actor UUID with stable idempotency key',async()=>{
 const calls=[];
 const repository=createDriverEnrollmentRepository({rpc:async(name,args)=>{
  calls.push([name,args]);return {data:receipt,error:null};
 }});
 assert.equal(await repository.enroll({driverId:passenger,requestKey,consent:true}),receipt);
 assert.deepEqual(calls,[['mobility_stage_enroll_exclusive_driver',
  {_driver_id:passenger,_request_key:requestKey,_consent:true}]]);
 await assert.rejects(()=>repository.enroll({driverId:passenger,requestKey,consent:false}));
 await assert.rejects(()=>repository.enroll({driverId:'bad',requestKey,consent:true}));
 const broken=createDriverEnrollmentRepository({rpc:async()=>({data:receipt,
  error:{message:'db'}})});
 await assert.rejects(()=>broken.enroll({driverId:passenger,requestKey,consent:true}));
 assert.throws(()=>createDriverEnrollmentRepository({}),/Trusted G18/);
});
