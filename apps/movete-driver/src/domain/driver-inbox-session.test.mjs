import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverInboxSessionController,DRIVER_SESSION_LIVE_ENABLED}
 from './driver-inbox-session.mjs';
const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const offer='33333333-3333-4333-8333-333333333333';
const trip='44444444-4444-4444-8444-444444444444';
const tokenA='a'.repeat(60),tokenB='b'.repeat(60);
const row={kind:'AUTO_RIDE',offerId:offer,serviceId:trip,expiresAtMs:1782000000000};
test('Driver session starts signed out, never exposes bearer, denies other roles',async()=>{
 assert.equal(DRIVER_SESSION_LIVE_ENABLED,false);
 const c=createDriverInboxSessionController({readInbox:async()=>[row]});
 assert.deepEqual(c.current(),{phase:'signed-out',offers:[],liveEnabled:false});
 assert.equal((await c.refresh()).phase,'signed-out');
 assert.equal(c.setSession({role:'passenger',userId:alice,accessToken:tokenA}).phase,
  'authorization-required');
 assert.equal(c.setSession({role:'driver',userId:alice,accessToken:tokenA}).phase,'ready');
 assert.doesNotMatch(JSON.stringify(c.current()),/Bearer|a{20}|11111111/);
 const done=await c.refresh();
 assert.equal(done.phase,'connected');assert.deepEqual(done.offers,[row]);
 assert.equal(Object.isFrozen(done.offers),true);
 assert.equal(c.clear().phase,'signed-out');
 assert.deepEqual(c.current().offers,[]);
});
test('Driver never leaks stale Alice offers after logout and switch to Bob',async()=>{
 let resolveOld;
 const readInbox=async({accessToken})=>{
  if(accessToken===tokenA)return new Promise(resolve=>{resolveOld=resolve;});
  if(accessToken===tokenB)return [];
  throw Error('Unexpected token');
 };
 const c=createDriverInboxSessionController({readInbox});
 c.setSession({role:'driver',userId:alice,accessToken:tokenA});
 const pending=c.refresh();
 assert.equal(c.current().phase,'loading');
 c.clear();
 c.setSession({role:'driver',userId:bob,accessToken:tokenB});
 assert.equal((await c.refresh()).phase,'connected');
 resolveOld([row]);
 assert.equal((await pending).phase,'connected');
 assert.deepEqual(c.current().offers,[],'Alice data leaked into Bob session');
});
test('Driver auth expiry clears identity while offline clears stale offers',async()=>{
 let call=0;
 const c=createDriverInboxSessionController({readInbox:async()=>{
  call++;
  if(call===1)return [row];
  if(call===2)throw Error('Driver inbox unavailable');
  throw Error('Driver session expired');
 }});
 c.setSession({role:'driver',userId:alice,accessToken:tokenA});
 assert.equal((await c.refresh()).offers.length,1);
 const offline=await c.refresh();
 assert.equal(offline.phase,'offline');assert.equal(offline.offers.length,0);
 assert.equal((await c.refresh()).phase,'authorization-required');
 assert.equal((await c.refresh()).phase,'authorization-required');
 assert.equal(call,3,'Revoked session retried without login');
});
test('Driver refuses malformed private response from injected client and avoids caching it',async()=>{
 const c=createDriverInboxSessionController({readInbox:async()=>[{
  ...row,offerId:'INVALID',fullPassengerName:'private'
 }]});
 c.setSession({role:'driver',userId:alice,accessToken:tokenA});
 const state=await c.refresh();
 assert.equal(state.phase,'offline');
 assert.deepEqual(state.offers,[]);
 assert.throws(()=>createDriverInboxSessionController({}),/Trusted Driver/);
});
