import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverWorkspaceController,DRIVER_WORKSPACE_LIVE_ENABLED}
 from './driver-workspace.mjs';

const driver='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const offerId='33333333-3333-4333-8333-333333333333';
const deliveryId='44444444-4444-4444-8444-444444444444';
const TOKEN_A='a'.repeat(60),TOKEN_B='b'.repeat(60);
const TIME=Date.parse('2026-10-22T12:00:00Z');
const session=(userId=driver,accessToken=TOKEN_A)=>({
 role:'driver',userId,accessToken});
const offers=[{kind:'DELIVERY',offerId,serviceId:deliveryId,expiresAtMs:TIME+25000}];
const documents=[{kind:'licencia',status:'pending',submittedAtMs:TIME-60000,reviewedAtMs:null}];
const license={currentLicenseApproved:false,driverEligible:false,liveEnabled:false,
 scope:'CURRENT_LICENSE_REVIEW_ONLY'};
function fixture(overrides={}){
 const calls=[];
 const controller=createDriverWorkspaceController({
  authAdapter:{getSession:async()=>session()},
  apiOrigin:'http://127.0.0.1:4242',
  request:async()=>{throw Error('Unexpected network: all readers are injected');},
  now:()=>TIME,
  readInbox:async args=>{calls.push(['inbox',args.accessToken]);return offers;},
  readDocuments:async args=>{calls.push(['documents',args.accessToken]);return documents;},
  readLicense:async args=>{calls.push(['license',args.accessToken]);return license;},
  ...overrides
 });
 return {controller,calls};
}
test('G21 defaults to secure no-Auth mode and never enables LIVE',async()=>{
 assert.equal(DRIVER_WORKSPACE_LIVE_ENABLED,false);
 const c=createDriverWorkspaceController();
 assert.equal(c.current().phase,'not-configured');
 assert.equal((await c.refresh()).phase,'not-configured');
 assert.deepEqual(c.current().offers,[]);
 assert.deepEqual(c.current().documents,[]);
 assert.equal(c.current().driverEligible,false);
 assert.equal(c.current().liveEnabled,false);
});
test('G21 composes three private Driver snapshots without caching tokens or identities',async()=>{
 const {controller,calls}=fixture();
 const updates=[];
 const unsubscribe=controller.subscribe(state=>updates.push(state.phase));
 const state=await controller.refresh();
 assert.equal(state.phase,'connected');
 assert.deepEqual(state.offers,offers);
 assert.deepEqual(state.documents,documents);
 assert.equal(state.currentLicenseApproved,false);
 assert.equal(state.driverEligible,false);
 assert.equal(state.liveEnabled,false);
 assert.equal(Object.isFrozen(state),true);
 assert.equal(Object.isFrozen(state.offers[0]),true);
 assert.equal(Object.isFrozen(state.documents[0]),true);
 assert.deepEqual(calls,[['inbox',TOKEN_A],['documents',TOKEN_A],['license',TOKEN_A]]);
 assert.deepEqual(updates,['loading','connected']);
 unsubscribe();
 controller.invalidate();
 assert.deepEqual(updates,['loading','connected']);
 const visible=JSON.stringify(state);
 assert.doesNotMatch(visible,/a{25}|11111111|token|userId|sha256|licensePath/);
});
test('G21 session expires, is revoked or loses any one connection: no stale private data',async()=>{
 for(const error of [
  new Error('Driver session expired'),
  new Error('Driver role not authorized'),
  new Error('private network failure')
 ]){
  let round=0;
  const {controller}=fixture({readLicense:async()=>{
   round++;if(round===1)return license;
   throw error;
  }});
  assert.equal((await controller.refresh()).phase,'connected');
  const state=await controller.refresh();
  assert.equal(state.phase,/expired|not authorized/.test(error.message)?
   'authorization-required':'offline');
  assert.deepEqual(state.offers,[]);
  assert.deepEqual(state.documents,[]);
  assert.equal(state.currentLicenseApproved,false);
  assert.equal(state.driverEligible,false);
 }
});
test('G21 changing Driver while request in progress never resurrects first account offers',async()=>{
 let releaseAlice;
 let currentSession=session(driver,TOKEN_A);
 const first=()=>new Promise(resolve=>{releaseAlice=resolve;});
 const {controller}=fixture({
  authAdapter:{getSession:async()=>currentSession},
  readInbox:async({accessToken})=>accessToken===TOKEN_A?first():[],
  readDocuments:async()=>[],
  readLicense:async()=>license
 });
 const old=controller.refresh();
 await Promise.resolve();await Promise.resolve();
 assert.equal(controller.current().phase,'loading');
 // Logout clears data immediately, even before old API response.
 controller.invalidate();
 assert.deepEqual(controller.current().offers,[]);
 currentSession=session(other,TOKEN_B);
 const next=controller.refresh();
 assert.equal((await next).phase,'connected');
 releaseAlice(offers);
 await old;
 assert.deepEqual(controller.current().offers,[]);
 assert.equal(controller.current().phase,'connected');
});
test('G21 concurrent refresh takes last generation only, even when earlier Auth resolves late',async()=>{
 let resolveAuth;
 let calls=0;
 const {controller}=fixture({
  authAdapter:{getSession:async()=>{
   calls++;return calls===1?
    new Promise(resolve=>{resolveAuth=resolve;}):null;
  }}
 });
 const pending=controller.refresh();
 const newer=controller.refresh();
 assert.equal((await newer).phase,'signed-out');
 resolveAuth(session());
 await pending;
 assert.equal(controller.current().phase,'signed-out');
});
test('G21 missing, malformed or passenger sessions never call backend readers',async()=>{
 let reads=0;
 for(const invalid of [null,{},session('bad'),{...session(),role:'passenger'},
  {...session(),accessToken:'bad'}]){
  const c=createDriverWorkspaceController({
   authAdapter:{getSession:async()=>invalid},
   apiOrigin:'http://127.0.0.1:4242',
   readInbox:async()=>{reads++;return offers;},
   readDocuments:async()=>{reads++;return documents;},
   readLicense:async()=>{reads++;return license;}
  });
  const result=await c.refresh();
  assert.equal(result.phase,invalid===null?'signed-out':'authorization-required');
  assert.deepEqual(result.offers,[]);
 }
 assert.equal(reads,0);
});
test('G21 disallows injected PII, forged LIVE readiness and expired inbox offers',async()=>{
 for(const options of [
  {readInbox:async()=>[{...offers[0],expiresAtMs:TIME+2000}]},
  {readInbox:async()=>[{...offers[0],offerId:'fake'}]},
  {readDocuments:async()=>[{...documents[0],kind:'unknown'}]},
  {readLicense:async()=>({...license,driverEligible:true})},
  {readLicense:async()=>({...license,currentLicenseApproved:'true'})}
 ]){
  const {controller}=fixture(options);
  const state=await controller.refresh();
  assert.equal(state.phase,'offline');
  assert.deepEqual(state.offers,[]);
  assert.deepEqual(state.documents,[]);
  assert.equal(state.driverEligible,false);
 }
});
test('G21 subscriber exception cannot prevent privacy reset and unsubscribe works',async()=>{
 const {controller}=fixture();
 controller.subscribe(()=>{throw Error('Listener bug')});
 let called=0;
 const remove=controller.subscribe(()=>{called++;});
 await controller.refresh();
 const before=called;remove();
 controller.invalidate();
 assert.equal(called,before);
 assert.equal(controller.current().phase,'signed-out');
 assert.deepEqual(controller.current().offers,[]);
 assert.throws(()=>controller.subscribe(123),/subscriber/);
});

