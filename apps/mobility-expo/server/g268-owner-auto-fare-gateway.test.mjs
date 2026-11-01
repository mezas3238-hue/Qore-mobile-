import test from 'node:test';
import assert from 'node:assert/strict';
import {createG268OwnerAutoFareGateway} from './g268-owner-auto-fare-gateway.mjs';

const ref='mrjzxftsdxzepzbcuids';
const at=Date.parse('2026-10-31T18:00:00Z');
const owner='00000000-0000-4000-8000-000000000901';
const session='00000000-0000-4000-8000-000000000911';
const req='00000000-0000-4000-8000-000000000929';
const path='/v1/staging/owner/auto-fares/ASUNCION_FIXTURE';
const body={requestKey:req,basePyg:8000,perKmPyg:1000,
 perMinutePyg:200,minimumPyg:10000,commissionBps:1800};
const claims={id:owner,sessionId:session,tokenIatMs:at-30000,
 expiresAtMs:at+1800000,is_anonymous:false};
const proof={verifiedByProvider:true,assuranceLevel:'aal2',
 userId:owner,sessionId:session,verifiedAtMs:at-5000,
 expiresAtMs:claims.expiresAtMs};
const received={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ruleKey:'G265_'+req.replace(/-/g,''),zoneTag:'ASUNCION_FIXTURE',
 commissionBps:1800,commissionPercent:18,active:true,idempotent:false};
function setup(changes={}){
 const calls=[];
 const gateway=createG268OwnerAutoFareGateway({
  projectRef:ref,environment:'isolated_staging',qaOnly:true,
  liveEnabled:false,now:()=>at,
  verifyAccessToken:async token=>{calls.push(['token',token]);return changes.claims??claims;},
  verifySessionNotRevoked:async p=>{calls.push(['session',p]);return changes.active??true;},
  loadExclusiveBackofficeRole:async u=>{calls.push(['role',u]);return changes.role??'owner';},
  verifyBackofficeMfa:async p=>{calls.push(['mfa',p]);return changes.proof??proof;},
  allowRequest:p=>{calls.push(['rate',p]);return changes.allowed??true;},
  publishFare:async p=>{calls.push(['rpc',p]);return changes.receipt??received;}
 });
 return {gateway,calls,run:(patch={})=>gateway({
  method:'POST',path,headers:{authorization:'Bearer '+'x'.repeat(60)},body,...patch
 })};
}
test('G268 Owner AAL2 publishes verified Auto fare and never trusts client actor/session',async()=>{
 const s=setup();const r=await s.run();
 assert.equal(r.status,200);assert.deepEqual(r.body,received);
 assert.deepEqual(s.calls.map(x=>x[0]),['token','session','role','mfa','rate','rpc']);
 const params=s.calls.at(-1)[1];
 assert.deepEqual(params,{ownerId:owner,sessionId:session,tokenIatMs:claims.tokenIatMs,
  zoneTag:'ASUNCION_FIXTURE',requestKey:req,basePyg:8000,
  perKmPyg:1000,perMinutePyg:200,minimumPyg:10000,commissionBps:1800});
});
test('G268 rejects missing bearer, foreign JSON keys, bad commission and GET before any provider calls',async()=>{
 const s=setup();
 for(const patch of [
  {method:'GET'},
  {headers:{}},
  {body:{...body,ownerId:owner}},
  {body:{...body,commissionBps:3001}},
  {body:{...body,requestKey:'bad'}},
  {path:'/v1/staging/owner/auto-fares/INVALID-zone'}
 ]){
  assert.notEqual((await s.run(patch)).status,200);
 }
 assert.equal(s.calls.length,0);
});
test('G268 revocation, wrong admin role, expired token and no MFA fail closed before SQL',async()=>{
 for(const [patch,status] of [
  [{active:false},401],
  [{role:'admin'},403],
  [{claims:{...claims,expiresAtMs:at-1}},401],
  [{claims:{...claims,tokenIatMs:null}},401],
  [{proof:{...proof,assuranceLevel:'aal1'}},403],
  [{proof:{...proof,userId:'00000000-0000-4000-8000-000000000333'}},403],
  [{allowed:false},429]
 ]){
  const s=setup(patch);
  assert.equal((await s.run()).status,status);
  assert(!s.calls.some(x=>x[0]==='rpc'));
 }
});
test('G268 refuses contradictory server receipt and failing RPC',async()=>{
 const s=setup({receipt:{...received,commissionBps:2500}});
 assert.equal((await s.run()).status,503);
 const t=setup({receipt:{...received,commercialEnabled:true}});
 assert.equal((await t.run()).status,503);
 const u=setup();
 const gateway=createG268OwnerAutoFareGateway({
  projectRef:ref,environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  verifyAccessToken:async()=>claims,
  verifySessionNotRevoked:async()=>true,loadExclusiveBackofficeRole:async()=> 'owner',
  verifyBackofficeMfa:async()=>proof,allowRequest:()=>true,
  publishFare:async()=>{throw Error('DB provider outage');},now:()=>at
 });
 const r=await gateway({method:'POST',path,headers:{authorization:'Bearer '+'x'.repeat(60)},body});
 assert.equal(r.status,409);
 assert.equal(r.body.commercialEnabled,false);
});
test('G268 refuses LIVE and unconfigured critical adapters at construction',()=>{
 assert.throws(()=>createG268OwnerAutoFareGateway({
  projectRef:ref,environment:'production',qaOnly:true,liveEnabled:false
 }));
 assert.throws(()=>createG268OwnerAutoFareGateway({
  projectRef:ref,environment:'isolated_staging',qaOnly:true,liveEnabled:true
 }));
});
