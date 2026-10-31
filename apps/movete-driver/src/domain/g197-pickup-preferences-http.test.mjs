import test from 'node:test';
import assert from 'node:assert/strict';
import {createG197DriverPickupPreferencesHttp} from './g197-pickup-preferences-http.mjs';
const actor='19700000-0000-4197-8197-000000000001';
const token='trusted-driver-identity-0000000000000000001';
const origin='https://qore-pickup-staging.onrender.com';
const session=()=>({role:'driver',userId:actor,accessToken:token});
const options=rest=>({
 enabled:true,ownerApproved:true,serverRoleVerified:true,
 roadEnforcementVerified:true,origin,pinnedOrigin:origin,
 getSession:async()=>session(),...rest
});
const result=data=>new Response(JSON.stringify(data),
 {status:200,headers:{'content-type':'application/json'}});
const listing=()=>({mode:'STAGING_DEMO_ONLY',driverId:actor,
 preferences:[{serviceKind:'RIDE',maximumRoadMeters:5000,revision:1}],
 productionEnabled:false,liveEnabled:false});
const saved=()=>({mode:'STAGING_DEMO_ONLY',driverId:actor,
 serviceKind:'MERCHANT_ORDER',maximumRoadMeters:2000,revision:2,
 serverPersisted:true,productionEnabled:false,liveEnabled:false});
test('G197 exact three scopes, server-sourced preferences and revision fencing',async()=>{
 const requests=[];
 const api=createG197DriverPickupPreferencesHttp(options({
  request:async(url,init)=>{requests.push({url,init});return result(requests.length===1?listing():saved());}
 }));
 assert.equal(api.isConfigured(),true);
 const read=await api.read();assert.equal(read.ok,true);
 assert.deepEqual(read.data.preferences[0].serviceKind,'RIDE');
 const write=await api.update('MERCHANT_ORDER',2000,1);
 assert.equal(write.ok,true);assert.equal(write.data.revision,2);
 assert.equal(requests[0].init.method,'GET');
 assert.equal(requests[1].init.method,'PUT');
 assert.equal(requests[0].url,origin+'/v1/staging/driver/pickup-preferences');
 assert.deepEqual(JSON.parse(requests[1].init.body),
  {serviceKind:'MERCHANT_ORDER',maximumRoadMeters:2000,expectedRevision:1});
});
test('G228 client transmits OFF and only accepts an exact zero-metre SQL receipt',async()=>{
 const requests=[];
 const api=createG197DriverPickupPreferencesHttp(options({
  request:async(url,init)=>{
   requests.push({url,init});
   return result({...saved(),maximumRoadMeters:0});
  }
 }));
 const response=await api.update('MERCHANT_ORDER',0,1);
 assert.equal(response.ok,true);
 assert.equal(response.data.maximumRoadMeters,0);
 assert.equal(JSON.parse(requests[0].init.body).maximumRoadMeters,0);
 const lying=createG197DriverPickupPreferencesHttp(options({
  request:async()=>result({...saved(),maximumRoadMeters:1000})
 }));
 assert.equal((await lying.update('MERCHANT_ORDER',0,1)).code,
  'G197_UNTRUSTED_RECEIPT');
});
test('G197 no preference mutation without independent owner+road approval',async()=>{
 let called=0;
 for(const disabled of [{enabled:false},{roadEnforcementVerified:false},
  {serverRoleVerified:false},{origin:'http://qore-pickup-staging.onrender.com'},
  {pinnedOrigin:'https://other.onrender.com'}]){
  const api=createG197DriverPickupPreferencesHttp(options({...disabled,
   request:async()=>{called++;return result(saved());}}));
  assert.equal(api.isConfigured(),false);
  assert.equal((await api.update('RIDE',5000,0)).ok,false);
 }
 assert.equal(called,0);
});
test('G197 rejects forged radius, unknown service, fake reply and rotated JWT',async()=>{
 let sent=0;
 const api=createG197DriverPickupPreferencesHttp(options({
  request:async()=>{sent++;return result(saved())}
 }));
 assert.equal((await api.update('INVALID_RIDE',2000,0)).ok,false);
 assert.equal((await api.update('RIDE',3333,0)).ok,false);
 assert.equal(sent,0);
 const foreign=createG197DriverPickupPreferencesHttp(options({
  request:async()=>result({...listing(),driverId:'19700000-0000-4197-8197-000000000002'})
 }));
 assert.equal((await foreign.read()).ok,false);
 let count=0;
 const rotated=createG197DriverPickupPreferencesHttp(options({
  getSession:async()=>({...session(),accessToken:count++===0?token:'new-authenticated-token-00000000000000'}),
  request:async()=>result(listing())
 }));
 assert.equal((await rotated.read()).code,'G197_SESSION_CHANGED');
});
test('G197 rejects server-suggested distance not chosen by the Driver',async()=>{
 const api=createG197DriverPickupPreferencesHttp(options({
  request:async()=>result({...saved(),maximumRoadMeters:50000})
 }));
 assert.equal((await api.update('MERCHANT_ORDER',2000,1)).code,'G197_UNTRUSTED_RECEIPT');
});

test('G229 Driver OFF and pickup preferences accept exact Railway HTTPS pin only',async()=>{
 const railway='https://qore-mobile-staging.up.railway.app';
 const a=createG197DriverPickupPreferencesHttp(options({
  origin:railway,pinnedOrigin:railway,
  request:async()=>result(listing())
 }));
 assert.equal(a.isConfigured(),true);
 assert.equal((await a.read()).ok,true);
 const b=createG197DriverPickupPreferencesHttp(options({
  origin:railway,pinnedOrigin:origin
 }));
 assert.equal(b.isConfigured(),false);
});
