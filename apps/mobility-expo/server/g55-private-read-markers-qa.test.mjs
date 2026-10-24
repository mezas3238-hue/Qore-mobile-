import test from 'node:test';
import assert from 'node:assert/strict';
import {createG55HistoryWithReadMarkerQa,createG55MarkVisibleMessageQa}
 from './g55-private-read-markers-qa.mjs';
const id=n=>'55550000-0000-4555-8555-'+String(n).padStart(12,'0');
const actor=id(1),other=id(3),session=id(101),service=id(200);
const conversation=id(300),driverMessage=id(501),passengerMessage=id(502);
const now=Date.parse('2026-10-24T01:00:00Z');
const bearer='verified-provider-passenger-private-token-g55-qa';
const identity={id:actor,sessionId:session,tokenIatMs:now-1000,
 expiresAtMs:now+180000,is_anonymous:false};
const req={bearer,serviceKind:'RIDE',serviceId:service,cursor:null,
 limit:100,expectedConversationId:null};
const markReq={bearer,conversationId:conversation,marker:id(905)};
const open={conversationId:conversation,serviceKind:'RIDE',serviceId:service,
 serverStored:true,qaOnly:true};
const page={conversationId:conversation,serviceId:service,serviceKind:'RIDE',
 ownerId:actor,counterpartRole:'driver',assignmentVerified:true,
 state:'ACTIVE',revision:3,generatedAt:now,expiresAt:now+60000,
 messages:[{messageId:passengerMessage,senderRole:'passenger',body:'Gracias',
  createdAt:now-500,revision:3},
 {messageId:driverMessage,senderRole:'driver',body:'Estoy en la esquina',
  createdAt:now-1000,revision:2}],
 hasMore:false,nextPosition:null,canSend:true,productionEnabled:false,qaOnly:true};
const marker={marker:id(905),messageId:driverMessage,expiresAtMs:now+60000};
const ticket=op=>({ticket:op==='CHAT_READ'?id(907):op==='CHAT_HISTORY'?
 id(906):id(904),operation:op,expiresAtMs:now+10000,
 productionEnabled:false,qaOnly:true});
const confirm={conversationId:conversation,messageId:driverMessage,
 qaOnly:true,readConfirmed:true,readThrough:11};
