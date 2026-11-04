import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupportRequestFence} from './support-request-fence.mjs';

test('G309: an in-flight ticket result is rejected after logout',async()=>{
 const fence=createSupportRequestFence();
 const request=fence.begin();
 let resolve;
 const pending=new Promise(r=>{resolve=r;});
 const read=pending.then(cases=>fence.isCurrent(request)?cases:null);
 fence.invalidate(); // sign-out happens immediately, before async network
 resolve([{case_code:'MF-2026-007'}]);
 assert.equal(await read,null);
});

test('G309: a newer sign-in or refresh supersedes older responses',()=>{
 const fence=createSupportRequestFence();
 const old=fence.begin();
 const fresh=fence.begin();
 assert.equal(fence.isCurrent(old),false);
 assert.equal(fence.isCurrent(fresh),true);
 fence.invalidate();
 assert.equal(fence.isCurrent(fresh),false);
});

test('G309: initial auto-login check cannot unlock portal after sign-out',()=>{
 const fence=createSupportRequestFence();
 const initialization=fence.current();
 fence.invalidate();
 assert.equal(fence.isCurrent(initialization),false);
});

test('G309: malformed revision values fail closed',()=>{
 const fence=createSupportRequestFence();
 for(const invalid of [null,undefined,-1,NaN,Infinity,0.5,'0',{},[]]){
  assert.equal(fence.isCurrent(invalid),false);
 }
 assert.equal(fence.isCurrent(0),true);
});
