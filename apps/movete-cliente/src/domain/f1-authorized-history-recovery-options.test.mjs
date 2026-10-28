import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createF1AuthorizedHistoryRecoveryOptions as allow} from './f1-authorized-history-recovery-options.mjs';
import {createClientExperience} from './client-experience.mjs';
const origin='https://movete-qa.onrender.com';
const trusted=()=>({origin,pinnedOrigin:origin,ownerApproved:true,
 persistedRuntimeVerified:true,historyContractVerified:true,
 statusContractVerified:true,passengerRlsVerified:true,fetchImpl:async()=>{}});
test('R70 disabled unless independent Passenger history, status, owner, PG and RLS gates all pass',()=>{
 assert.equal(allow(),null);
 const args=trusted();
 for(const flag of ['ownerApproved','persistedRuntimeVerified',
  'historyContractVerified','statusContractVerified','passengerRlsVerified']){
  assert.equal(allow({...args,[flag]:false}),null,flag);
  assert.equal(allow({...args,[flag]:'true'}),null,flag);
 }
 assert.equal(allow({...args,fetchImpl:null}),null);
 assert.equal(allow({...args,pinnedOrigin:'https://another.onrender.com'}),null);
 for(const bad of ['http://movete-qa.onrender.com','https://movete-qa.onrender.com/',
  'https://evil.com','https://movete-qa.onrender.com:8443',
  'https://u:p@movete-qa.onrender.com','https://movete-qa.onrender.com?q=1',
  'https://movete-qa.onrender.com#x','https://movete-qa.onrender.com.evil.org']){
  assert.equal(allow({...args,origin:bad,pinnedOrigin:bad}),null,bad);
 }
 const found=allow(args);
 assert.equal(found.readOnly,true);
 assert.equal(found.qaOnly,true);
 assert.equal(found.productionEnabled,false);
 assert.equal(found.statusGatewayOptions.origin,origin);
 assert.equal(found.historyGatewayOptions.origin,origin);
 assert.equal(Object.isFrozen(found),true);
});
test('R70 native runtime wires both readers independently of G73 commercial/route gates',()=>{
 const source=readFileSync(new URL('../ClientRuntime.tsx',import.meta.url),'utf8');
 assert.match(source,/EXPO_PUBLIC_F1_HISTORY_CONTRACT_VERIFIED/);
 assert.match(source,/EXPO_PUBLIC_F1_STATUS_CONTRACT_VERIFIED/);
 assert.match(source,/EXPO_PUBLIC_F1_PASSENGER_RLS_VERIFIED/);
 assert.match(source,/historyGatewayOptions:recoveryHttp\?\.historyGatewayOptions\?\?null/);
 assert.match(source,/statusGatewayOptions:recoveryHttp\?\.statusGatewayOptions\?\?null/);
});
const now=1900000000000;
const id=n=>'07000000-0000-4700-8700-'+String(n).padStart(12,'0');
const owner=id(1),tripId=id(2),foreign=id(3);
const actor={subject:owner,role:'passenger',expiresAt:now+600000,
 token:'recover-test-passenger-jwt-signed-abcdefghijklmnop'};
const history=()=>({ownerId:owner,generatedAt:now-100,expiresAt:now+60000,
 nextCursor:null,items:[{serviceId:tripId,kind:'RIDE',
 status:'searching',createdAt:now-15000,revision:2}]});
const status=()=>({tripId,ownerId:owner,revision:3,state:'searching',
 assignmentPersisted:false,driver:null,vehicle:null,gpsConsent:false,
 location:null,etaVerified:false,etaMinutes:null,mode:'STAGING_DEMO_ONLY',
 commercialRidesEnabled:false,event:{source:'server',tripId,passengerId:owner,
 serverRevision:3,trackingSequence:2,status:'searching',
 acceptedDriver:null,tracking:null},locationVisible:false,deliveryConfirmed:false});
const reply=(data,status=200)=>({status,ok:status===200,redirected:false,
 headers:{get:x=>x==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
test('R70 after process restart: fresh authenticated client recovers own persisted trip by GET+GET only',async()=>{
 const calls=[];
 const opts=allow({...trusted(),fetchImpl:async(url,request)=>{
  const path=new URL(url).pathname;
  assert.equal(request.method,'GET');
  assert.equal(request.headers.Authorization,'Bearer '+actor.token);
  calls.push(path);
  if(path==='/v1/staging/rider/history')return reply(history());
  if(path==='/v1/staging/rider/trips/'+tripId+'/status')return reply(status());
  throw Error('unsafe request');
 }});
 function boot(){
  return createClientExperience({now:()=>now,
   authProvider:{readSession:async()=>actor,signOut:async()=>{}},
   historyGatewayOptions:opts.historyGatewayOptions,
   statusGatewayOptions:opts.statusGatewayOptions});
 }
 const before=boot();
 await before.refreshSession();
 assert.equal(before.snapshot().tracking.subscriptionActive,false);
 const restarted=boot();
 await restarted.refreshSession();
 assert.equal(restarted.snapshot().historyConfigured,true);
 assert.equal(restarted.snapshot().rideContinuation.canVerify,false);
 assert.equal((await restarted.loadHistoryPage({reset:true})).ok,true);
 const found=restarted.snapshot().history.items[0];
 assert.equal(restarted.snapshot().rideHistoryRecovery.readReady,true);
 assert.equal((await restarted.resumeRideFromHistory({tripId:found.serviceId,
  expectedHistoryRevision:found.revision})).ok,true);
 assert.equal(restarted.snapshot().tracking.subscriptionActive,true);
 assert.equal(restarted.snapshot().tracking.tripId,tripId);
 assert.equal(restarted.snapshot().rideContinuation.canVerify,true);
 assert.deepEqual(calls,['/v1/staging/rider/history',
  '/v1/staging/rider/trips/'+tripId+'/status']);
 assert.equal(JSON.stringify(restarted.snapshot()).includes(actor.token),false);
});
test('R70 refuse cross-owner history and never GET status for a foreign trip',async()=>{
 const calls=[];
 const opts=allow({...trusted(),fetchImpl:async(url,request)=>{
  const p=new URL(url).pathname;calls.push(p);
  if(p==='/v1/staging/rider/history')
   return reply({...history(),ownerId:foreign});
  throw Error('cross-user read');
 }});
 const client=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>actor,signOut:async()=>{}},
  historyGatewayOptions:opts.historyGatewayOptions,
  statusGatewayOptions:opts.statusGatewayOptions});
 await client.refreshSession();
 assert.equal((await client.loadHistoryPage({reset:true})).ok,false);
 assert.equal(client.snapshot().rideHistoryRecovery.readReady,false);
 assert.equal((await client.resumeRideFromHistory({tripId,
  expectedHistoryRevision:2})).ok,false);
 assert.deepEqual(calls,['/v1/staging/rider/history']);
});
