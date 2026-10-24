import test from 'node:test';
import assert from 'node:assert/strict';
import {createG57BDriverHistoryWithOrderedMarkersQa,createG57BDriverMarkVisibleOrderedQa}
 from './g57b-driver-ordered-visible-qa.mjs';
const id=n=>'57572000-0000-4757-8757-'+String(n).padStart(12,'0');
const driver=id(2),other=id(3),session=id(102),service=id(200),
 conversation=id(300),first=id(501),second=id(503),own=id(502);
const at=Date.parse('2026-10-24T11:00:00Z');
const bearer='qa-authenticated-exclusive-driver-token-5757';
const identity={id:driver,sessionId:session,tokenIatMs:at-1000,
 expiresAtMs:at+180000,is_anonymous:false};
const historyReq={bearer,serviceKind:'RIDE',serviceId:service,
 conversationId:conversation,cursor:null,limit:100};
const readReq={bearer,conversationId:conversation,messageId:first,marker:id(901)};
const page={conversationId:conversation,serviceId:service,serviceKind:'RIDE',
 ownerId:driver,counterpartRole:'passenger',assignmentVerified:true,state:'ACTIVE',
 revision:4,generatedAt:at,expiresAt:at+60000,canSend:true,productionEnabled:false,qaOnly:true,
 messages:[
  {messageId:second,senderRole:'passenger',body:'Segundo mensaje',createdAt:at-200,revision:4},
  {messageId:own,senderRole:'driver',body:'Voy llegando',createdAt:at-500,revision:3},
  {messageId:first,senderRole:'passenger',body:'Primer mensaje',createdAt:at-900,revision:2}
 ],hasMore:false,nextPosition:null};
const markers=[
 {marker:id(903),messageId:second,expiresAtMs:at+60000},
 {marker:id(901),messageId:first,expiresAtMs:at+60000}
];
const ack={conversationId:conversation,messageId:first,readConfirmed:true,qaOnly:true};
const ticket=op=>({ticket:id(op==='DRIVER_HISTORY'?9011:9012),
 operation:op,expiresAtMs:at+15000,qaOnly:true,productionEnabled:false});
