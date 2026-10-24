import test from 'node:test';
import assert from 'node:assert/strict';
import {createSenderCustodyHttpGateway} from './sender-custody-http-gateway.mjs';

const T=1800000000000;
const id=n=>'68888000-0000-4688-8688-'+String(n).padStart(12,'0');
const owner=id(1),delivery=id(2),foreign=id(3);
const token='synthetic-g68-passenger-jwt-abcdefghijk';
const actor=()=>({role:'passenger',subject:owner,token,
 expiresAt:T+60000,authRevision:3,sessionRevision:7});
const payload=(state='requested',extra={})=>({
 mode:'STAGING_DEMO_ONLY',deliveryId:delivery,ownerId:owner,state,
 revision:3,vehicleKind:'MOTO',
 assignmentPersisted:state!=='requested',
 proofVerified:['delivered','disputed','returned'].includes(state),
 qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false,...extra
});
const response=(data=payload())=>({
 status:200,ok:true,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)
});
const flags={enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 g68SenderContractCertified:true,
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 now:()=>T,getSession:async()=>actor(),fetchImpl:async()=>response()};
const scope=(extras={})=>({deliveryId:delivery,ownerId:owner,
 sessionRevision:7,bearer:token,...extras});
test('R65 default and each of four gates OFF: never emit a network request',async()=>{
 let calls=0;
 const actual={...flags,fetchImpl:async()=>{calls++;return response();}};
 for(const key of ['enabled','contractCertified','stagingRuntimeVerified',
  'g68SenderContractCertified']){
  const x=createSenderCustodyHttpGateway({...actual,[key]:false});
  assert.equal(x.isConfigured(),false,key);
  assert.equal((await x.readOwnDelivery(scope())).code,
   'SENDER_CUSTODY_HTTPS_NOT_CERTIFIED');
 }
 assert.equal(createSenderCustodyHttpGateway().isConfigured(),false);
 assert.equal(calls,0);
});
test('R65 sends exactly Passenger bearer over pinned HTTPS sender route GET, no PII',async()=>{
 let url,req;
 const g=createSenderCustodyHttpGateway({...flags,
  fetchImpl:async(u,r)=>{url=u;req=r;return response(payload('delivered'));}});
 assert.equal(g.isConfigured(),true);
 const out=await g.readOwnDelivery(scope());
 assert.equal(out.ok,true);
 assert.equal(out.data.state,'delivered');
 assert.equal(out.data.proofVerified,true);
 assert.equal(out.qaOnly,true);
 assert.equal(out.productionEnabled,false);
 assert.equal(url,'https://staging.example.invalid/v1/staging/sender/deliveries/'+delivery+'/custody');
 assert.equal(url.includes('courier'),false);
 assert.equal(url.includes(owner),false);
 assert.equal(req.method,'GET');
 assert.equal(req.redirect,'error');assert.equal(req.credentials,'omit');
 assert.equal(req.cache,'no-store');assert.equal(req.referrerPolicy,'no-referrer');
 assert.deepEqual(req.headers,{Authorization:'Bearer '+token,Accept:'application/json'});
 assert.equal(Object.hasOwn(req,'body'),false);
 assert.equal(JSON.stringify(out).includes(token),false);
});
test('R65 rejects origin mismatch, HTTP, local, credentials, ports, paths and query',()=>{
 for(const origin of ['http://staging.example.invalid',
  'https://other.invalid','https://user@staging.example.invalid',
  'https://staging.example.invalid:8443','https://staging.example.invalid/x',
  'https://staging.example.invalid/?x=1','https://staging.example.invalid/#fragment',
  'https://127.0.0.1','https://localhost','https://foo.localhost']){
  const g=createSenderCustodyHttpGateway({...flags,origin});
  assert.equal(g.isConfigured(),false,origin);
 }
});
test('R65 cannot leak requests for wrong Passenger, JWT, revision, role, or UUID',async()=>{
 let requests=0;
 for(const changed of [
  {subject:foreign},{role:'driver'},{role:'admin'},
  {token:'short'},{expiresAt:T-100},{authRevision:-1},
  {sessionRevision:8}
 ]){
  const g=createSenderCustodyHttpGateway({...flags,
   getSession:async()=>({...actor(),...changed}),
   fetchImpl:async()=>{requests++;return response();}});
  assert.equal((await g.readOwnDelivery(scope())).ok,false,JSON.stringify(changed));
 }
 for(const bad of [
  scope({ownerId:foreign}),scope({bearer:'jwt-forged-but-long-abcdefghi'}),
  scope({deliveryId:'../../admin'}),scope({sessionRevision:-1}),
  {...scope(),phone:'0981'}
 ]){
  const g=createSenderCustodyHttpGateway({...flags,
   fetchImpl:async()=>{requests++;return response();}});
  assert.equal((await g.readOwnDelivery(bad)).ok,false,JSON.stringify(bad));
 }
 assert.equal(requests,0);
});
test('R65 all G68 proof terminal states require independent proof flag',async()=>{
 for(const state of ['delivered','disputed','returned']){
  assert.equal((await createSenderCustodyHttpGateway({...flags,
   fetchImpl:async()=>response(payload(state))})
   .readOwnDelivery(scope())).ok,true,state);
  assert.equal((await createSenderCustodyHttpGateway({...flags,
   fetchImpl:async()=>response(payload(state,{proofVerified:false}))})
   .readOwnDelivery(scope())).code,'INVALID_SERVER_SNAPSHOT',state);
 }
 for(const state of ['requested','accepted','picked_up','cancelled']){
  assert.equal((await createSenderCustodyHttpGateway({...flags,
   fetchImpl:async()=>response(payload(state,{proofVerified:true}))})
   .readOwnDelivery(scope())).code,'INVALID_SERVER_SNAPSHOT',state);
 }
});
test('R65 rejects G68 server payload with another owner/delivery, courier, proofRef or LIVE',async()=>{
 const forbidden=[
  {ownerId:foreign},{deliveryId:foreign},{proofRef:id(5)},
  {courierId:id(6)},{phone:'098111111'},{gps:{lat:1,lng:2}},
  {productionEnabled:true},{qaOnly:false},{mode:'LIVE'},
  {revision:0},{vehicleKind:'MOTO_PASSENGERS'},{assignmentPersisted:false},
  {state:'completed'}
 ];
 for(const patch of forbidden){
  const out=await createSenderCustodyHttpGateway({...flags,
   fetchImpl:async()=>response(payload('delivered',patch))})
   .readOwnDelivery(scope());
  assert.equal(out.code,'INVALID_SERVER_SNAPSHOT',JSON.stringify(patch));
 }
});
test('R65 auth errors only revoke current JWT; stale 403 never evicts rotated account',async()=>{
 for(const status of [401,403]){
  let invalidated=0;
  const g=createSenderCustodyHttpGateway({...flags,
   onSessionInvalid:()=>invalidated++,
   fetchImpl:async()=>({status,ok:false,redirected:false})});
  assert.equal((await g.readOwnDelivery(scope())).status,status);
  assert.equal(invalidated,1);
 }
 let current=actor(),done,invalidated=0;
 const waiting=new Promise(resolve=>done=resolve);
 const g=createSenderCustodyHttpGateway({...flags,
  getSession:async()=>current,onSessionInvalid:()=>invalidated++,
  fetchImpl:async()=>waiting});
 const pending=g.readOwnDelivery(scope());
 await Promise.resolve();await Promise.resolve();
 current={...current,token:'rotated-synthetic-jwt-123456789'};
 done({status:403,ok:false,redirected:false});
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
 assert.equal(invalidated,0);
});
test('R65 HTTP 404 hides existence, 429 throttles, 503 no false delivered status',async()=>{
 for(const [status,code] of [[404,'SENDER_CUSTODY_NOT_FOUND'],
  [429,'RATE_LIMITED'],[503,'SERVICE_UNAVAILABLE'],
  [500,'SENDER_CUSTODY_UNAVAILABLE']]){
  const g=createSenderCustodyHttpGateway({...flags,
   fetchImpl:async()=>({status,ok:false,redirected:false})});
  const out=await g.readOwnDelivery(scope());
  assert.equal(out.ok,false);
  assert.equal(out.code,code);
  assert.equal(JSON.stringify(out).includes(owner),false);
 }
});
test('R65 malformed content, redirects, fake PII, invalid JSON and oversized bytes fail closed',async()=>{
 const samples=[
  [{...response(),redirected:true},'UNTRUSTED_REDIRECT'],
  [{...response(),headers:{get:()=> 'text/html'}},'BAD_CONTENT_TYPE'],
  [{...response(),text:async()=>'{broken'},'BAD_SERVER_RESPONSE'],
  [{...response(),text:async()=>JSON.stringify({privatePhone:'0981'})},'INVALID_SERVER_SNAPSHOT'],
  [{...response(),headers:{get:k=>k==='content-type'?'application/json':
    '999999'}},'RESPONSE_TOO_LARGE'],
  [{...response(),text:async()=> 'á'.repeat(18000)},'RESPONSE_TOO_LARGE']
 ];
 for(const [reply,code] of samples){
  const g=createSenderCustodyHttpGateway({...flags,fetchImpl:async()=>reply});
  assert.equal((await g.readOwnDelivery(scope())).code,code);
 }
});
test('R65 timeout despite transport ignoring AbortSignal never accepts late 200',async()=>{
 let tick=T;
 const g=createSenderCustodyHttpGateway({...flags,now:()=>tick,timeoutMs:1000,
  fetchImpl:async()=>{tick+=1001;return response(payload('delivered'));}});
 assert.equal((await g.readOwnDelivery(scope())).code,'NETWORK_OR_TIMEOUT');
});
test('R65 stale token after body read never projects previous sender proof',async()=>{
 let current=actor();
 const g=createSenderCustodyHttpGateway({...flags,
  getSession:async()=>current,
  fetchImpl:async()=>({...response(payload('delivered')),text:async()=>{
   current={...current,token:'new-synthetic-jwt-12345678900'};
   return JSON.stringify(payload('delivered'));
  }})});
 assert.equal((await g.readOwnDelivery(scope())).code,'STALE_SESSION_RESPONSE');
});
test('R65 concurrent HTTP reads do not cause double transport',async()=>{
 let done,calls=0;
 const waiting=new Promise(resolve=>done=resolve);
 const g=createSenderCustodyHttpGateway({...flags,
  fetchImpl:async()=>{calls++;return waiting;}});
 const first=g.readOwnDelivery(scope());
 assert.equal((await g.readOwnDelivery(scope())).code,'SENDER_CUSTODY_READ_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();
 done(response());
 assert.equal((await first).ok,true);
 assert.equal(calls,1);
});
