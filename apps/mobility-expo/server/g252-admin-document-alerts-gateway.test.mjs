import test from 'node:test';
import assert from 'node:assert/strict';
import {createG252AdminDocumentAlertsGateway,G252_DOCUMENT_ALERTS_LIVE_ENABLED}
 from './g252-admin-document-alerts-gateway.mjs';
const id=n=>'25200000-0000-4252-8252-'+String(n).padStart(12,'0');
const actor=id(1),session=id(2),driver=id(3);
const at=Date.parse('2026-10-31T12:00:00Z');
const bearer='Bearer signed-admin-verified-token-with-mfa-252';
const data={items:[{driverId:driver,kind:'seguro',band:'D01',
 validUntilMs:at+80000000}],hasMore:false,persistedAtMs:at-1000};
function make(changes={}){
 const calls=[];
 const gateway=createG252AdminDocumentAlertsGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>at,verifyAccessToken:async()=>({id:actor,sessionId:session,
   tokenIatMs:at-2000,expiresAtMs:at+120000,is_anonymous:false}),
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'admin',
  verifyProviderAal2:async()=>({userId:actor,sessionId:session,
   assuranceLevel:'aal2',providerVerified:true,expiresAtMs:at+30000}),
  allowRequest:()=>true,
  readDocumentAlerts:async scope=>{calls.push(scope);return data;},
  ...changes
 });
 return {gateway,calls};
}
const request=(gateway,opts={})=>gateway({
 method:'GET',path:'/v1/staging/admin/compliance/document-alerts',
 headers:{authorization:bearer},...opts
});
test('G252 is QA-only and returns minimal verified document bands',async()=>{
 assert.equal(G252_DOCUMENT_ALERTS_LIVE_ENABLED,false);
 const {gateway,calls}=make();
 const response=await request(gateway);
 assert.equal(response.status,200);
 assert.equal(response.body.viewerId,actor);
 assert.deepEqual(response.body.items,data.items);
 assert.equal(response.body.automaticApproval,false);
 assert.equal(response.body.adminDispatchControl,false);
 assert.equal(response.body.documentFilesExposed,false);
 assert.deepEqual(calls,[{actorId:actor,limit:50}]);
 for(const secret of ['object_key','photo','reviewerId','phone',
  'documentUrl','storage_bucket','facialEmbedding'])
  assert.equal(JSON.stringify(response).includes(secret),false);
});
test('G252 rejects owner, passenger, revoked and absent AAL2 without DB reads',async()=>{
 for(const opts of [
  {resolveExclusiveRole:async()=> 'owner'},
  {resolveExclusiveRole:async()=> 'client'},
  {resolveExclusiveRole:async()=> ['admin','driver']},
  {verifySessionNotRevoked:async()=>false},
  {verifyProviderAal2:async()=>({...{
   userId:actor,sessionId:session,assuranceLevel:'aal1',
   providerVerified:true,expiresAtMs:at+30000}})},
  {verifyProviderAal2:async()=>({userId:actor,sessionId:session,
   assuranceLevel:'aal2',providerVerified:false,expiresAtMs:at+30000})},
  {allowRequest:()=>false}
 ]){
  const {gateway,calls}=make(opts);
  assert.notEqual((await request(gateway)).status,200);
  assert.equal(calls.length,0);
 }
});
test('G252 cannot be invoked by wrong HTTP method or user supplied body',async()=>{
 const {gateway,calls}=make();
 for(const changes of [
  {method:'POST'}, {method:'DELETE'}, {body:{}},
  {path:'/v1/staging/admin/compliance/document-alerts?driverId='+driver},
  {headers:{Authorization:bearer}},
  {headers:{authorization:bearer,cookie:'jwt=other'}}
 ]){
  assert.notEqual((await request(gateway,changes)).status,200);
 }
 assert.equal(calls.length,0);
});
test('G252 refuses forged role and expired identity',async()=>{
 for(const changes of [
  {verifyAccessToken:async()=>{throw Error('invalid')}},
  {verifyAccessToken:async()=>({id:actor,sessionId:session,
   tokenIatMs:at-1000,expiresAtMs:at-1,is_anonymous:false})},
  {verifyAccessToken:async()=>({id:actor,sessionId:session,
   tokenIatMs:at-1000,expiresAtMs:at+10000,is_anonymous:true})},
  {verifyAccessToken:async()=>({id:actor,sessionId:session,
   tokenIatMs:at-1000,expiresAtMs:at+10000,is_anonymous:false,
   role:'admin'})}
 ]){
  const {gateway,calls}=make(changes);
  assert.equal((await request(gateway)).status,401);
  assert.equal(calls.length,0);
 }
});
test('G252 rejects stale, malformed, duplicate and sensitive SQL result',async()=>{
 for(const invalid of [
  {...data,items:[{...data.items[0],name:'private'}]},
  {...data,items:[{...data.items[0],band:'UNKNOWN'}]},
  {...data,items:[{...data.items[0],kind:'passport'}]},
  {...data,items:[{...data.items[0],driverId:'malformed'}]},
  {...data,items:[...data.items,data.items[0]]},
  {...data,hasMore:true},
  {...data,persistedAtMs:at-31000},
  {...data,privatePhone:'secret'}
 ]){
  const {gateway}=make({readDocumentAlerts:async()=>invalid});
  assert.equal((await request(gateway)).status,503);
 }
});
test('G252 backend failures are not interpreted as empty compliance queue',async()=>{
 const {gateway}=make({readDocumentAlerts:async()=>{
  throw Error('database outage');
 }});
 const r=await request(gateway);
 assert.equal(r.status,503);
 assert.equal(r.body.code,'G252_DOCUMENTS_UNAVAILABLE');
});
test('G252 refuses unsafe deployment settings',()=>{
 for(const opt of [{environment:'production'},{qaOnly:false},
  {liveEnabled:true},{verifyAccessToken:null},{readDocumentAlerts:null}]){
  assert.throws(()=>make(opt),/G252 requires isolated trusted Admin/);
 }
});