function fx(extra={}){
 const calls=[];
 const conf={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  cursorSecret:Buffer.alloc(32,57),now:()=>at,
  verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,resolveExclusiveRole:async()=> 'driver',
  allowRequest:()=>true,
  mintOwnerTicket:async args=>{calls.push(['mint',args]);return ticket(args.operation);},
  executeScopedTicket:async args=>{
   calls.push(['sql',args]);
   if(args.operation==='DRIVER_HISTORY_ORDERED_MARKERS')return {data:{
    page,readMarkers:markers,qaOnly:true,productionEnabled:false}};
   if(args.operation==='DRIVER_MARK_VISIBLE_ORDERED')return {data:ack};
   return {error:{code:'UNEXPECTED_OPERATION'}};
  },...extra};
 return {history:createG57BDriverHistoryWithOrderedMarkersQa(conf),
  read:createG57BDriverMarkVisibleOrderedQa(conf),calls,conf};
}
test('G57B Driver gets original G56 sealed page and exact markers for incoming Passenger messages',async()=>{
 const f=fx();const r=await f.history.handle(historyReq);
 assert.equal(r.status,200,JSON.stringify(r));
 assert.deepEqual(r.body.readMarkers,markers);
 assert.deepEqual(r.body.page.messages,page.messages);
 assert.equal(r.body.page.nextCursor,null);
 assert.equal(r.body.page.ownerId,driver);
 assert.equal(r.body.page.counterpartRole,'passenger');
 assert.ok(!JSON.stringify(r.body.page).includes('beforeSeq'));
 assert.equal(r.body.readMarkers.some(m=>m.messageId===own),false);
 assert.deepEqual(f.calls.at(-1),['sql',{
  operation:'DRIVER_HISTORY_ORDERED_MARKERS',
  ticket:id(9011),expectedRevision:null,beforeSeq:null,limit:100
 }]);
});
test('G57B exact verified Driver JWT and scoped one-use ticket are mandatory before acknowledging a message',async()=>{
 const f=fx();const r=await f.read.handle(readReq);
 assert.equal(r.status,200);
 assert.deepEqual(r.body,ack);
 assert.deepEqual(f.calls[0],['mint',{
  operation:'DRIVER_MARK_VISIBLE',actorId:driver,
  sessionId:session,tokenIatMs:at-1000,conversationId:conversation
 }]);
 assert.deepEqual(f.calls[1],['sql',{
  operation:'DRIVER_MARK_VISIBLE_ORDERED',ticket:id(9012),marker:id(901)
 }]);
});
test('G57B does not issue receipt when incoming marker missing, repeated, forged or expired',async()=>{
 for(const set of [
  [markers[0]],[],[markers[0],markers[0]],
  [markers[0],{...markers[1],messageId:own}],
  [markers[0],{...markers[1],marker:'bad'}],
  [markers[0],{...markers[1],expiresAtMs:at-10}],
  [markers[0],{...markers[1],expiresAtMs:at+70000}],
  [markers[0],{...markers[1],leakedSeq:99}]
 ]){
  const f=fx({executeScopedTicket:async()=>({data:{
   page,readMarkers:set,qaOnly:true,productionEnabled:false}})});
  assert.equal((await f.history.handle(historyReq)).status,503);
 }
});
test('G57B SQL rejects skipped first Passenger, replay, old Driver and revoked G42 grant',async()=>{
 for(const [code,status] of [
  ['G5718',409],['G5719',409],['G5715',409],
  ['G5714',409],['G5711',401],['G5713',403],
  ['G5003',403],['G5601',401],['G5712',400]
 ]){
  const f=fx({executeScopedTicket:async()=>({error:{code}})});
  assert.equal((await f.read.handle(readReq)).status,status,code);
 }
 const later=fx({executeScopedTicket:async()=>({error:{code:'G5718'}})});
 assert.equal((await later.read.handle(readReq)).body.code,
  'EARLIER_UNREAD_PASSENGER_MESSAGE');
});
test('G57B never trusts forged ACK, raw seq, wrong messageId or foreign conversation',async()=>{
 for(const data of [
  {...ack,messageId:second},{...ack,conversationId:other},
  {...ack,readThrough:999},{...ack,qaOnly:false},
  {...ack,readConfirmed:false},{...ack,phone:'private'}
 ]){
  const r=await fx({executeScopedTicket:async()=>({data})}).read.handle(readReq);
  assert.equal(r.status,503,JSON.stringify(data));
 }
});
test('G57B JSON cannot forge actor, session, role, throughSeq, or visibility permission',async()=>{
 const f=fx();
 for(const bad of [
  {...readReq,actorId:driver},{...readReq,sessionId:session},
  {...readReq,role:'driver'},{...readReq,throughSeq:9000},
  {...readReq,bearer:'bad'}, {...readReq,messageId:'bad'},
  {...readReq,marker:'bad'}, {...readReq,conversationId:'bad'},
  {...readReq,visible:true}
 ]){
  assert.equal((await f.read.handle(bad)).status,400);
 }
 assert.equal(f.calls.length,0);
 for(const [patch,status] of [
  [{verifyAccessToken:async()=>{throw Error('bad jwt')}},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{resolveExclusiveRole:async()=> 'passenger'},403],
  [{resolveExclusiveRole:async()=> ['driver','passenger']},403],
  [{allowRequest:()=>false},429],
  [{mintOwnerTicket:async()=>{throw Error('unavailable')}},503],
  [{executeScopedTicket:async()=>{throw Error('unavailable')}},503]
 ]){
  assert.equal((await fx(patch).read.handle(readReq)).status,status);
 }
});
test('G57B refuses LIVE or missing independent authorities',()=>{
 for(const patch of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},
  {mintOwnerTicket:null},{executeScopedTicket:null}
 ]){
  assert.throws(()=>createG57BDriverMarkVisibleOrderedQa({...fx().conf,...patch}));
 }
});
