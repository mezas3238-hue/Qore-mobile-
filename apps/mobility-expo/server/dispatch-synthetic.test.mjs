import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticDispatch,DISPATCH_LIVE_ENABLED} from './dispatch-synthetic.mjs';
test('one driver accepts, second rejected',()=>{
 const d=createSyntheticDispatch({now:()=>1000});assert.equal(DISPATCH_LIVE_ENABLED,false);
 assert.equal(d.request({rideId:'r1',passengerId:'p1'}).ok,true);
 assert.equal(d.offer({rideId:'r1',driverId:'a',expiresAtMs:2000}).ok,true);
 assert.equal(d.offer({rideId:'r1',driverId:'b',expiresAtMs:2000}).ok,true);
 assert.equal(d.accept({rideId:'r1',driverId:'a'}).ok,true);
 assert.equal(d.accept({rideId:'r1',driverId:'b'}).ok,false);
 assert.equal(d.snapshot({rideId:'r1',actorId:'p1'}).driverId,'a');
 assert.equal(d.snapshot({rideId:'r1',actorId:'b'}).ok,false);
});
test('expired offer and invalid duplicate ride are rejected',()=>{
 const d=createSyntheticDispatch({now:()=>1000});d.request({rideId:'r2',passengerId:'p'});
 assert.equal(d.request({rideId:'r2',passengerId:'p'}).ok,false);
 assert.equal(d.offer({rideId:'r2',driverId:'a',expiresAtMs:1000}).ok,false);
 assert.equal(d.offer({rideId:'r2',driverId:'a',expiresAtMs:1001}).ok,true);
 const e=createSyntheticDispatch({now:()=>2000});e.request({rideId:'r3',passengerId:'p'});assert.equal(e.accept({rideId:'r3',driverId:'a'}).ok,false);
});
test('only assigned driver can progress, passenger can cancel',()=>{
 const d=createSyntheticDispatch({now:()=>1000});d.request({rideId:'r',passengerId:'p'});d.offer({rideId:'r',driverId:'a',expiresAtMs:2000});d.accept({rideId:'r',driverId:'a'});
 assert.equal(d.transition({rideId:'r',actorId:'other',event:'arrive'}).ok,false);
 assert.equal(d.transition({rideId:'r',actorId:'a',event:'arrive'}).status,'arriving');
 assert.equal(d.transition({rideId:'r',actorId:'p',event:'cancel'}).status,'cancelled');
 assert.equal(d.transition({rideId:'r',actorId:'a',event:'pickup'}).ok,false);
});
