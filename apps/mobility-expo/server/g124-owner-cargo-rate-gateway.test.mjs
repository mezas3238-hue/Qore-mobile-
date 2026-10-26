import test from 'node:test';
import assert from 'node:assert/strict';
import {createG124OwnerCargoRateGateway} from './g124-owner-cargo-rate-gateway.mjs';
const owner='12400000-0000-4124-8124-000000000001';
const session='12400000-0000-4124-8124-000000000002';
const token='g124-provider-verified-owner-token-for-ci';
const at=1790000000000;
const body={requestKey:'12400000-0000-4124-8124-000000000003',basePyg:3200,
 perKmPyg:1200,perMinutePyg:100,minimumPyg:5500,
 commissionBps:950,durationDays:30};
const receipt={vehicleKind:'AUTO',cargoZone:'ASUNCION',
 ruleId:'12400000-0000-4124-8124-000000000004',
 ruleVersion:'cargo_auto_asuncion_v1',version:1,basePyg:3200,
 perKmPyg:1200,perMinutePyg:100,minimumPyg:5500,commissionBps:950,
 active:true,validUntil:'2026-12-01T15:00:00Z',
 mode:'STAGING_DEMO_ONLY',liveEnabled:false,
 passengerSubsidyPolicyApplicable:false};
function make({role='owner',aal='aal2',revoked=false,read=null}={}){
 let writes=0;
 const api=createG124OwnerCargoRateGateway({
  projectRef:'staging1234567890abcd',environment:'isolated_staging',
  qaOnly:true,liveEnabled:false,
  verifyAccessToken:async value=>{
   if(value!==token)throw Error('bad auth');
   return {id:owner,sessionId:session,is_anonymous:false,expiresAtMs:at+600000};
  },
  verifySessionNotRevoked:async()=>!revoked,
  loadExclusiveBackofficeRole:async()=>role,
  verifyBackofficeMfa:async()=>({verifiedByProvider:true,
   assuranceLevel:aal,userId:owner,sessionId:session,
   verifiedAtMs:at-1000,expiresAtMs:at+300000}),
  allowRequest:()=>true,readPolicy:async()=>read,
  changePolicy:async()=>{writes++;return receipt;},now:()=>at
 });
 return {call:(method='POST',payload=body,headers={authorization:'Bearer '+token})=>
  api({method,path:'/v1/staging/owner/delivery-rates/AUTO/ASUNCION',
   headers,body:payload}),writes:()=>writes};
}
test('G124 requires exclusive Owner, provider AAL2 and active session',async()=>{
 for(const cfg of [{role:'admin'},{aal:'aal1'},{revoked:true}]){
  const f=make(cfg);
  const out=await f.call();assert([401,403].includes(out.status));
  assert.equal(f.writes(),0);
 }
 const f=make();
 assert.equal((await f.call('POST',{...body,subsidyBps:1000})).status,400);
 assert.equal((await f.call('POST',{...body,commissionBps:3500})).status,400);
 assert.equal((await f.call('POST',body,{})).status,401);
 assert.equal(f.writes(),0);
});
test('G124 verifies response and does not invent unavailable tariff',async()=>{
 const f=make();assert.deepEqual((await f.call()).body,receipt);
 assert.equal(f.writes(),1);
 assert.equal((await f.call('GET',null)).status,404);
 const f2=make({read:receipt});
 assert.equal((await f2.call('GET',null)).body.ruleId,receipt.ruleId);
 assert.equal(f2.writes(),0);
});
