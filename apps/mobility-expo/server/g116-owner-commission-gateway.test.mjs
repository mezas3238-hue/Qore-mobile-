import test from 'node:test';
import assert from 'node:assert/strict';
import {createG116OwnerCommissionGateway} from './g116-owner-commission-gateway.mjs';
const owner='11600000-0000-4116-8116-000000000001';
const session='11600000-0000-4116-8116-000000000002';
const key='11600000-0000-4116-8116-000000000003';
const token='qa-owner-aal2-staging-jwt-123456789';
const now=1900000000000;
const path='/v1/staging/owner/commissions/AUTO_RIDE';
const snapshot=(commissionBps,version)=>({serviceKind:'AUTO_RIDE',
 commissionBps,subsidyBps:1000,version,
 mode:'STAGING_DEMO_ONLY',productionEnabled:false});
function fixture({role='owner',mfa=true,revoked=false}={}){
 let rate=snapshot(1500,1),writes=0;
 const gate=createG116OwnerCommissionGateway({
  projectRef:'staging1234567890abcd',environment:'isolated_staging',
  qaOnly:true,liveEnabled:false,now:()=>now,
  verifyAccessToken:async value=>{
   if(value!==token)throw Error('Invalid IdP');
   return {id:owner,sessionId:session,is_anonymous:false,
    expiresAtMs:now+600000};
  },
  verifySessionNotRevoked:async()=>!revoked,
  loadExclusiveBackofficeRole:async()=>role,
  verifyBackofficeMfa:async()=>mfa?{verifiedByProvider:true,
   userId:owner,sessionId:session,assuranceLevel:'aal2',
   verifiedAtMs:now-1000,expiresAtMs:now+300000}:null,
  allowRequest:()=>true,
  readPolicy:async()=>rate,
  changePolicy:async ({actorId,serviceKind,requestKey,commissionBps})=>{
   assert.equal(actorId,owner);assert.equal(serviceKind,'AUTO_RIDE');
   assert.equal(requestKey,key);writes++;
   rate=snapshot(commissionBps,rate.version+1);return rate;
  }
 });
 const call=(method='GET',body,authorization='Bearer '+token)=>
  gate({method,path,headers:{authorization},body});
 return {call,writes:()=>writes};
}
test('G116 Owner AAL2 safely reads and modifies server commission without modifying subsidy',async()=>{
 const f=fixture();
 assert.equal((await f.call()).body.commissionBps,1500);
 const updated=await f.call('POST',{requestKey:key,commissionBps:1800});
 assert.equal(updated.status,200);
 assert.deepEqual(updated.body,snapshot(1800,2));
 assert.equal((await f.call()).body.commissionBps,1800);
 assert.equal(f.writes(),1);
});
test('G116 denies Admin, Passenger, missing MFA, revoked Owner and invalid token',async()=>{
 for(const options of [{role:'admin'},{role:'passenger'},
  {mfa:false},{revoked:true}]){
  const f=fixture(options);
  assert([401,403].includes((await f.call('POST',{
   requestKey:key,commissionBps:1600})).status));
  assert.equal(f.writes(),0);
 }
 const f=fixture();
 assert.equal((await f.call('POST',{requestKey:key,commissionBps:1600},
  'Bearer incorrect-token-123456789')).status,401);
 assert.equal(f.writes(),0);
});
test('G116 rejects unwanted subsidy field, commission below subsidy and above cap',async()=>{
 const f=fixture();
 for(const body of [
  {requestKey:key,commissionBps:900},
  {requestKey:key,commissionBps:3100},
  {requestKey:key,commissionBps:1800,subsidyBps:0},
  {requestKey:'bad-key',commissionBps:1500},
  {commissionBps:1800}]){
  assert.equal((await f.call('POST',body)).status,400);
 }
 assert.equal(f.writes(),0);
});