test('Driver STAGING poll receives new offers without a loading flash or POST',async()=>{
 const nextOffer={kind:'AUTO_RIDE',
  offerId:'55555555-5555-4555-8555-555555555555',
  serviceId:'66666666-6666-4666-8666-666666666666',
  expiresAtMs:TIME+27000};
 let round=0;
 const {controller,calls}=fixture({readInbox:async x=>{
  calls.push(['inbox',x.accessToken]);return ++round===1?[]:[nextOffer];
 }});
 assert.equal((await controller.poll()).phase,'signed-out');
 assert.equal(calls.length,0);
 assert.equal((await controller.refresh()).offers.length,0);
 const phases=[];
 controller.subscribe(x=>phases.push(x.phase));
 const state=await controller.poll();
 assert.equal(state.phase,'connected');
 assert.deepEqual(state.offers,[nextOffer]);
 assert.deepEqual(phases,['connected']);
 assert.deepEqual(calls.slice(-3),[
  ['inbox',TOKEN_A],['documents',TOKEN_A],['license',TOKEN_A]
 ]);
});
test('Foreground poll deduplicates simultaneous reads and drops failed authorization',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 let polls=0,round=0;
 const {controller}=fixture({
  readInbox:async()=>{
   polls++;round++;
   if(round===1)return offers;
   if(round===2){await gate;return offers;}
   throw Error('Driver session expired');
  }
 });
 assert.equal((await controller.refresh()).phase,'connected');
 const first=controller.poll();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 const second=await controller.poll();
 assert.equal(second.phase,'connected');
 assert.equal(polls,2);
 release();
 assert.equal((await first).phase,'connected');
 assert.equal((await controller.poll()).phase,'authorization-required');
 assert.deepEqual(controller.current().offers,[]);
});
test('Auth invalidation during poll does not resurrect private Driver data',async()=>{
 let release;
 const {controller}=fixture({
  readInbox:async()=>{
   if(!release)return offers;
   return new Promise(resolve=>{const callback=release;release=()=>callback(resolve);});
  }
 });
 await controller.refresh();
 release=resolver=>resolver(offers);
 const pending=controller.poll();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 controller.invalidate();
 assert.equal(controller.current().phase,'signed-out');
 release();
 await pending;
 assert.deepEqual(controller.current().offers,[]);
});
