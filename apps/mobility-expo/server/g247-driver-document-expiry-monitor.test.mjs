import test from 'node:test';
import assert from 'node:assert/strict';
import {
 G247_LIVE_ENABLED,projectDocumentExpiryAlert,createG247DocumentExpiryMonitor
} from './g247-driver-document-expiry-monitor.mjs';
const id=n=>'24700000-0000-4247-8247-'+String(n).padStart(12,'0');
const driver=id(1),vehicle=id(2),at=Date.parse('2026-10-31T12:00:00Z');
const DAY=86400000;
const doc=(n,offset,kind='licencia')=>({
 driverId:driver,vehicleId:['licencia','identidad_frente',
  'identidad_dorso','rostro_selfie'].includes(kind)?null:vehicle,
 documentId:id(n),kind,revision:1,status:'VERIFIED',
 verifiedAtMs:at-60*DAY,validUntilMs:at+offset*DAY
});
const page=(items,nextCursor=null,snapshotRevision=4)=>({
 snapshotRevision,items,nextCursor
});
function setup(extra={}){
 const events=[];
 const options={
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  now:()=>at,listVerifiedDocuments:async()=>page([doc(3,7)]),
  persistAlerts:async({snapshotRevision,events:batch})=>{
   assert.equal(snapshotRevision,4);
   events.push(...batch);
   return {inserted:batch.length,duplicate:0,stale:0};
  },...extra
 };
 return {monitor:createG247DocumentExpiryMonitor(options),events};
}
test('never enables LIVE and emits 30/15/7/1 day and expired alerts',()=>{
 assert.equal(G247_LIVE_ENABLED,false);
 for(const [offset,expected] of [
  [40,null],[30,'D30'],[16,'D30'],[15,'D15'],
  [7,'D07'],[1,'D01'],[0,'EXPIRED'],[-1,'EXPIRED']
 ]){
  const result=projectDocumentExpiryAlert(doc(3,offset),at);
  assert.equal(result?.band??null,expected);
  if(result){
   assert.equal(result.adminAuditOnly,true);
   assert.equal(result.requiresHumanReview,false);
   assert.equal(result.notifyDriver,true);
   assert.equal(result.eligibilityMustBeRechecked,true);
   assert.equal(result.productionEnabled,false);
   assert.equal(JSON.stringify(result).includes('object_key'),false);
  }
 }
});
test('private outbox receives only identifiers, latest verified revision and deterministic key',async()=>{
 const {monitor,events}=setup({listVerifiedDocuments:async()=>page([
  doc(3,29),doc(4,-2,'seguro'),doc(5,42,'habilitacion')
 ])});
 const result=await monitor.runOnce();
 assert.deepEqual(result,{ok:true,scanned:3,proposed:2,
  inserted:2,duplicate:0,stale:0,qaOnly:true,productionEnabled:false});
 assert.equal(events.length,2);
 assert.deepEqual(events.map(x=>x.band),['D30','EXPIRED']);
 assert.equal(events[1].vehicleId,vehicle);
 assert.equal(events[0].eventKey,
  projectDocumentExpiryAlert(doc(3,29),at).eventKey);
 assert.equal(events.every(e=>!Object.hasOwn(e,'name')
  &&!Object.hasOwn(e,'telephone')&&!Object.hasOwn(e,'objectKey')),true);
});
test('deduplication belongs to durable outbox and repeated scan is safe',async()=>{
 const seen=new Set();
 const {monitor}=setup({persistAlerts:async({events})=>{
  let inserted=0,duplicate=0;
  for(const e of events){
   if(seen.has(e.eventKey))duplicate++;
   else {seen.add(e.eventKey);inserted++;}
  }
  return {inserted,duplicate,stale:0};
 }});
 assert.equal((await monitor.runOnce()).inserted,1);
 const again=await monitor.runOnce();
 assert.equal(again.inserted,0);
 assert.equal(again.duplicate,1);
 assert.equal(seen.size,1);
});
test('verified snapshot pagination must finish with constant revision before saving',async()=>{
 const scans=[];
 const {monitor,events}=setup({pageSize:2,listVerifiedDocuments:async({cursor,limit})=>{
  scans.push([cursor,limit]);
  return cursor===null?page([doc(3,16),doc(4,6,'seguro')],'next'):
   page([doc(5,2,'habilitacion')]);
 }});
 assert.equal((await monitor.runOnce()).proposed,3);
 assert.equal(events.length,3);
 assert.deepEqual(scans,[[null,2],['next',2]]);
});
test('refuses stale, forged, duplicate, oversized or incomplete pages without writes',async()=>{
 for(const list of [
  async()=>page([{...doc(3,10),driverPhone:'secret'}]),
  async()=>page([{...doc(3,10),status:'pending'}]),
  async()=>page([doc(3,3),doc(3,3)]),
  async()=>page([doc(3,3)],'repeated'),
  async()=>page([doc(3,3)],null,undefined),
  async()=>page([doc(3,3)],'\nforged'),
  async()=>page([doc(3,3),doc(4,4,'seguro')])
 ]){
  let writes=0;
  const {monitor}=setup({maxPages:1,pageSize:1,
   listVerifiedDocuments:list,
   persistAlerts:async()=>{writes++;return {inserted:0,duplicate:0,stale:0};}
  });
  assert.equal((await monitor.runOnce()).ok,false);
  assert.equal(writes,0);
 }
});
test('rejects inconsistent outbox receipt and write errors without claiming success',async()=>{
 for(const persistAlerts of [
  async()=>({inserted:99,duplicate:0,stale:0}),
  async()=>({inserted:1,duplicate:0,stale:0,privateName:'leak'}),
  async()=>{throw Error('token credentials should not leak');}
 ]){
  const {monitor}=setup({persistAlerts});
  assert.deepEqual(await monitor.runOnce(),{
   ok:false,reason:'UNVERIFIED_READ_OR_WRITE'
  });
 }
});
test('no overlapping scans; stop cancels in-flight scan before outbox write',async()=>{
 let release;
 let writes=0;
 const {monitor}=setup({listVerifiedDocuments:()=>new Promise(r=>{release=r;}),
  persistAlerts:async()=>{writes++;return {inserted:1,duplicate:0,stale:0};}
 });
 const pending=monitor.runOnce();
 assert.equal((await monitor.runOnce()).reason,'BUSY');
 monitor.stop();
 release(page([doc(3,7)]));
 assert.deepEqual(await pending,{ok:false,reason:'CANCELLED'});
 assert.equal(writes,0);
});
test('only explicit isolated STAGING startup schedules a monitor',async()=>{
 const scheduled=[];const cancelled=[];
 const {monitor}=setup({
  schedule:(cb,ms)=>{scheduled.push({cb,ms});return {id:1};},
  cancel:timer=>cancelled.push(timer.id)
 });
 assert.equal(monitor.snapshot().running,false);
 assert.equal(monitor.start(),true);
 assert.equal(monitor.start(),false);
 assert.equal(scheduled[0].ms,3600000);
 monitor.stop();
 assert.deepEqual(cancelled,[1]);
 assert.equal(monitor.snapshot().running,false);
});
test('production, missing private repositories and unsafe scan limits are denied',()=>{
 for(const changed of [
  {environment:'production'},{qaOnly:false},{liveEnabled:true},
  {listVerifiedDocuments:null},{persistAlerts:null},
  {intervalMs:1000},{pageSize:100},{maxPages:0}
 ]){
  assert.throws(()=>setup(changed),/G247_STAGING_PRIVATE_MONITOR_REQUIRED/);
 }
});
