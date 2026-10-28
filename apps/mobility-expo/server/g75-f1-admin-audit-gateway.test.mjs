import test from 'node:test';
import assert from 'node:assert/strict';
import {createG75AdminF1AuditGateway} from './g75-f1-admin-audit-gateway.mjs';
import {createG75AdminF1Repository} from './g75-f1-admin-audit-repository.mjs';
const id=n=>'75750000-0000-4757-8757-'+String(n).padStart(12,'0');
const admin=id(1),owner=id(2),passenger=id(3),trip=id(4),
 route=id(5),quote=id(6),driver=id(7),session=id(8);
const at=1800000000000,token='verified-admin-aal2-token-abcdefghijklmnop';
const target='/v1/staging/admin/rides/'+trip+'/f1-verification';
const headers={authorization:'Bearer '+token};
const receipt=(p={})=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 viewerId:admin,tripId:trip,routeId:route,quoteId:quote,passengerId:passenger,
 bookingRequestKey:id(9),service:'economico',currency:'PYG',amountGs:15200,
 fareVersion:'qa-g73-f1',revision:1,status:'searching',
 assignmentPersisted:false,driverId:null,observedAt:at-1000,
 expiresAt:at+29000,serverPersisted:true,...p});
const user=()=>({id:admin,sessionId:session,expiresAtMs:at+600000,
 is_anonymous:false,email_confirmed_at:'2026-10-24T00:00:00Z'});
const mfa=()=>({verifiedByProvider:true,userId:admin,sessionId:session,
 assuranceLevel:'aal2',verifiedAtMs:at-1000,expiresAtMs:at+100000});
function app(extra={}){
 let reads=0;
 const handler=createG75AdminF1AuditGateway({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  projectRef:'staging1234567890abcd',now:()=>at,
  verifyAccessToken:async()=>user(),
  verifySessionNotRevoked:async()=>true,
  loadExclusiveBackofficeRole:async()=> 'admin',
  verifyBackofficeMfa:async()=>mfa(),
  allowRequest:()=>true,
  loadAdminRideReceipt:async()=>{reads++;return receipt();},
  ...extra
 });
 return {handler,reads:()=>reads};
}
const request=()=>({method:'GET',path:target,headers});
test('G75 actual A/B exact 19-field Admin F1 owner-backoffice proof',async()=>{
 const f=app();
 const result=await f.handler(request());
 assert.equal(result.status,200);
 assert.deepEqual(result.body,receipt());
 assert.equal(Object.keys(result.body).length,19);
 assert.equal(f.reads(),1);
 assert.equal(result.body.productionEnabled,undefined);
 assert.equal(result.body.status,'searching');
 assert.equal(result.body.driverId,null);
});
test('G75 non-Admin, owner, Passenger and missing AAL2 cannot read SQL',async()=>{
 for(const patch of [
  {loadExclusiveBackofficeRole:async()=> 'owner'},
  {loadExclusiveBackofficeRole:async()=> 'passenger'},
  {loadExclusiveBackofficeRole:async()=> null},
  {verifyBackofficeMfa:async()=>({...mfa(),assuranceLevel:'aal1'})},
  {verifyBackofficeMfa:async()=>({...mfa(),userId:owner})},
  {verifyBackofficeMfa:async()=>({...mfa(),verifiedByProvider:false})},
  {verifySessionNotRevoked:async()=>false}
 ]){
  const f=app(patch);
  assert.notEqual((await f.handler(request())).status,200);
  assert.equal(f.reads(),0);
 }
});
test('G75 no bearer, cookies, forged row, stale DTO, or unknown trip',async()=>{
 const f=app();
 assert.equal((await f.handler({...request(),headers:{}})).status,401);
 assert.equal((await f.handler({...request(),headers:{...headers,cookie:'sid=x'}})).status,401);
 assert.equal((await f.handler({...request(),body:{tripId:trip}})).status,404);
 assert.equal(f.reads(),0);
 for(const fake of [
  receipt({viewerId:owner}),receipt({routeId:owner,tripId:owner}),
  receipt({currency:'USD'}),receipt({status:'assigned',driverId:null}),
  receipt({status:'searching',driverId:driver}),
  receipt({amountGs:0}),receipt({expiresAt:at-1}),
  receipt({debug:'hidden'})
 ]){
  const g=app({loadAdminRideReceipt:async()=>fake});
  assert.equal((await g.handler(request())).status,503);
 }
 assert.equal((await app({loadAdminRideReceipt:async()=>null}).handler(request())).status,404);
});
test('G75 Admin SQL adapter only uses one private source RPC, never raw table',async()=>{
 let call;
 const repo=createG75AdminF1Repository({rpc:async(name,params)=>{
  call={name,params};return {data:receipt(),error:null};
 }});
 assert.deepEqual(await repo.read({actorId:admin,tripId:trip}),receipt());
 assert.deepEqual(call,{
  name:'mobility_stage_g75_admin_f1_receipt',
  params:{_admin_id:admin,_trip_id:trip}
 });
 await assert.rejects(()=>repo.read({actorId:owner,tripId:'forged'}));
});
