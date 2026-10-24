import test from 'node:test';
import assert from 'node:assert/strict';
import {createG57OrderedHistoryQa,createG57MarkVisibleOrderedQa}
 from './g57-ordered-visible-qa.mjs';
const id=n=>'57570000-0000-4757-8757-'+String(n).padStart(12,'0');
const passenger=id(1),other=id(3),session=id(101),service=id(200),
 conversation=id(300),first=id(501),second=id(503),own=id(502);
const at=Date.parse('2026-10-24T10:00:00Z');
const bearer='qa-verified-passenger-g57-provider-token-0000';
const identity={id:passenger,sessionId:session,tokenIatMs:at-1000,
 expiresAtMs:at+180000,is_anonymous:false};
const request={bearer,serviceKind:'RIDE',serviceId:service,
 cursor:null,limit:100,expectedConversationId:null};
const read={bearer,conversationId:conversation,messageId:first,marker:id(901)};
const opened={conversationId:conversation,serviceKind:'RIDE',serviceId:service,serverStored:true,qaOnly:true};
const msg=(messageId,senderRole,revision)=>({messageId,senderRole,
 body:'Mensaje privado',createdAt:at-1000,revision});
const page={conversationId:conversation,serviceId:service,serviceKind:'RIDE',
 ownerId:passenger,counterpartRole:'driver',assignmentVerified:true,
 state:'ACTIVE',revision:4,generatedAt:at,expiresAt:at+60000,
 messages:[msg(second,'driver',4),msg(own,'passenger',3),msg(first,'driver',2)],
 hasMore:false,nextPosition:null,canSend:true,productionEnabled:false,qaOnly:true};
const marks=[
 {marker:id(903),messageId:second,expiresAtMs:at+60000},
 {marker:id(901),messageId:first,expiresAtMs:at+60000}
];
const cap=op=>({ticket:op==='CHAT_OPEN'?id(910):op==='CHAT_HISTORY'?id(911):id(912),
 operation:op,expiresAtMs:at+12000,productionEnabled:false,qaOnly:true});
