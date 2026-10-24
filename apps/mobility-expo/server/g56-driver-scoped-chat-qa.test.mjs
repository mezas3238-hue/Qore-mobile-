import test from 'node:test';
import assert from 'node:assert/strict';
import {createG56DriverScopedChatQa} from './g56-driver-scoped-chat-qa.mjs';
const uuid=n=>'56560000-0000-4656-8656-'+String(n).padStart(12,'0');
const driver=uuid(2),other=uuid(3),session=uuid(102),
 service=uuid(200),thread=uuid(300),key=uuid(401),message=uuid(501);
const at=Date.parse('2026-10-24T07:00:00Z');
const bearer='driver-signed-provider-jwt-verified-isolated-g56';
const who={id:driver,sessionId:session,tokenIatMs:at-2000,
 expiresAtMs:at+120000,is_anonymous:false};
const openReq={bearer,serviceKind:'RIDE',serviceId:service};
const sendReq={...openReq,conversationId:thread,requestKey:key,body:'Voy llegando'};
const historyReq={...openReq,conversationId:thread,cursor:null,limit:2};
const opened={conversationId:thread,serviceKind:'RIDE',serviceId:service,
 serverStored:true,qaOnly:true};
const ack={conversationId:thread,serviceId:service,requestKey:key,messageId:message,
 senderRole:'driver',body:sendReq.body,createdAt:at-1000,revision:3,serverStored:true};
const msg={messageId:message,senderRole:'driver',body:'Voy llegando',
 createdAt:at-1000,revision:3};
const page={conversationId:thread,serviceId:service,serviceKind:'RIDE',
 ownerId:driver,counterpartRole:'passenger',assignmentVerified:true,
 state:'ACTIVE',revision:3,generatedAt:at,expiresAt:at+60000,
 messages:[msg],hasMore:true,nextPosition:{beforeSeq:4},
 canSend:true,productionEnabled:false,qaOnly:true};