function fx(overrides={}){
 const calls=[];
 const options={environment:'isolated_staging',localQaOnly:true,
  liveEnabled:false,cursorSecret:Buffer.alloc(32,4),now:()=>now,
  verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'passenger',allowRequest:()=>true,
  mintOwnerTicket:async args=>{calls.push({kind:'mint',args});return ticket(args.operation);},
  executeScopedTicket:async args=>{
   calls.push({kind:'delegate',args});
   if(args.operation==='CHAT_OPEN')return {data:open};
   if(args.operation==='CHAT_HISTORY_MARKER')
    return {data:{page,readMarker:marker,qaOnly:true,productionEnabled:false}};
   if(args.operation==='CHAT_MARK_VISIBLE')return {data:confirm};
   return {error:{code:'UNEXPECTED_SCOPE'}};
  },...overrides};
 return {calls,options,history:createG55HistoryWithReadMarkerQa(options),
  reader:createG55MarkVisibleMessageQa(options)};
}
test('G55 wraps exact B G52 history, sidecar only for authorized returned Driver message',async()=>{
 const f=fx();const r=await f.history.handle(req);
 assert.equal(r.status,200,JSON.stringify(r));
 assert.deepEqual(Object.keys(r.body),['page','readMarker','qaOnly','productionEnabled']);
 assert.deepEqual(r.body.readMarker,marker);
 assert.deepEqual(Object.keys(r.body.page),[
  'conversationId','serviceId','serviceKind','ownerId','counterpartRole',
  'assignmentVerified','state','revision','generatedAt','expiresAt',
  'messages','nextCursor','canSend','productionEnabled']);
 assert.ok(!Object.hasOwn(r.body.page.messages[1],'seq'));
 assert.equal(f.calls.length,4);
 assert.deepEqual(f.calls[0],{kind:'mint',args:{
  operation:'CHAT_OPEN',actorId:actor,sessionId:session,
  tokenIatMs:now-1000,serviceKind:'RIDE',
  serviceId:service,conversationId:null}});
 assert.deepEqual(f.calls[2],{kind:'mint',args:{
  operation:'CHAT_HISTORY',actorId:actor,sessionId:session,
  tokenIatMs:now-1000,serviceKind:'RIDE',
  serviceId:service,conversationId:conversation}});
 assert.deepEqual(f.calls[3],{kind:'delegate',args:{
  operation:'CHAT_HISTORY_MARKER',ticket:id(906),
  expectedRevision:null,beforeSeq:null,limit:100}});
});
test('G55 explicit visible read uses independent G54 session ticket and NEVER forwards raw seq',async()=>{
 const f=fx();const r=await f.reader.handle(markReq);
 assert.equal(r.status,200);
 assert.deepEqual(r.body,{conversationId:conversation,
  messageId:driverMessage,readConfirmed:true,qaOnly:true});
 assert.equal(f.calls.length,2);
 assert.deepEqual(f.calls[0],{kind:'mint',args:{
  operation:'CHAT_READ',actorId:actor,sessionId:session,
  tokenIatMs:now-1000,conversationId:conversation}});
 assert.deepEqual(f.calls[1],{kind:'delegate',args:{
  operation:'CHAT_MARK_VISIBLE',ticket:id(907),marker:id(905)}});
 assert.equal(JSON.stringify(f.calls).includes('readThrough'),false);
});
test('G55 no marker when history has only passenger messages',async()=>{
 const f=fx({executeScopedTicket:async args=>args.operation==='CHAT_OPEN'?
  {data:open}:{data:{page:{...page,messages:[page.messages[0]]},
  readMarker:null,qaOnly:true,productionEnabled:false}}});
 const r=await f.history.handle(req);
 assert.equal(r.status,200);assert.equal(r.body.readMarker,null);
});
test('G55 refuses forged marker not linked to returned driver message and poisoned history envelope',async()=>{
 for(const offer of [
  {page,readMarker:{...marker,messageId:passengerMessage},qaOnly:true,productionEnabled:false},
  {page,readMarker:{...marker,marker:'bad'},qaOnly:true,productionEnabled:false},
  {page,readMarker:{...marker,expiresAtMs:now-1},qaOnly:true,productionEnabled:false},
  {page,readMarker:{...marker,expiresAtMs:now+90000},qaOnly:true,productionEnabled:false},
  {page,readMarker:null,qaOnly:true,productionEnabled:false},
  {page,readMarker:marker,qaOnly:false,productionEnabled:false},
  {page,readMarker:marker,qaOnly:true,productionEnabled:true},
  {page:{...page,ownerId:other},readMarker:marker,qaOnly:true,productionEnabled:false},
 ]){
  const f=fx({executeScopedTicket:async args=>args.operation==='CHAT_OPEN'?
   {data:open}:{data:offer}});
  const r=await f.history.handle(req);
  assert.equal(r.status,503,JSON.stringify(offer).slice(0,130));
 }
});
test('G55 strict input and session/role denial cannot mint a read ticket',async()=>{
 const f=fx();
 for(const bad of [
  {...markReq,actorId:actor},{...markReq,role:'passenger'},
  {...markReq,sessionId:session},{...markReq,throughSeq:999999},
  {...markReq,marker:'not-uuid'},{...markReq,conversationId:'bad'},
  {...markReq,bearer:'no'}
 ]){
  assert.equal((await f.reader.handle(bad)).status,400);
 }
 assert.equal(f.calls.length,0);
 for(const [patch,status] of [
  [{verifyAccessToken:async()=>{throw Error('JWT forged')}},401],
  [{verifyAccessToken:async()=>({...identity,id:'bad'})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{resolveExclusiveRole:async()=> 'driver'},403],
  [{resolveExclusiveRole:async()=> ['driver','passenger']},403],
  [{resolveExclusiveRole:async()=>{throw Error('offline')}},503],
  [{allowRequest:()=>false},429],
  [{mintOwnerTicket:async()=>{throw Error('offline')}},503],
  [{executeScopedTicket:async()=>{throw Error('offline')}},503],
 ]){
  assert.equal((await fx(patch).reader.handle(markReq)).status,status);
 }
});
test('G55 damaged mint, SQL errors and untrusted read receipts fail closed',async()=>{
 for(const t of [
  {...ticket('CHAT_READ'),qaOnly:false},
  {...ticket('CHAT_READ'),operation:'CHAT_HISTORY'},
  {...ticket('CHAT_READ'),expiresAtMs:now+30000},
  {...ticket('CHAT_READ'),ticket:'broken'}
 ]){
  assert.equal((await fx({mintOwnerTicket:async()=>t}).reader.handle(markReq)).status,503);
 }
 for(const bad of [
  {...confirm,conversationId:other},{...confirm,messageId:'bad'},
  {...confirm,readThrough:-1},{...confirm,readConfirmed:false},
  {...confirm,secret:'leak'}
 ]){
  assert.equal((await fx({executeScopedTicket:async()=>({data:bad})})
   .reader.handle(markReq)).status,503);
 }
 for(const [code,status] of [
  ['G5401',401],['G5403',403],['G5404',409],
  ['G5405',409],['G5505',409],['G5502',400],['G5503',503],
  ['G5003',403],['G5004',409]
 ]){
  assert.equal((await fx({executeScopedTicket:async()=>({error:{code}})})
   .reader.handle(markReq)).status,status);
 }
});
test('G55 production cannot be enabled and provider/SQL authorities mandatory',()=>{
 for(const change of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},
  {mintOwnerTicket:null},{executeScopedTicket:null}
 ])assert.throws(()=>fx(change));
 assert.throws(()=>createG55HistoryWithReadMarkerQa({
  ...fx().options,cursorSecret:Buffer.alloc(5)}));
});
test('G55 parallel history reads cannot leak one session/conversation marker to another',async()=>{
 const f=fx();
 const requests=[{...req},{...req,expectedConversationId:conversation}];
 const out=await Promise.all(requests.map(r=>f.history.handle(r)));
 assert.deepEqual(out.map(x=>x.status),[200,200]);
 assert.ok(out.every(x=>x.body.readMarker?.messageId===driverMessage));
});
