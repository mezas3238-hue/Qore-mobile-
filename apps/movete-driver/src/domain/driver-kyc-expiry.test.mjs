import test from 'node:test';
import assert from 'node:assert/strict';
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