const ack={conversationId:conversation,messageId:first,readConfirmed:true,qaOnly:true};
function fx(changes={}){
 const calls=[];
 const cfg={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
 cursorSecret:Buffer.alloc(32,57),now:()=>at,
 verifyAccessToken:async()=>identity,verifySessionNotRevoked:async()=>true,
 resolveExclusiveRole:async()=> 'passenger',allowRequest:()=>true,
 mintOwnerTicket:async x=>{calls.push(['mint',x]);return cap(x.operation);},
 executeScopedTicket:async x=>{
  calls.push(['sql',x]);
  if(x.operation==='CHAT_OPEN')return {data:opened};
  if(x.operation==='CHAT_HISTORY_ORDERED_MARKERS')
   return {data:{page,readMarkers:marks,qaOnly:true,productionEnabled:false}};
  if(x.operation==='CHAT_MARK_VISIBLE_ORDERED')return {data:ack};
  return {error:{code:'BAD_OPERATION'}};
 },...changes};
 return {history:createG57OrderedHistoryQa(cfg),
  reader:createG57MarkVisibleOrderedQa(cfg),cfg,calls};
}
test('G57 returns exact unmodified G52 page plus one opaque marker per incoming Driver message',async()=>{
 const f=fx();
 const r=await f.history.handle(request);
 assert.equal(r.status,200,JSON.stringify(r));
 assert.deepEqual(r.body.readMarkers,marks);
 assert.equal(r.body.page.nextCursor,null);
 assert.equal(r.body.page.messages.length,3);
 assert.ok(r.body.readMarkers.every(m=>!Object.hasOwn(m,'seq')));
 assert.deepEqual(f.calls.at(-1),['sql',{
  operation:'CHAT_HISTORY_ORDERED_MARKERS',ticket:id(911),
  expectedRevision:null,beforeSeq:null,limit:100
 }]);
 assert.equal(JSON.stringify(r.body).includes('beforeSeq'),false);
});
test('G57 accepts only explicitly acknowledged messageId and server-issued marker',async()=>{
 const f=fx();
 const r=await f.reader.handle(read);
 assert.equal(r.status,200);
 assert.deepEqual(r.body,ack);
 assert.deepEqual(f.calls[0],['mint',{
  operation:'CHAT_READ',actorId:passenger,sessionId:session,
  tokenIatMs:at-1000,conversationId:conversation
 }]);
 assert.deepEqual(f.calls[1],['sql',{
  operation:'CHAT_MARK_VISIBLE_ORDERED',ticket:id(912),marker:id(901)
 }]);
 assert.equal(JSON.stringify(f.calls).includes('readThrough'),false);
});
test('G57 fails closed for absent, forged, duplicate, passenger or expired page markers',async()=>{
 for(const bad of [
  [marks[0]],[marks[0],marks[0]],[],[...marks,{marker:id(904),messageId:own,expiresAtMs:at+60000}],
  [marks[0],{...marks[1],messageId:own}],
  [marks[0],{...marks[1],marker:'bad'}],
  [marks[0],{...marks[1],expiresAtMs:at-1}],
  [marks[0],{...marks[1],expiresAtMs:at+61000}],
  [marks[0],{...marks[1],extra:'leak'}]
 ]){
  const f=fx({executeScopedTicket:async op=>
   op.operation==='CHAT_OPEN'?{data:opened}:
   {data:{page,readMarkers:bad,qaOnly:true,productionEnabled:false}}});
  assert.equal((await f.history.handle(request)).status,503);
 }
});
test('G57 remaps SQL earlier-unread refusal and stale receipt without declaring success',async()=>{
 for(const [code,status] of [
  ['G5708',409],['G5709',409],['G5705',409],
  ['G5405',409],['G5404',409],['G5401',401],
  ['G5403',403],['G5003',403],['G5702',400],['G5703',503]
 ]){
  const f=fx({executeScopedTicket:async()=>({error:{code}})});
  const res=await f.reader.handle(read);
  assert.equal(res.status,status,code);
  assert.notEqual(res.body.readConfirmed,true);
 }
 const skipped=fx({executeScopedTicket:async()=>({error:{code:'G5708'}})});
 assert.equal((await skipped.reader.handle(read)).body.code,'EARLIER_UNREAD_MESSAGE');
});
test('G57 rejects untrusted ACK including different message, raw seq or forged sender',async()=>{
 for(const bad of [
  {...ack,messageId:second},{...ack,conversationId:other},
  {...ack,readConfirmed:false},{...ack,readThrough:99},
  {...ack,senderId:passenger},{...ack,qaOnly:false}
 ]){
  const r=await fx({executeScopedTicket:async()=>({data:bad})})
   .reader.handle(read);
  assert.equal(r.status,503,JSON.stringify(bad));
 }
});
test('G57 refuses forged actor, unverified JWT, revoked session or Passenger role mismatch',async()=>{
 const f=fx();
 for(const bad of [
  {...read,actorId:passenger},{...read,sessionId:session},
  {...read,throughSeq:111},{...read,visible:true},
  {...read,messageId:'bad'},{...read,marker:'not-a-uuid'},
  {...read,bearer:'bad'},{...read,conversationId:'bad'}
 ]){
  assert.equal((await f.reader.handle(bad)).status,400);
 }
 assert.equal(f.calls.length,0);
 for(const [changes,status] of [
  [{verifyAccessToken:async()=>{throw Error('JWT forged')}},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{resolveExclusiveRole:async()=> 'driver'},403],
  [{resolveExclusiveRole:async()=> ['driver','passenger']},403],
  [{allowRequest:()=>false},429],
  [{mintOwnerTicket:async()=>{throw Error('offline')}},503],
  [{executeScopedTicket:async()=>{throw Error('offline')}},503]
 ]){
  assert.equal((await fx(changes).reader.handle(read)).status,status);
 }
});
test('G57 requires isolated QA and independent authorities; cannot run as LIVE',()=>{
 for(const change of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},
  {mintOwnerTicket:null},{executeScopedTicket:null}
 ]){
  assert.throws(()=>createG57MarkVisibleOrderedQa({...fx().cfg,...change}));
 }
 assert.throws(()=>createG57OrderedHistoryQa({
  ...fx().cfg,cursorSecret:Buffer.alloc(4)
 }));
});
