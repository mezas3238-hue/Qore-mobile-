import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAcceptedPrivateDeliveryCustody as verify}
 from './driver-delivery-navigation.mjs';
const id=n=>'d0000000-0000-4000-8000-'+String(n).padStart(12,'0');
const deliveryId=id(1);
const snapshot=(phase='active',status='accepted')=>({
 phase,status,deliveryId,revision:2,uncertain:false,qaOnly:true,
 productionEnabled:false
});
test('C accepted delivery requires new authoritative private G66 read',async()=>{
 let read=0;
 const out=await verify({deliveryId,readCustody:async id=>{
  read++;assert.equal(id,deliveryId);return snapshot();
 }});
 assert.equal(out.ok,true);assert.equal(read,1);
 assert(!JSON.stringify(out).includes('Bearer'));
});
test('C permits a terminal delivery only when persisted as same UUID',async()=>{
 const s={...snapshot('terminal','delivered'),revision:5};
 assert.equal((await verify({deliveryId,readCustody:async()=>s})).ok,true);
});
test('C rejects different assigned delivery and invalid revisions',async()=>{
 for(const row of [
  {...snapshot(),deliveryId:id(2)},{...snapshot(),revision:1},
  {...snapshot(),revision:3.2},{...snapshot(),uncertain:true},
  {...snapshot(),phase:'signed-out'},{...snapshot(),phase:'offline'},
  {...snapshot(),phase:'loading'},
  {...snapshot(),productionEnabled:true},
  {...snapshot(),qaOnly:false},{...snapshot(),status:'searching'}
 ]){
  const got=await verify({deliveryId,readCustody:async()=>row});
  assert.equal(got.ok,false);
 }
});
test('C offline, unauthorized or missing server custody cannot navigate',async()=>{
 const bad=await verify({deliveryId,readCustody:async()=>{throw Error('403');}});
 assert.equal(bad.code,'CUSTODY_READ_UNAVAILABLE');
 assert.equal((await verify({deliveryId,readCustody:async()=>null})).ok,false);
 assert.equal((await verify({deliveryId:'bad',readCustody:async()=>snapshot()})).ok,false);
});
