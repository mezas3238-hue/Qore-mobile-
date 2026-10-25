import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1AdminAuthorizedQaOptions} from './f1-admin-authorized-qa-options.mjs';
import {createAdminExperience} from './admin-experience.mjs';
const hostname='https://movete-facil-staging.onrender.com';
const admin='f1a70000-0000-41a7-81a7-000000000001';
const trip='f1a70000-0000-41a7-81a7-000000000002';
const other='f1a70000-0000-41a7-81a7-000000000003';
const now=1900000000000;
const fetchImpl=async()=>{throw Error('No request on option initialization');};
const approval={origin:hostname,pinnedOrigin:hostname,
 ownerApproved:true,externalHttpsVerified:true,g75ContractVerified:true,
 persistedPostgresVerified:true,serverMfaVerified:true,
 serverRbacVerified:true,serverRevocationVerified:true,fetchImpl};
const http=(x,status=200)=>({status,ok:status===200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(x)});
const valid=(subject=admin)=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 viewerId:subject,tripId:trip,routeId:'f1a70000-0000-41a7-81a7-000000000004',
 quoteId:'f1a70000-0000-41a7-81a7-000000000005',
 passengerId:other,bookingRequestKey:'f1a70000-0000-41a7-81a7-000000000006',
 service:'economico',currency:'PYG',amountGs:27000,fareVersion:'g99-qa',
 revision:2,status:'cancelled',assignmentPersisted:false,driverId:null,
 observedAt:now-1000,expiresAt:now+20000,serverPersisted:true});
test('R77 Admin G75 real browser wiring is OFF by default and for every partial approval',()=>{
 assert.equal(createF1AdminAuthorizedQaOptions(),null);
 for(const key of ['ownerApproved','externalHttpsVerified','g75ContractVerified',
  'persistedPostgresVerified','serverMfaVerified','serverRbacVerified',
  'serverRevocationVerified']){
  assert.equal(createF1AdminAuthorizedQaOptions({...approval,[key]:false}),null,key);
 }
 assert.equal(createF1AdminAuthorizedQaOptions({...approval,fetchImpl:null}),null);
});
test('R77 rejects HTTP, credentials, path, query, fragment, port, mismatched pin, private IP and unapproved host',()=>{
 for(const origin of ['http://movete-facil-staging.onrender.com',
  'https://admin:pw@movete-facil-staging.onrender.com',
  'https://movete-facil-staging.onrender.com:444',
  'https://movete-facil-staging.onrender.com/path',
  'https://movete-facil-staging.onrender.com?a=1',
  'https://movete-facil-staging.onrender.com#x',
  'https://127.0.0.1','https://localhost','https://evil.example']){
  assert.equal(createF1AdminAuthorizedQaOptions({...approval,origin,pinnedOrigin:origin}),null,origin);
 }
 assert.equal(createF1AdminAuthorizedQaOptions({
  ...approval,pinnedOrigin:'https://different.onrender.com'
 }),null);
});
test('R77 only approved G75 read-only transport exposed, no production or write capabilities',()=>{
 const opts=createF1AdminAuthorizedQaOptions(approval);
 assert(opts);assert.equal(opts.origin,hostname);
 assert.equal(opts.productionEnabled,false);
 assert(Object.isFrozen(opts));
 assert.deepEqual(Object.keys(opts).sort(),[
  'enabled','contractCertified','stagingRuntimeVerified','origin',
  'pinnedOrigin','fetchImpl','productionEnabled'].sort());
});
test('R77 authorized runtime connects F1 Admin GET with verified MFA Admin; never permits Owner or anonymous',async()=>{
 let actor={subject:admin,role:'admin',mfaVerified:true,
  token:'r77-secure-admin-qa-token-abcdefghijkl',expiresAt:now+500000};
 const calls=[];
 const opts=createF1AdminAuthorizedQaOptions({...approval,
  fetchImpl:async(url,init)=>{calls.push({url,init});return http(valid());}});
 const instance=createAdminExperience({
  now:()=>now,authProvider:{readSession:async()=>actor,signOut:async()=>{}},
  f1RideAuditOptions:opts
 });
 await instance.refreshSession();
 assert.equal(instance.snapshot().f1RideAudit.contractReady,true);
 assert.equal((await instance.loadF1RideAudit(trip)).ok,true);
 assert.equal(instance.snapshot().f1RideAudit.item.tripId,trip);
 assert.equal(instance.snapshot().f1RideAudit.item.status,'cancelled');
 assert.equal(instance.snapshot().f1RideAudit.item.productionEnabled,false);
 assert.equal(calls.length,1);
 assert.equal(new URL(calls[0].url).pathname,
  '/v1/staging/admin/rides/'+trip+'/f1-verification');
 assert.equal(calls[0].init.method,'GET');
 assert.equal(calls[0].init.body,undefined);
 assert.equal(JSON.stringify(instance.snapshot()).includes(other),false);
 // The Admin UI may inspect one trip, but no Driver identity or PII.
 await instance.logout();
 assert.equal(instance.snapshot().f1RideAudit.item,null);
 assert.equal(instance.snapshot().authenticated,false);
 actor={...actor,role:'owner'};
 const ownerInst=createAdminExperience({now:()=>now,
  authProvider:{readSession:async()=>actor,signOut:async()=>{}},
  f1RideAuditOptions:opts});
 await ownerInst.refreshSession();
 assert.equal((await ownerInst.loadF1RideAudit(trip)).ok,false);
 assert.equal(calls.length,1);
});
