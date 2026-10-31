import test from 'node:test';
import assert from 'node:assert/strict';
import {createG156MerchantInboxGateway} from './g156-merchant-inbox-gateway.mjs';
import {createG173MerchantVerifiedMutationGateway} from './g173-merchant-verified-mutation-gateway.mjs';

const USER='25100000-0000-4251-8251-000000000001';
const SESSION='25100000-0000-4251-8251-000000000002';
const MERCHANT='25100000-0000-4251-8251-000000000003';
const ORDER='25100000-0000-4251-8251-000000000004';
const KEY='25100000-0000-4251-8251-000000000005';
const NOW=1793448000000;
const IAT=NOW-30_000;
const TOKEN='provider-attested-merchant-session-STAGING-only-token';
const actor=()=>({id:USER,sessionId:SESSION,
 tokenIatMs:IAT,expiresAtMs:NOW+60_000,is_anonymous:false});
const request=(path,method='GET',body)=>({path,method,headers:{
 authorization:'Bearer '+TOKEN},...(body===undefined?{}:{body})});
const validateRevocation=(seen,accept=true)=>async scope=>{
 seen.push(scope);
 assert.deepEqual(Object.keys(scope).sort(),
  ['at','sessionId','tokenIatMs','userId'].sort());
 assert.equal(scope.userId,USER);
 assert.equal(scope.sessionId,SESSION);
 assert.equal(scope.tokenIatMs,IAT);
 assert.equal(scope.at,NOW);
 return accept;
};
test('G251 merchant inbox checks provider JWT iat before and after reading SQL',async()=>{
 const seen=[];let calls=0;
 const gate=createG156MerchantInboxGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>NOW,verifyAccessToken:async()=>actor(),
  verifySessionNotRevoked:validateRevocation(seen),
  allowRequest:()=>true,loadInbox:async({actorId,merchantId,tokenIatMs})=>{
   calls++;assert.equal(actorId,USER);assert.equal(merchantId,MERCHANT);
   assert.equal(tokenIatMs,IAT);
   return {merchantId:MERCHANT,orders:[],limit:20,serverPersisted:true,
    qaOnly:true,productionEnabled:false};
  }
 });
 const result=await gate(request('/v1/staging/merchant/'+MERCHANT+'/orders/inbox'));
 assert.equal(result.status,200);
 assert.equal(result.body.liveCommerceEnabled,false);
 assert.equal(calls,1);assert.equal(seen.length,2);
});
test('G251 merchant mutation uses original signed token iat in both revocation gates',async()=>{
 const seen=[];let commits=0;
 const gate=createG173MerchantVerifiedMutationGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>NOW,verifyAccessToken:async()=>actor(),
  verifySessionNotRevoked:validateRevocation(seen),
  allowRequest:()=>true,legacyGateway:async()=>({status:503}),
  runMutation:async({actorId,sessionId,tokenIatMs,orderId,kind,event,eventKey})=>{
   commits++;assert.equal(actorId,USER);assert.equal(sessionId,SESSION);
   assert.equal(tokenIatMs,IAT);assert.equal(orderId,ORDER);
   assert.equal(kind,'transition');assert.equal(event,'ready');
   assert.equal(eventKey,KEY);return KEY;
  }
 });
 const result=await gate(request('/v1/staging/merchant/orders/'+ORDER+
  '/transition','POST',{event:'ready',eventKey:KEY}));
 assert.equal(result.status,200);
 assert.equal(result.body.liveCommerceEnabled,false);
 assert.equal(commits,1);assert.equal(seen.length,2);
});
test('G251 reject revoked merchant inbox before SQL',async()=>{
 let calls=0;
 const gate=createG156MerchantInboxGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>NOW,verifyAccessToken:async()=>actor(),
  verifySessionNotRevoked:async()=>false,allowRequest:()=>true,
  loadInbox:async()=>{calls++;return null;}
 });
 const result=await gate(request('/v1/staging/merchant/'+MERCHANT+'/orders/inbox'));
 assert.equal(result.status,401);
 assert.equal(calls,0);
});
test('G251 reject revoked merchant mutation before persistent write',async()=>{
 let commits=0;
 const gate=createG173MerchantVerifiedMutationGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>NOW,verifyAccessToken:async()=>actor(),
  verifySessionNotRevoked:async()=>false,allowRequest:()=>true,
  legacyGateway:async()=>({status:503}),
  runMutation:async()=>{commits++;return KEY;}
 });
 const result=await gate(request('/v1/staging/merchant/orders/'+ORDER+
  '/transition','POST',{event:'ready',eventKey:KEY}));
 assert.equal(result.status,401);assert.equal(commits,0);
});
test('G251 post-commit revocation never reports false success',async()=>{
 let checks=0,commits=0;
 const gate=createG173MerchantVerifiedMutationGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>NOW,verifyAccessToken:async()=>actor(),
  verifySessionNotRevoked:async scope=>{
   assert.equal(scope.tokenIatMs,IAT);
   return ++checks===1;
  },
  allowRequest:()=>true,legacyGateway:async()=>({status:503}),
  runMutation:async()=>{commits++;return KEY;}
 });
 const result=await gate(request('/v1/staging/merchant/orders/'+ORDER+
  '/transition','POST',{event:'ready',eventKey:KEY}));
 assert.equal(result.status,401);assert.equal(checks,2);assert.equal(commits,1);
 assert.equal(result.body.productionEnabled,false);
});
