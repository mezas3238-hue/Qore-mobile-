import test from 'node:test';
import assert from 'node:assert/strict';
import {createG54ScopedInboxQa,createG54ScopedReadReceiptQa}
 from './g54-scoped-chat-inbox-read-qa.mjs';
const id=n=>'54540000-0000-4454-8454-'+String(n).padStart(12,'0');
const actor=id(1),other=id(3),session=id(101),conversation=id(300),service=id(200);
const now=Date.parse('2026-10-23T23:35:00Z');
const bearer='g54-verified-private-provider-access-token-qa-not-real';
const identity={id:actor,sessionId:session,tokenIatMs:now-1000,expiresAtMs:now+180000,is_anonymous:false};
const inboxTicket={ticket:id(901),operation:'CHAT_INBOX',expiresAtMs:now+10000,
 productionEnabled:false,qaOnly:true};
const readTicket={...inboxTicket,ticket:id(902),operation:'CHAT_READ'};
const dbPage={ownerId:actor,generatedAt:now,expiresAt:now+60000,revision:2,
 items:[{conversationId:conversation,serviceId:service,serviceKind:'RIDE',
 state:'ACTIVE',assignmentVerified:true,counterpartRole:'driver',
 revision:2,unreadCount:1,updatedAt:now-500,canSend:true}],
 hasMore:false,nextPosition:null,productionEnabled:false,qaOnly:true};
