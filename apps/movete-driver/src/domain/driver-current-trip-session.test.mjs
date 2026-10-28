import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPrivateDriverCurrentTrip as verify}
 from './driver-current-trip-session.mjs';
const id=n=>'d0000000-0000-4000-8000-'+String(n).padStart(12,'0');
const token='qa-verified-driver-token-abcdefghijklmnopqrstuvwxyz';
const session={role:'driver',userId:id(1),accessToken:token};
const trip={tripId:id(2),status:'accepted',revision:2};
const cfg=(x={})=>({session,getSession:async()=>session,
 readCurrent:async({accessToken})=>{assert.equal(accessToken,token);return trip;},...x});
test('G106 dual-auth read returns only valid private AUTO assignment',async()=>{
 const got=await verify(cfg());
 assert.deepEqual(got,trip);assert(Object.isFrozen(got));
 assert(!JSON.stringify(got).includes(token));
 assert.equal(await verify(cfg({readCurrent:async()=>null})),null);
});
test('G106 does not consult endpoint for invalid role/token/actor',async()=>{
 let calls=0;
 for(const bad of [null,{...session,role:'passenger'},
  {...session,userId:'not-a-uuid'},{...session,accessToken:'bad'}]){
  await assert.rejects(()=>verify(cfg({session:bad,
   readCurrent:async()=>{calls++;return trip;}})));
 }
 assert.equal(calls,0);
});
test('G106 rejects swapped account or silently rotated token during response',async()=>{
 for(const after of [null,{...session,userId:id(3)},
  {...session,accessToken:'qa-rotated-token-abcdefghijklmnopqrstuvwxyz'},
  {...session,role:'passenger'}]){
  await assert.rejects(()=>verify(cfg({getSession:async()=>after})),
   /session changed/);
 }
});
test('G106 rejects revoked Auth after GET and never accepts a stale assignment',async()=>{
 await assert.rejects(()=>verify(cfg({getSession:async()=>{
  throw Error('token revoked');}})),/session changed/);
 await assert.rejects(()=>verify(cfg({readCurrent:async()=>{
  throw Error('database offline');}})),/unavailable/);
});
test('G106 rejects fake reader trips, terminal state and malformed revisions',async()=>{
 for(const invalid of [{...trip,driverId:id(1)},
  {...trip,status:'completed'}, {...trip,status:'cancelled'},
  {...trip,tripId:'fake'}, {...trip,revision:1},
  {...trip,revision:2.1}, {},undefined]){
  await assert.rejects(()=>verify(cfg({readCurrent:async()=>invalid})),
   /assignment not verified/);
 }
});