function fixture(overrides={}){
 const calls=[];
 const opts={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  cursorSecret:Buffer.alloc(32,56),now:()=>at,
  verifyAccessToken:async()=>who,verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'driver',allowRequest:()=>true,
  mintOwnerTicket:async args=>{
   calls.push({type:'mint',args});
   return {ticket:uuid(901),operation:args.operation,
    expiresAtMs:at+15000,productionEnabled:false,qaOnly:true};
  },
  executeScopedTicket:async args=>{
   calls.push({type:'delegate',args});
   return {data:args.operation==='DRIVER_OPEN'?opened:
    args.operation==='DRIVER_SEND'?ack:page};
  },...overrides};
 return {api:createG56DriverScopedChatQa(opts),calls,opts};
}
test('G56 Driver OPEN requires pinned JWT and delegated one-use role, no actor from SDK',async()=>{
 const f=fixture();const r=await f.api.open(openReq);
 assert.deepEqual(r,{status:200,body:opened});
 assert.deepEqual(f.calls[0],{type:'mint',args:{
  operation:'DRIVER_OPEN',actorId:driver,sessionId:session,
  tokenIatMs:at-2000,serviceKind:'RIDE',serviceId:service,conversationId:null}});
 assert.deepEqual(f.calls[1],{type:'delegate',args:{operation:'DRIVER_OPEN',ticket:uuid(901)}});
});
test('G56 Driver send accepts durable SQL ACK only, exact role and requestKey',async()=>{
 const f=fixture();const r=await f.api.send(sendReq);
 assert.deepEqual(r,{status:200,body:ack});
 assert.equal(f.calls.length,2);
 assert.deepEqual(f.calls[1],{type:'delegate',args:{
  operation:'DRIVER_SEND',ticket:uuid(901),requestKey:key,body:sendReq.body}});
 for(const bad of [
  {...ack,serverStored:false},{...ack,body:'cambiado'},
  {...ack,senderRole:'passenger'},{...ack,requestKey:uuid(999)},
  {...ack,revision:0},{...ack,createdAt:at+50},
  {...ack,pii:'filtracion'},{...ack,messageId:'bad'}
 ]){
  assert.equal((await fixture({executeScopedTicket:async()=>({data:bad})})
   .api.send(sendReq)).status,503);
 }
});
test('G56 signed keyset cursor binds actor, session, thread and revision, never publishes SQL seq',async()=>{
 const f=fixture();
 const first=await f.api.history(historyReq);
 assert.equal(first.status,200,JSON.stringify(first));
 assert.equal(first.body.ownerId,driver);
 assert.equal(first.body.counterpartRole,'passenger');
 assert.equal(first.body.nextPosition,undefined);
 assert.equal(first.body.messages[0].seq,undefined);
 assert.equal(typeof first.body.nextCursor,'string');
 assert.equal(f.calls[1].args.beforeSeq,null);
 const second=await f.api.history({...historyReq,cursor:first.body.nextCursor});
 assert.equal(second.status,200);
 assert.deepEqual(f.calls[3].args,{
  operation:'DRIVER_HISTORY',ticket:uuid(901),
  expectedRevision:3,beforeSeq:4,limit:2
 });
 const forged=first.body.nextCursor.slice(0,-1)+'A';
 assert.equal((await f.api.history({...historyReq,cursor:forged})).status,409);
 assert.equal((await f.api.history({...historyReq,conversationId:other,
  cursor:first.body.nextCursor})).status,409);
 assert.equal((await f.api.history({...historyReq,serviceId:other,
  cursor:first.body.nextCursor})).status,409);
 const otherUser=fixture({verifyAccessToken:async()=>({...who,id:other})});
 assert.equal((await otherUser.api.history({...historyReq,cursor:first.body.nextCursor})).status,409);
});
test('G56 stale revision, poisoned page and SQL revoked/assignment errors fail closed',async()=>{
 for(const bad of [
  {...page,ownerId:other},{...page,counterpartRole:'driver'},
  {...page,assignmentVerified:false},{...page,state:'CLOSED'},
  {...page,productionEnabled:true},{...page,revision:-1},
  {...page,messages:[{...msg,senderRole:'admin'}]},
  {...page,messages:[{...msg,seq:5}]},
  {...page,messages:[{...msg,body:'email abc@example.com'}]},
  {...page,hasMore:true,nextPosition:null},{...page,secret:'oops'}
 ]){
  assert.equal((await fixture({executeScopedTicket:async()=>({data:bad})})
   .api.history(historyReq)).status,503);
 }
 for(const [code,status] of [
  ['G5601',401],['G5603',403],['G5604',403],
  ['G5605',409],['G5609',409],['G5009',409],
  ['G5602',400],['unavailable',503]
 ]){
  const f=fixture({executeScopedTicket:async()=>({error:{code}})});
  assert.equal((await f.api.history(historyReq)).status,status);
 }
});
test('G56 invalid body/forged identity and unsafe page arguments cannot reach delegated SQL',async()=>{
 const f=fixture();
 for(const bad of [
  {...openReq,actorId:driver},{...openReq,role:'driver'},
  {...openReq,bearer:'bad'},{...openReq,serviceKind:'MOTO_RIDE'},
  {...openReq,serviceId:'x'}
 ])assert.equal((await f.api.open(bad)).status,400);
 for(const bad of [
  {...sendReq,senderId:driver},{...sendReq,sessionId:session},
  {...sendReq,body:''},{...sendReq,body:' hola'},
  {...sendReq,body:'0961 123456'},{...sendReq,body:'https://demo.com'},
  {...sendReq,body:'<script>'},{...sendReq,body:'abc@example.org'},
  {...sendReq,body:'x'.repeat(501)},{...sendReq,requestKey:'bad'}
 ])assert.equal((await f.api.send(bad)).status,400);
 for(const bad of [
  {...historyReq,beforeSeq:99},{...historyReq,limit:101},
  {...historyReq,limit:0},{...historyReq,cursor:1234},
  {...historyReq,conversationId:'bad'}
 ])assert.equal((await f.api.history(bad)).status,400);
 assert.equal(f.calls.length,0);
});
test('G56 bad JWT, revoked or crossed role, limiter and expired identity fail closed',async()=>{
 for(const [over,status] of [
  [{verifyAccessToken:async()=>{throw Error('signature')}},401],
  [{verifyAccessToken:async()=>({...who,id:'bad'})},401],
  [{verifyAccessToken:async()=>({...who,expiresAtMs:at})},401],
  [{verifyAccessToken:async()=>({...who,is_anonymous:true})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('remote down')}},503],
  [{resolveExclusiveRole:async()=> 'passenger'},403],
  [{resolveExclusiveRole:async()=> ['driver','passenger']},403],
  [{allowRequest:()=>false},429],
  [{mintOwnerTicket:async()=>{throw Error('not trusted')}},503],
  [{mintOwnerTicket:async()=>({ticket:uuid(901),operation:'DRIVER_SEND',
    expiresAtMs:at+15000,qaOnly:true,productionEnabled:false})},503],
  [{executeScopedTicket:async()=>{throw Error('offline')}},503],
  [{now:(()=>{let n=0;return ()=>++n===1?at:at+121000;})()},503]
 ]){
  const f=fixture(over);
  assert.equal((await f.api.open(openReq)).status,status);
 }
});
test('G56 constructor refuses LIVE, owner-only shortcuts, missing trusted controls and weak HMAC',()=>{
 for(const bad of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {cursorSecret:Buffer.alloc(5)},{verifyAccessToken:null},
  {verifySessionNotRevoked:null},{resolveExclusiveRole:null},
  {allowRequest:null},{mintOwnerTicket:null},{executeScopedTicket:null}
 ])assert.throws(()=>fixture(bad));
});
