import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverDeliveryResume,DRIVER_DELIVERY_RESUME_LIVE_ENABLED}
 from './driver-delivery-resume.mjs';
const id=n=>'d0000000-0000-4000-8000-'+String(n).padStart(12,'0');
const driver=id(1),other=id(2),delivery=id(3),at=Date.parse('2026-10-27T12:00:00Z');
const first={role:'driver',userId:driver,accessToken:'driver-jwt-token-qa-abcdefghijklmnopqrstuvwxyz'};
const good=(status='accepted')=>({ok:true,deliveryId:delivery,revision:2,
 status,qaOnly:true,productionEnabled:false});
function setup({readAssignment=async()=>good(),getSession=async()=>first,
 clock=()=>at,storageEnabled=true}={}){
 const mem=new Map(),hits={get:0,put:0,del:0,read:0};
 const storage=storageEnabled?{
  get:async key=>{hits.get++;return mem.get(key)??null;},
  put:async(key,value)=>{hits.put++;mem.set(key,value);},
  del:async key=>{hits.del++;mem.delete(key);}
 }:null;
 const ctl=createDriverDeliveryResume({getSession,readAssignment:async id=>{
  hits.read++;return readAssignment(id);},storage,now:clock});
 return {ctl,hits,mem};
}
test('Driver stores only owner-bound delivery ID and verifies fresh server on restart',async()=>{
 assert.equal(DRIVER_DELIVERY_RESUME_LIVE_ENABLED,false);
 const x=setup();assert.equal((await x.ctl.remember(delivery)).saved,true);
 const values=[...x.mem.values()].join(' ');
 assert(values.includes(delivery));assert(values.includes(driver));
 assert(!values.includes(first.accessToken));
 const recovered=await x.ctl.resume();
 assert.equal(recovered.ok,true);assert.equal(recovered.deliveryId,delivery);
 assert.equal(x.hits.read,2);
});
test('Driver must not remember unverified or terminal custody',async()=>{
 for(const invalid of [null,{...good(),deliveryId:id(9)},
  {...good(),productionEnabled:true},{...good(),revision:1}]){
  const x=setup({readAssignment:async()=>invalid});
  assert.equal((await x.ctl.remember(delivery)).ok,false);assert.equal(x.hits.put,0);
 }
 const t=setup({readAssignment:async()=>good('delivered')});
 assert.equal((await t.ctl.remember(delivery)).code,'DELIVERY_NOT_ACTIVE');
});
test('Driver cannot recover an ID that belongs to another driver',async()=>{
 const x=setup();await x.ctl.remember(delivery);
 const y=setup({getSession:async()=>({...first,userId:other})});
 y.mem.set([...x.mem.keys()][0],[...x.mem.values()][0]);
 assert.equal((await y.ctl.resume()).code,'OTHER_DRIVER_DELIVERY');
 assert.equal(y.hits.read,0);assert.equal(y.mem.size,0);
});
test('Driver session rotation during verification denies storing and resuming',async()=>{
 let count=0;
 const session=async()=>++count%2?first:{...first,accessToken:'rotated-jwt-token-abcdefghijklmnopqrstuvwxyz'};
 const x=setup({getSession:session});
 assert.equal((await x.ctl.remember(delivery)).code,'DRIVER_SESSION_CHANGED');
 assert.equal(x.hits.put,0);
});
test('Driver leaves offline hints inaccessible, never auto-retries POST',async()=>{
 let offline=false;
 const x=setup({readAssignment:async()=>offline?null:good()});
 await x.ctl.remember(delivery);offline=true;
 assert.equal((await x.ctl.resume()).code,'CUSTODY_NOT_VERIFIED');
 assert.equal(x.mem.size,1);assert.equal(x.hits.read,2);
});
test('Driver removes terminal or expired hint, without navigating',async()=>{
 let phase='accepted';
 const x=setup({readAssignment:async()=>good(phase)});
 await x.ctl.remember(delivery);phase='cancelled';
 assert.equal((await x.ctl.resume()).code,'DELIVERY_NOT_ACTIVE');
 assert.equal(x.mem.size,0);
 let now=at;
 const y=setup({clock:()=>now});
 await y.ctl.remember(delivery);now+=8*24*60*60*1000;
 assert.equal((await y.ctl.resume()).code,'INVALID_DELIVERY_HINT');
 assert.equal(y.mem.size,0);
});
test('Driver does not require a keychain to verify active delivery, but cannot promise recovery',async()=>{
 const x=setup({storageEnabled:false});
 const r=await x.ctl.remember(delivery);
 assert.equal(r.ok,true);assert.equal(r.saved,false);
 assert.equal((await x.ctl.resume()).code,'RECOVERY_STORAGE_NOT_AVAILABLE');
});

test('Driver recovery passes the verified actor to owner-scoped G66 reads',async()=>{
 const scoped=setup({readAssignment:async(id,actor)=>{
  assert.equal(id,delivery);
  assert.equal(actor.userId,driver);
  assert.equal(actor.accessToken,first.accessToken);
  return good();
 }});
 assert.equal((await scoped.ctl.remember(delivery)).ok,true);
 assert.equal((await scoped.ctl.resume()).ok,true);
});
