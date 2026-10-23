import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRiderHistoryGateway} from './g26-rider-history-gateway.mjs';
const projectRef='staging1234567890abcd';
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const serviceId='33333333-3333-4333-8333-333333333333';
const at=Date.parse('2026-10-23T04:20:00Z');
const good={serviceId,kind:'RIDE',status:'completed',createdAt:at-20000,revision:3};
const req={method:'GET',path:'/v1/staging/rider/history',
 headers:{authorization:'Bearer '+'x'.repeat(45)}};
const SECRET='synthetic-history-HMAC-private-signing-material-long';
function fixture(override={}){
 const calls=[];
 const gateway=createQoreRiderHistoryGateway({
  projectRef,now:()=>at,cursorSecrets:{current:SECRET},
  verifyAccessToken:async()=>({id:owner,is_anonymous:false,
   email_confirmed_at:'2026-10-22T10:00:00Z'}),
  authorizePassenger:async id=>{calls.push({auth:id});return true;},
  allowRequest:()=>true,
  loadOwnHistory:async input=>{calls.push({db:input});
   return {items:[good],nextPosition:null};},
  ...override
 });
 return {calls,gateway};
}
test('JWT-only passenger sees private history DTO with no global count cap',async()=>{
 const {calls,gateway}=fixture();
 const out=await gateway(req);
 assert.equal(out.status,200);
 assert.deepEqual(out.body,{ownerId:owner,generatedAt:at,
  expiresAt:at+60000,items:[good],nextCursor:null});
 assert.deepEqual(calls,[{auth:owner},{db:{ownerId:owner,anchorMs:at,after:null}}]);
 assert.doesNotMatch(JSON.stringify(out),/phone|plate|lat|driverId|documents|service_role/);
});
test('auth rejection, rate limiting and invalid query never touch private history DB',async()=>{
 let db=0;
 for(const override of [
  {verifyAccessToken:async()=>{throw Error('token')}},
  {verifyAccessToken:async()=>({id:owner})},
  {authorizePassenger:async()=>false},
  {authorizePassenger:async()=>{throw Error('db')}},
  {allowRequest:()=>false}
 ]){
  const gw=fixture({...override,loadOwnHistory:async()=>{db++;return {items:[],nextPosition:null}}}).gateway;
  const out=await gw(req);
  assert.ok([401,403,429,503].includes(out.status));
 }
 assert.equal((await fixture().gateway({...req,headers:{}})).status,401);
 assert.equal((await fixture().gateway({...req,method:'POST'})).status,404);
 assert.equal((await fixture().gateway({...req,path:req.path+'?ownerId='+other})).status,404);
 assert.equal(db,0);
});
test('G26.1 signed cursor supports next pages, subject binding, tamper rejection and expiry',async()=>{
 const start={time:new Date(at-20000).toISOString().replace('.000Z','.000000Z'),
  id:serviceId,kind:'RIDE'};
 const rows=Array.from({length:50},(_,i)=>({
  serviceId:i===49?serviceId:
   i.toString(16).padStart(8,'0')+'-3333-4333-8333-333333333333',
  kind:'RIDE',status:'completed',createdAt:at-20000,revision:3
 }));
 let index=0; const calls=[];
 const {gateway}=fixture({
  loadOwnHistory:async q=>{
   calls.push(q);index++;
   return index===1?{items:rows,nextPosition:start}:
    {items:[good],nextPosition:null};
  }
 });
 const first=await gateway(req);
 assert.equal(first.status,200);
 assert.equal(first.body.items.length,50);
 assert.match(first.body.nextCursor,/^v1\./);
 assert.ok(first.body.nextCursor.length<=200);
 const headers={...req.headers,'x-qore-history-cursor':first.body.nextCursor};
 const second=await gateway({...req,headers});
 assert.equal(second.status,200);
 assert.equal(second.body.nextCursor,null);
 assert.equal(calls[1].ownerId,owner);
 assert.equal(calls[1].anchorMs,at);
 assert.deepEqual(calls[1].after,start);
 const tampered=first.body.nextCursor.replace(/.$/,ch=>ch==='A'?'B':'A');
 assert.equal((await gateway({...req,headers:{...req.headers,
  'x-qore-history-cursor':tampered}})).status,400);
 const otherGateway=fixture({verifyAccessToken:async()=>({
  id:other,email_confirmed_at:'now',is_anonymous:false
 })}).gateway;
 assert.equal((await otherGateway({...req,headers})).status,400);
 const expired=fixture({now:()=>at+600001}).gateway;
 assert.equal((await expired({...req,headers})).status,400);
 assert.equal(calls.length,2,'Invalid cursors must not query history');
});
test('malformed or oversized pages fail closed, not partial or misleading empty history',async()=>{
 for(const page of [
  {items:Array.from({length:51},()=>good),nextPosition:null},
  {items:[{...good,status:'secret'}],nextPosition:null},
  {items:[{...good,createdAt:at+1}],nextPosition:null},
  {items:[{...good,ownerId:other}],nextPosition:null},
  {items:[good,good],nextPosition:null},
  {items:[null],nextPosition:null},
  {items:[good],nextPosition:{time:'invalid',id:serviceId,kind:'RIDE'}},
  {items:[good],nextPosition:{time:new Date(at).toISOString(),id:other,kind:'RIDE'}},
  {items:null,nextPosition:null}
 ]){
  const {gateway}=fixture({loadOwnHistory:async()=>page});
  assert.equal((await gateway(req)).status,503);
 }
 const unavailable=fixture({loadOwnHistory:async()=>{throw Error('internal')}});
 assert.equal((await unavailable.gateway(req)).status,503);
});
test('G26.1 signing secret and server Auth adapters required before any request',()=>{
 assert.throws(()=>createQoreRiderHistoryGateway({
  projectRef,cursorSecrets:{current:'too-short'},
  verifyAccessToken:async()=>{},authorizePassenger:async()=>{},
  allowRequest:()=>true,loadOwnHistory:async()=>{},now:()=>at
 }),/required/);
});

test('A03 dedicated key rotation verifies prior v1 cursors and re-signs with current key',async()=>{
 const old='historical-private-history-signing-key-release-01';
 const next='independent-private-history-signing-key-release-02';
 const position={time:'2026-10-23T04:19:40.000000Z',id:serviceId,kind:'RIDE'};
 const rows=Array.from({length:50},(_,i)=>({
  serviceId:i===49?serviceId:
   i.toString(16).padStart(8,'0')+'-3333-4333-8333-333333333333',
  kind:'RIDE',status:'completed',createdAt:at-20000,revision:3
 }));
 const loadOwnHistory=async()=>({items:rows,nextPosition:position});
 const make=cursorSecrets=>fixture({cursorSecrets,loadOwnHistory}).gateway;
 const original=await make({current:old})(req);
 assert.equal(original.status,200);
 const oldCursor=original.body.nextCursor;
 const hdr=c=>({...req,headers:{...req.headers,'x-qore-history-cursor':c}});
 const rotated=await make({current:next,previous:old})(hdr(oldCursor));
 assert.equal(rotated.status,200);
 const newCursor=rotated.body.nextCursor;
 assert.notEqual(newCursor,oldCursor);
 assert.ok(newCursor.length<=200);
 assert.equal((await make({current:next})(hdr(newCursor))).status,200);
 assert.equal((await make({current:old})(hdr(newCursor))).status,400);
 assert.equal((await make({current:next})(hdr(oldCursor))).status,400);
});
