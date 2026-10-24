import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommerceUiReadFence} from './commerce-ui-read-fence.mjs';
const deferred=()=>{let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
};
test('R46 lock is synchronous before await; duplicate touch does not invoke second request',async()=>{
 const work=deferred(),f=createCommerceUiReadFence();
 let calls=0,notifications=0;
 const first=f.run(()=>{calls++;return work.promise;},{onResult:()=>notifications++});
 assert.equal(f.isBusy(),true);
 const duplicate=await f.run(()=>{calls++;return true;});
 assert.equal(duplicate.code,'READ_ALREADY_IN_FLIGHT');
 assert.equal(calls,1);
 work.resolve({ok:true});assert.equal((await first).ok,true);
 assert.equal(notifications,1);assert.equal(f.isBusy(),false);
});
test('R46 switching category before completion discards response feedback',async()=>{
 const work=deferred(),f=createCommerceUiReadFence();let seen=0,done=0;
 const waiting=f.run(()=>work.promise,{onResult:()=>seen++,onFinish:()=>done++});
 f.invalidate();work.resolve({ok:true});
 assert.equal((await waiting).code,'STALE_READ_RESPONSE');
 assert.equal(seen,0);assert.equal(done,1);
 assert.equal((await f.run(()=>({ok:true}))).ok,true);
});
test('R46 disposal cancels visual response without callback after unmount',async()=>{
 const work=deferred(),f=createCommerceUiReadFence();let seen=0,done=0;
 const waiting=f.run(()=>work.promise,{onResult:()=>seen++,onFinish:()=>done++});
 f.dispose();work.resolve({ok:true});
 assert.equal((await waiting).code,'STALE_READ_RESPONSE');
 assert.equal(seen,0);assert.equal(done,0);
 assert.equal(f.isBusy(),false);
 assert.equal((await f.run(()=>true)).code,'READ_FENCE_DISPOSED');
});
test('R46 rejected network promise produces generic feedback, never error details',async()=>{
 const f=createCommerceUiReadFence();let errors=0,done=0;
 const response=await f.run(async()=>{throw Error('private-phone-token')},{
  onError:()=>errors++,onFinish:()=>done++
 });
 assert.deepEqual(response,{ok:false,code:'READ_FAILED'});
 assert.equal(errors,1);assert.equal(done,1);
 assert.equal(f.isBusy(),false);
});
test('R46 delayed rejected fetch after selection change never announces a failure',async()=>{
 const f=createCommerceUiReadFence(),work=deferred();let errors=0;
 const pending=f.run(()=>work.promise,{onError:()=>errors++});
 f.invalidate();work.reject(Error('private-content'));
 assert.equal((await pending).code,'STALE_READ_RESPONSE');
 assert.equal(errors,0);
});
test('R46 no handler does not lock the UI; later request works',async()=>{
 const f=createCommerceUiReadFence();
 assert.equal((await f.run(null)).code,'INVALID_READ_HANDLER');
 assert.equal(f.isBusy(),false);
 assert.equal((await f.run(()=>42)).ok,true);
});
test('R46 callback failure is contained, releases fence and allows retry',async()=>{
 const f=createCommerceUiReadFence();let finished=0;
 const first=await f.run(()=>({ok:true}),{
  onResult:()=>{throw Error('should not leak');},onFinish:()=>finished++
 });
 assert.equal(first.code,'READ_UI_CALLBACK_FAILED');
 assert.equal(finished,1);assert.equal(f.isBusy(),false);
 assert.equal((await f.run(()=>true)).ok,true);
});
test('R46 old generation cannot run feedback from a new request',async()=>{
 const f=createCommerceUiReadFence();const first=deferred();let count=0;
 const pending=f.run(()=>first.promise,{onResult:()=>count++});
 f.invalidate();
 assert.equal((await f.run(()=>true)).code,'READ_ALREADY_IN_FLIGHT');
 first.resolve(true);await pending;
 assert.equal((await f.run(()=>true,{onResult:()=>count++})).ok,true);
 assert.equal(count,1);
});
test('R46 finish callback failures never leave fence in busy state',async()=>{
 const f=createCommerceUiReadFence();
 assert.equal((await f.run(()=>true,{onFinish:()=>{throw Error('ignored');}})).ok,true);
 assert.equal(f.isBusy(),false);
});
test('R46 generation invalidation is safe when already disposed',async()=>{
 const f=createCommerceUiReadFence();f.dispose();f.invalidate();
 assert.equal(f.isBusy(),false);
 assert.equal((await f.run(()=>true)).code,'READ_FENCE_DISPOSED');
});
