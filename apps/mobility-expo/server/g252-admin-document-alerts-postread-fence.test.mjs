import test from 'node:test';
import assert from 'node:assert/strict';
import {createG252AdminDocumentAlertsGateway}
 from './g252-admin-document-alerts-gateway.mjs';
const id=n=>'25200000-0000-4252-8252-'+String(n).padStart(12,'0');
const at=Date.parse('2026-10-31T16:00:00Z'), actor=id(1),session=id(2);
const token='Bearer qore-admin-verified-provider-token-for-g254';
function gateway({verifySessionNotRevoked,resolveExclusiveRole,verifyProviderAal2}={}){
 let reads=0;
 const run=createG252AdminDocumentAlertsGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>at,
  verifyAccessToken:async()=>({id:actor,sessionId:session,
   tokenIatMs:at-1000,expiresAtMs:at+120000,is_anonymous:false}),
  verifySessionNotRevoked:verifySessionNotRevoked??(async()=>true),
  resolveExclusiveRole:resolveExclusiveRole??(async()=> 'admin'),
  verifyProviderAal2:verifyProviderAal2??(async()=>({
   userId:actor,sessionId:session,assuranceLevel:'aal2',
   providerVerified:true,expiresAtMs:at+60000})),
  allowRequest:()=>true,
  readDocumentAlerts:async()=>{
   reads++;return {items:[],hasMore:false,persistedAtMs:at-1000};
  }
 });
 return {run:()=>run({method:'GET',
  path:'/v1/staging/admin/compliance/document-alerts',
  headers:{authorization:token}}),readCount:()=>reads};
}
test('G252 Admin role is rechecked AFTER SQL load and never leaks queue on role downgrade',async()=>{
 let calls=0;
 const x=gateway({resolveExclusiveRole:async()=>++calls===1?'admin':'owner'});
 const res=await x.run();
 assert.equal(x.readCount(),1);
 assert.equal(calls,2);
 assert.equal(res.status,403);
 assert.equal(res.body.code,'G252_ADMIN_REVOKED_AFTER_READ');
 assert.equal(res.body.items,undefined);
});
test('G252 revoked session after read denies even independently verified rows',async()=>{
 let count=0;
 const x=gateway({verifySessionNotRevoked:async()=>++count===1});
 const res=await x.run();
 assert.equal(x.readCount(),1);
 assert.equal(count,2);
 assert.equal(res.status,401);
 assert.equal(res.body.code,'G252_SESSION_REVOKED_AFTER_READ');
});
test('G252 provider MFA downgrading after SQL read denies Admin display',async()=>{
 let n=0;
 const x=gateway({verifyProviderAal2:async()=>{
  n++;return {userId:actor,sessionId:session,
   assuranceLevel:n===1?'aal2':'aal1',providerVerified:true,
   expiresAtMs:at+60000};
 }});
 const res=await x.run();
 assert.equal(x.readCount(),1);
 assert.equal(n,2);
 assert.equal(res.status,403);
 assert.equal(res.body.code,'G252_AAL2_REVOKED_AFTER_READ');
});
test('G252 valid double-checked identity limits snapshot TTL to MFA expiry',async()=>{
 const x=gateway({verifyProviderAal2:async()=>({
  userId:actor,sessionId:session,assuranceLevel:'aal2',
  providerVerified:true,expiresAtMs:at+10000})});
 const res=await x.run();
 assert.equal(res.status,200);
 assert.equal(res.body.expiresAt,at+10000);
 assert.equal(res.body.productionEnabled,false);
 assert.equal(res.body.adminDispatchControl,false);
});
