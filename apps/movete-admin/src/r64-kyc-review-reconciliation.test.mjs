import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminExperience} from './admin-experience.mjs';

const T=1800000000000;
const id=n=>'423e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const auth=(subject=id(1),token='synthetic-admin-jwt-123456789abcdef')=>({
 role:'admin',subject,mfaVerified:true,token,expiresAt:T+120000
});
const kyc=revision=>({
 scope:'admin.kyc.read',revision,generatedAt:T-100,
 expiresAt:T+20000,nextCursor:null,items:[{
  vehicleId:id(2),vehicleKind:'AUTO',applicationStatus:'under_review',
  licenseStatus:'valid',insuranceStatus:'valid',inspectionStatus:'pending',
  reviewRevision:revision
 }]
});
const mockReply=data=>({
 ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)
});
function appWith({reviewVehicle=async()=>({ok:true,status:200}),getPage=()=>kyc(8),
 getUser=()=>auth()}={}){
 let postHits=0,getHits=0;
 const app=createAdminExperience({
  now:()=>T,
  authProvider:{readSession:async()=>getUser(),signOut:async()=>{}},
  gateway:{isConfigured:()=>true,reviewVehicle:async dto=>{
   postHits++;return reviewVehicle(dto);
  }},
  readGatewayOptions:{
   enabled:true,certifiedContracts:['kyc'],
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async()=>{getHits++;return mockReply(getPage());}
  }
 });
 return {app,posts:()=>postHits,reads:()=>getHits};
}
test('R64 simultaneous KYC decisions emit one POST only',async()=>{
 let release;
 const wait=new Promise(resolve=>release=resolve);
 const f=appWith({reviewVehicle:async()=>wait});
 await f.app.refreshSession();
 assert.equal(f.app.readKyc(kyc(7)),true);
 const first=f.app.reviewVehicle({vehicleId:id(2)});
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).code,
  'ADMIN_REVIEW_IN_FLIGHT');
 assert.equal(f.posts(),1);
 release({ok:true,status:200});
 assert.equal((await first).ok,true);
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).code,
  'KYC_REVIEW_RECONCILIATION_REQUIRED');
 assert.equal(f.posts(),1);
});
test('R64 uncertain result is never retried as another KYC POST',async()=>{
 const f=appWith({reviewVehicle:async()=>{throw Error('private provider secret');}});
 await f.app.refreshSession();
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).code,'NETWORK_OR_TIMEOUT');
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).code,
  'KYC_REVIEW_RECONCILIATION_REQUIRED');
 assert.equal(f.posts(),1);
 assert.equal(f.app.snapshot().kyc,null);
});
test('R64 same-revision server KYC page cannot unblock review after uncertain ACK',async()=>{
 let version=4;
 const f=appWith({getPage:()=>kyc(version)});
 await f.app.refreshSession();
 f.app.readKyc(kyc(version));
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).ok,true);
 assert.equal((await f.app.syncFromServer('kyc')).code,'KYC_REVIEW_REVISION_NOT_ADVANCED');
 assert.equal(f.app.snapshot().kyc,null);
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).code,
  'KYC_REVIEW_RECONCILIATION_REQUIRED');
 assert.equal(f.posts(),1);
 version=5;
 assert.equal((await f.app.syncFromServer('kyc')).ok,true);
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).ok,true);
 assert.equal(f.posts(),2);
});
test('R64 direct local KYC injection is not an authoritative reconciliation',async()=>{
 const f=appWith();await f.app.refreshSession();
 f.app.readKyc(kyc(7));
 await f.app.reviewVehicle({vehicleId:id(2)});
 assert.equal(f.app.readKyc(kyc(9)),true);
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).code,
  'KYC_REVIEW_RECONCILIATION_REQUIRED');
 assert.equal(f.posts(),1);
});
test('R64 unknown KYC provider errors are sanitized and cannot disclose raw PII',async()=>{
 const f=appWith({reviewVehicle:async()=>({
  ok:false,code:'PHONE_0981123456_SECRET_JWT'
 })});
 await f.app.refreshSession();
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).code,'REVIEW_NOT_CONFIRMED');
 assert.equal(JSON.stringify(f.app.snapshot()).includes('0981123456'),false);
 assert.equal(f.posts(),1);
});
test('R64 old Admin response after session change cannot erase new session',async()=>{
 let current=auth(),release;
 const wait=new Promise(resolve=>release=resolve);
 const f=appWith({getUser:()=>current,reviewVehicle:async()=>wait});
 await f.app.refreshSession();
 const old=f.app.reviewVehicle({vehicleId:id(2)});
 current=auth(id(9));
 assert.equal((await f.app.refreshSession()).ok,true);
 assert.equal(f.app.readKyc(kyc(9)),true);
 release({ok:true,status:200});
 assert.equal((await old).code,'STALE_SESSION_RESPONSE');
 assert.equal(f.app.snapshot().account.subject,id(9));
 assert.equal(f.app.snapshot().kyc.revision,9);
});
test('R64 owner role cannot invoke Admin KYC decision transport',async()=>{
 const f=appWith({getUser:()=>({...auth(),role:'owner'})});
 await f.app.refreshSession();
 assert.equal((await f.app.reviewVehicle({vehicleId:id(2)})).code,'FORBIDDEN');
 assert.equal(f.posts(),0);
});