const readRequest={bearer,conversationId:conversation,throughSeq:121};
const inboxRequest={bearer,cursor:null,limit:50};
function setup(overrides={}){
 const calls=[];
 const base={
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  cursorSecret:Buffer.alloc(32,8),
  verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'passenger',
  allowRequest:()=>true,now:()=>now,
  mintOwnerTicket:async x=>{
   calls.push({type:'mint',args:x});
   return x.operation==='CHAT_READ'?readTicket:inboxTicket;
  },
  executeScopedTicket:async x=>{
   calls.push({type:'delegate',args:x});
   return {data:x.operation==='CHAT_READ'?{
    conversationId:conversation,readThrough:121,qaOnly:true
   }:dbPage};
  },...overrides
 };
 return {base,calls,inbox:createG54ScopedInboxQa(base),
  receipt:createG54ScopedReadReceiptQa(base)};
}
test('G54 HMAC inbox invokes only scoped ticket and returns exact Cliente B DTO',async()=>{
 const f=setup(),out=await f.inbox.handle(inboxRequest);
 assert.equal(out.status,200,JSON.stringify(out));
 assert.deepEqual(Object.keys(out.body),['ownerId','generatedAt','expiresAt',
  'revision','items','nextCursor','productionEnabled']);
 assert.equal(out.body.items[0].unreadCount,1);
 assert.equal(f.calls.length,2);
 assert.deepEqual(f.calls[0],{type:'mint',args:{
  operation:'CHAT_INBOX',actorId:actor,sessionId:session,
  tokenIatMs:now-1000,conversationId:null
 }});
 assert.deepEqual(f.calls[1],{type:'delegate',args:{
  operation:'CHAT_INBOX',ticket:id(901),
  expectedRevision:null,beforeMs:null,beforeId:null,limit:50
 }});
});
test('G54 Passenger read receipt only uses verified token/session, not caller role',async()=>{
 const f=setup(),out=await f.receipt.handle(readRequest);
 assert.equal(out.status,200);
 assert.deepEqual(out.body,{conversationId:conversation,readThrough:121,qaOnly:true});
 assert.deepEqual(f.calls[0],{type:'mint',args:{
  operation:'CHAT_READ',actorId:actor,sessionId:session,
  tokenIatMs:now-1000,conversationId:conversation
 }});
 assert.deepEqual(f.calls[1],{type:'delegate',args:{
  operation:'CHAT_READ',ticket:id(902),throughSeq:121
 }});
});
test('G54 never mints on caller-supplied identity, invalid cursor, wrong input or unauthenticated',async()=>{
 const f=setup();
 for(const invalid of [
  {...readRequest,actorId:actor},{...readRequest,sessionId:session},
  {...readRequest,role:'admin'},{...readRequest,sql:'SELECT * FROM auth.users'},
  {...readRequest,throughSeq:-1},{...readRequest,throughSeq:1.2},
  {...readRequest,conversationId:'bad'},{...readRequest,throughSeq:null},
  {...readRequest,bearer:'x'},
 ])assert.equal((await f.receipt.handle(invalid)).status,400);
 for(const invalid of [
  {...inboxRequest,role:'driver'},{...inboxRequest,ownerId:actor},
  {...inboxRequest,limit:101},{...inboxRequest,cursor:'fake'}
 ])assert.equal((await f.inbox.handle(invalid)).status,400);
 assert.equal(f.calls.length,0);
});
test('G54 read receipts fail closed for provider outage, revoked/foreign roles and limiter',async()=>{
 const list=[
  [{verifyAccessToken:async()=>{throw Error('bad jwt')}},401],
  [{verifyAccessToken:async()=>({...identity,id:'invalid'})},401],
  [{verifyAccessToken:async()=>({...identity,expiresAtMs:now})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('down')}},503],
  [{resolveExclusiveRole:async()=> 'driver'},403],
  [{resolveExclusiveRole:async()=> ['driver','passenger']},403],
  [{resolveExclusiveRole:async()=>{throw Error('outage')}},503],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('outage')}},503],
  [{mintOwnerTicket:async()=>{throw Error('owner down')}},503],
  [{executeScopedTicket:async()=>{throw Error('PG down')}},503],
  [{now:(()=>{let i=0;return ()=>i++===0?now:now+200001;})()},503]
 ];
 for(const [override,status] of list){
  const f=setup(override);
  assert.equal((await f.receipt.handle(readRequest)).status,status);
 }
});
test('G54 rejects untrusted mint and changed or future watermark in delegated receipt',async()=>{
 for(const ticket of [
  {...readTicket,qaOnly:false},
  {...readTicket,productionEnabled:true},
  {...readTicket,operation:'CHAT_INBOX'},
  {...readTicket,expiresAtMs:now-1},
  {...readTicket,expiresAtMs:now+30000},
  {...readTicket,ticket:'bad'}
 ]){
  const f=setup({mintOwnerTicket:async()=>ticket});
  assert.equal((await f.receipt.handle(readRequest)).status,503);
  assert.equal(f.calls.length,0);
 }
 for(const output of [
  {conversationId:conversation,readThrough:120,qaOnly:true},
  {conversationId:other,readThrough:121,qaOnly:true},
  {conversationId:conversation,readThrough:121,qaOnly:false},
  {conversationId:conversation,readThrough:121,qaOnly:true,email:'leak'},
  {conversationId:conversation,readThrough:-1,qaOnly:true},
  {conversationId:conversation,readThrough:121.1,qaOnly:true}
 ]){
  const f=setup({executeScopedTicket:async()=>({data:output})});
  assert.equal((await f.receipt.handle(readRequest)).status,503);
 }
 for(const [sql,status] of [
  ['G5401',401],['G5402',400],['G5403',403],
  ['G5404',409],['G5405',409],['G5003',403],['G5102',400],['XX999',503]
 ]){
  const f=setup({executeScopedTicket:async()=>({error:{code:sql}})});
  assert.equal((await f.receipt.handle(readRequest)).status,status);
 }
});
test('G54 blocked construction for LIVE, missing sources and weak cursor secret',()=>{
 for(const changes of [
  {environment:'production'},{liveEnabled:true},{localQaOnly:false},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},
  {mintOwnerTicket:null},{executeScopedTicket:null},
 ])assert.throws(()=>setup(changes));
 assert.throws(()=>createG54ScopedInboxQa({...setup().base,
  cursorSecret:Buffer.alloc(8)}));
});
