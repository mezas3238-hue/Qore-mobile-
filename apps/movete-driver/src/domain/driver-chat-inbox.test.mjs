import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverChatInboxController,DRIVER_CHAT_LIVE_ENABLED}
 from './driver-chat-inbox.mjs';
const id=n=>'56561500-0000-4656-8656-'+String(n).padStart(12,'0');
const driver=id(1),other=id(2),at=Date.parse('2026-10-24T10:00:00Z');
const token='trusted-provider-driver-token-qa-lab-000000';
const session=userId=>({userId,role:'driver',accessToken:token});
const row=(n)=>({conversationId:id(300+n),serviceId:id(200+n),
 serviceKind:'RIDE',counterpartRole:'passenger',state:'ACTIVE',
 assignmentVerified:true,canSend:true,revision:2,unreadCount:n,
 updatedAt:at-1000-n});
const page=(rows,cursor=null,ownerId=driver,revision=5)=>({
 ownerId,revision,generatedAt:at,expiresAt:at+60000,
 items:rows,nextCursor:cursor,productionEnabled:false,qaOnly:true
});
const success=x=>({status:200,body:x});
test('G56C Driver mobile remains OFF; no JWT, user ID or raw cursor in snapshots',async()=>{
 assert.equal(DRIVER_CHAT_LIVE_ENABLED,false);
 const calls=[];
 const ctl=createDriverChatInboxController({readPage:async x=>{
  calls.push(x);return success(page([row(1),row(2)],'opaque-keyset-token'));
 },now:()=>at,pageSize:2});
 assert.equal(ctl.current().phase,'signed-out');
 ctl.setSession(session(driver));
 assert.equal(ctl.current().phase,'ready');
 assert.equal((await ctl.refresh()).phase,'connected');
 assert.deepEqual(calls,[{bearer:token,cursor:null,limit:2}]);
 assert.equal(ctl.current().conversations.length,2);
 assert.equal(ctl.current().hasMore,true);
 assert.equal(ctl.current().productionEnabled,false);
 assert.ok(!JSON.stringify(ctl.current()).includes(token));
 assert.ok(!JSON.stringify(ctl.current()).includes(driver));
 assert.ok(!JSON.stringify(ctl.current()).includes('opaque-keyset-token'));
 assert.equal(ctl.current().conversations[0].unreadCount,1);
});
test('G56C loads paginated conversations without imposing a global record cap',async()=>{
 let calls=0;
 const ctl=createDriverChatInboxController({pageSize:2,now:()=>at,
  readPage:async ()=>success(++calls===1?
   page([row(1),row(2)],'page-two-token'):page([row(3)],null))
 });
 ctl.setSession(session(driver));
 await ctl.refresh();
 assert.equal(ctl.current().hasMore,true);
 await ctl.loadMore();
 assert.equal(ctl.current().conversations.length,3);
 assert.equal(ctl.current().hasMore,false);
 assert.equal(calls,2);
 await ctl.loadMore();
 assert.equal(calls,2);
});
test('G56C logout/account change during pending request never revives old Driver chats',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const ctl=createDriverChatInboxController({readPage:async()=>gate,now:()=>at});
 ctl.setSession(session(driver));
 const pending=ctl.refresh();
 ctl.clear();
 release(success(page([row(1)])));
 await pending;
 assert.equal(ctl.current().phase,'signed-out');
 assert.deepEqual(ctl.current().conversations,[]);
 ctl.setSession(session(other));
 assert.equal(ctl.current().phase,'ready');
 assert.deepEqual(ctl.current().conversations,[]);
});
test('G56C rejects foreign owner, leaked PII and mixed service reassignment across pages',async()=>{
 for(const bad of [
  page([row(1)],null,other),
  page([{...row(1),phone:'+595'}]),
  page([{...row(1),senderId:id(999)}]),
  page([{...row(1),assignmentVerified:false}]),
  page([{...row(1),state:'CLOSED'}]),
  page([{...row(1),unreadCount:-1}]),
  page([{...row(1),body:'confidential'}]),
  page([row(2),row(1)]),
  page([row(1),row(1)]),
  page([row(1)],null,driver,0),
  {...page([row(1)]),productionEnabled:true}
 ]){
  const ctl=createDriverChatInboxController({readPage:async()=>success(bad),now:()=>at});
  ctl.setSession(session(driver));
  assert.equal((await ctl.refresh()).phase,'offline',JSON.stringify(bad).slice(0,120));
  assert.deepEqual(ctl.current().conversations,[]);
 }
 let n=0;
 const ctl=createDriverChatInboxController({pageSize:2,now:()=>at,
  readPage:async()=>success(++n===1?
   page([row(1),row(2)],'another-cursor'):
   page([{...row(3),serviceId:row(2).serviceId}],null))
 });
 ctl.setSession(session(driver));
 await ctl.refresh();
 assert.equal((await ctl.loadMore()).phase,'offline');
 assert.deepEqual(ctl.current().conversations,[]);
});
test('G56C revision mismatch, expired page, unauthorised HTTP and network fail closed',async()=>{
 let now=at;
 for(const response of [
  {status:401,body:{code:'REVOKED_SESSION'}},
  {status:409,body:{code:'G5619'}},
  {status:503,body:{code:'OFFLINE'}},
  success({...page([row(1)]),expiresAt:at-1})
 ]){
  const c=createDriverChatInboxController({now:()=>now,readPage:async()=>response});
  c.setSession(session(driver));
  assert.equal((await c.refresh()).phase,'offline');
 }
 const ctl=createDriverChatInboxController({now:()=>now,readPage:async()=>success(page([row(1)]))});
 ctl.setSession(session(driver));
 await ctl.refresh();
 now=at+61000;
 assert.equal(ctl.tick().phase,'offline');
 assert.equal(ctl.current().conversations.length,0);
});
test('G56C requires a trusted injected reader, refuses real LIVE and forged sessions',()=>{
 assert.throws(()=>createDriverChatInboxController());
 assert.throws(()=>createDriverChatInboxController({readPage:async()=>{},liveEnabled:true}));
 assert.throws(()=>createDriverChatInboxController({readPage:async()=>{},pageSize:101}));
 const ctl=createDriverChatInboxController({readPage:async()=>success(page([])),now:()=>at});
 for(const wrong of [
  {role:'passenger',userId:driver,accessToken:token},
  {role:'driver',userId:'not-uuid',accessToken:token},
  {role:'driver',userId:driver,accessToken:'bad'}
 ])assert.equal(ctl.setSession(wrong).phase,'authorization-required');
 assert.equal(ctl.setSession(null).phase,'signed-out');
});
