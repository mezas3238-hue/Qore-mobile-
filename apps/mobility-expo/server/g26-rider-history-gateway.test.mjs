import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRiderHistoryGateway} from './g26-rider-history-gateway.mjs';
const projectRef='staging1234567890abcd';
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const serviceId='33333333-3333-4333-8333-333333333333';
const at=200_000;
const good={serviceId,kind:'RIDE',status:'completed',createdAt:180_000,revision:3};
const req={method:'GET',path:'/v1/staging/rider/history',
 headers:{authorization:'Bearer '+'x'.repeat(45)}};
function fixture(override={}){
 const calls=[];
 const gateway=createQoreRiderHistoryGateway({
  projectRef,now:()=>at,
  verifyAccessToken:async()=>({id:owner,is_anonymous:false,
   email_confirmed_at:'2026-10-22T10:00:00Z'}),
  authorizePassenger:async id=>{calls.push({auth:id});return true;},
  allowRequest:()=>true,
  loadOwnHistory:async input=>{calls.push({db:input});return [good];},
  ...override
 });
 return {calls,gateway};
}
test('only confirmed JWT passenger sees sanitized own DTO, bounded to 60 seconds',async()=>{
 const {calls,gateway}=fixture();
 const out=await gateway(req);
 assert.equal(out.status,200);
 assert.deepEqual(out.body,{ownerId:owner,generatedAt:at,
  expiresAt:at+60000,items:[good],nextCursor:null});
 assert.deepEqual(calls,[{auth:owner},{db:{ownerId:owner,limit:51}}]);
 assert.doesNotMatch(JSON.stringify(out),/phone|plate|lat|driverId|documents|service_role/);
});
test('G26 rejects wrong role, token and rate limit before private DB query',async()=>{
 let called=0;
 for(const overrides of [
  {verifyAccessToken:async()=>{throw Error('bearer')}} ,
  {verifyAccessToken:async()=>({id:owner})},
  {authorizePassenger:async()=>false},
  {authorizePassenger:async()=>{throw Error('DB')}},
  {allowRequest:()=>false},
 ]){
  const {gateway}=fixture({...overrides,loadOwnHistory:async()=>{called++;return []}});
  const result=await gateway(req);
  assert.ok([401,403,429,503].includes(result.status));
 }
 const noBearer=await fixture().gateway({...req,headers:{}});
 assert.equal(noBearer.status,401);
 assert.equal(called,0);
});
test('G26 never emits partial, oversized, forged, expired or cross-actor snapshots',async()=>{
 for(const list of [
  Array.from({length:51},(_,i)=>({...good,serviceId:i===0?serviceId:
   (i.toString(16).padStart(8,'0')+'-3333-4333-8333-333333333333')})),
  [{...good,status:'secret'}],
  [{...good,createdAt:at+1}],
  [{...good,ownerId:other}],
  [{...good},{...good}],
  [null]
 ]){
  const {gateway}=fixture({loadOwnHistory:async()=>list});
  assert.equal((await gateway(req)).status,503);
 }
 const broken=fixture({loadOwnHistory:async()=>{throw Error('SQL unavailable')}});
 assert.equal((await broken.gateway(req)).status,503);
 assert.equal((await fixture().gateway({...req,method:'POST'})).status,404);
 assert.equal((await fixture().gateway({...req,path:req.path+'?ownerId='+other})).status,404);
});
