import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyDriverKycForOffer} from './driver-kyc-expiry.mjs';
import {readDriverKycExpiry,driverKycScreenNotice,assertDriverKycExpirySnapshot}
 from './driver-kyc-expiry.mjs';
const now=Date.parse('2026-10-24T18:00:00Z'),token='driver-verified-token-000000000000000';
const url='https://staging.movetefacil.example';
const base={mode:'STAGING_DEMO_ONLY',state:'BLOCKED_EXPIRED',
 expiredKinds:['licencia'],renewalRequiredKinds:['licencia'],
 expiringSoonKinds:[],nearestExpiryAtMs:now+86400000,
 accountBlocked:true,qaOnboardingActive:false,
 commercialDispatchAuthorized:false,qaOnly:true,productionEnabled:false};
test('Expired license from authoritative HTTPS shows Driver blocking notice and renewal instructions',async()=>{
 const requests=[];
 const data=await readDriverKycExpiry({apiOrigin:url,
  approvedStagingHost:'staging.movetefacil.example',allowedByOwner:true,
  accessToken:token,now:()=>now,
  request:async(u,o)=>{requests.push([u,o]);return {
   status:200,json:async()=>base};}
 });
 assert.deepEqual(data,base);
 assert.equal(requests.length,1);
 assert.equal(requests[0][0],url+'/v1/staging/driver/kyc/validity');
 assert.equal(requests[0][1].method,'GET');
 assert.equal(requests[0][1].headers.authorization,'Bearer '+token);
 const notice=driverKycScreenNotice(data);
 assert.match(notice.text,/licencia de conducir/);
 assert.match(notice.text,/bloqueada/);
 assert.match(notice.text,/Renovalo/);
 assert(!JSON.stringify(data).includes(token));
});
test('Pending photo remains blocked, verified renewal automatically changes UI to QA ready',()=>{
 const pending={...base,state:'BLOCKED_REVIEW',expiredKinds:[],
  renewalRequiredKinds:['licencia']};
 assert.match(driverKycScreenNotice(assertDriverKycExpirySnapshot(pending,now)).text,
  /se recuperará automáticamente/);
 const ok={...base,state:'READY_QA',expiredKinds:[],renewalRequiredKinds:[],
  qaOnboardingActive:true,accountBlocked:false};
 assert.match(driverKycScreenNotice(assertDriverKycExpirySnapshot(ok,now)).text,
  /STAGING/);
 assert.equal(ok.commercialDispatchAuthorized,false);
 const almost={...ok,expiringSoonKinds:['habilitacion']};
 assert.match(driverKycScreenNotice(assertDriverKycExpirySnapshot(almost,now)).text,
  /Próximo vencimiento/);
 const suspended={...ok,state:'SUSPENDED',qaOnboardingActive:false,accountBlocked:true};
 assert.match(driverKycScreenNotice(assertDriverKycExpirySnapshot(suspended,now)).text,
  /suspendida/);
 assert.match(driverKycScreenNotice(null).text,/No se puede comprobar/);
});
test('Forged eligibility, photo/PII, unknown document and inconsistent states rejected',()=>{
 for(const bad of [
  {...base,qaOnboardingActive:true},
  {...base,commercialDispatchAuthorized:true},
  {...base,expiredKinds:[]},
  {...base,expiredKinds:['licencia','licencia']},
  {...base,expiredKinds:['fake']},
  {...base,nearestExpiryAtMs:now-1},
  {...base,objectKey:'sensitive/document.jpg'},
  {...base,productionEnabled:true},
  {...base,state:'READY_QA'},
  {...base,accountBlocked:false}
 ])assert.throws(()=>assertDriverKycExpirySnapshot(bad,now));
});
test('Offline and unauthorized routes never invent successful reactivation',async()=>{
 for(const request of [async()=>{throw Error('down')},
  async()=>({status:401}),async()=>({status:200,json:async()=>({...base,secret:'pii'})})]){
  await assert.rejects(()=>readDriverKycExpiry({apiOrigin:url,
   approvedStagingHost:'staging.movetefacil.example',allowedByOwner:true,
   accessToken:token,request,now:()=>now}));
 }
});

test('C acceptance preflight requires fresh READY_QA on the same driver account',async()=>{
 const actor={role:'driver',userId:'123e4567-e89b-42d3-a456-426614174000',
  accessToken:'driver-verified-staging-token-abcdefgh'};
 const base={mode:'STAGING_DEMO_ONLY',state:'READY_QA',expiredKinds:[],
  renewalRequiredKinds:[],expiringSoonKinds:[],nearestExpiryAtMs:null,
  accountBlocked:false,qaOnboardingActive:true,
  commercialDispatchAuthorized:false,qaOnly:true,productionEnabled:false};
 let session=actor,calls=0;
 const check=overrides=>verifyDriverKycForOffer({
  getSession:async()=>session,
  readStatus:async({accessToken})=>{calls++;
   assert.equal(accessToken,actor.accessToken);
   return base;},...overrides
 });
 const success=await check();
 assert.equal(success.ok,true);assert.equal(calls,1);
 assert(!JSON.stringify(success).includes(actor.accessToken));
 const expired={...base,state:'BLOCKED_EXPIRED',expiredKinds:['licencia'],
  renewalRequiredKinds:['licencia'],accountBlocked:true,qaOnboardingActive:false};
 assert.equal((await check({readStatus:async()=>expired})).ok,false);
 assert.equal((await check({readStatus:async()=>({...base,
  commercialDispatchAuthorized:true})})).ok,false);
 assert.equal((await check({readStatus:async()=>{
  session={...actor,accessToken:actor.accessToken+'changed'};return base;
 }})).code,'STALE_DRIVER_SESSION');
 session=null;
 assert.equal((await check()).ok,false);
});
test('C preflight rejects revoked epoch or offline server without sending any decision',async()=>{
 const actor={role:'driver',userId:'123e4567-e89b-42d3-a456-426614174000',
 accessToken:'driver-verified-staging-token-abcdefgh'};
 assert.equal((await verifyDriverKycForOffer({getSession:async()=>actor,
  readStatus:async()=>{throw Error('offline');}})).ok,false);
 assert.equal((await verifyDriverKycForOffer({getSession:async()=>actor,
  readStatus:async()=>null,isCurrent:()=>false})).ok,false);
});
