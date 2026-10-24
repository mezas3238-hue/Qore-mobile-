import test from 'node:test';
import assert from 'node:assert/strict';
import {createG56BDriverPrivateInboxQa} from './g56b-driver-private-inbox-qa.mjs';
const id=n=>'56561300-0000-4656-8656-'+String(n).padStart(12,'0');
const driver=id(2),other=id(3),session=id(102),sid=id(500);
const at=Date.parse('2026-10-24T09:45:00Z');
const bearer='verified-driver-session-jwt-from-trusted-g56b';
const actor={id:driver,sessionId:session,tokenIatMs:at-1000,
 expiresAtMs:at+120000,is_anonymous:false};
const req={bearer,cursor:null,limit:2};
const rows=[1,2].map((n)=>({
 conversationId:id(300+n),serviceKind:'RIDE',serviceId:id(200+n),
 counterpartRole:'passenger',state:'ACTIVE',
 assignmentVerified:true,canSend:true,revision:3,updatedAt:at-5000-n,
 unreadCount:n
}));
const page={ownerId:driver,revision:15,generatedAt:at,expiresAt:at+60000,
 items:rows,hasMore:true,nextPosition:{
 updatedAt:rows[1].updatedAt,conversationId:rows[1].conversationId
 },productionEnabled:false,qaOnly:true};
function fx(change={}){
 const calls=[];
 const opt={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  cursorSecret:Buffer.alloc(32,0x56),now:()=>at,
  verifyAccessToken:async()=>actor,verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'driver',allowRequest:()=>true,
  mintOwnerTicket:async args=>{
   calls.push(['mint',args]);
   return {ticket:id(901),operation:'DRIVER_INBOX',
    expiresAtMs:at+20000,productionEnabled:false,qaOnly:true};
  },
  executeScopedTicket:async args=>{
   calls.push(['sql',args]);
   return {data:page};
  },...change};
 return {api:createG56BDriverPrivateInboxQa(opt),calls,opt};
}
test('G56B Driver-only inbox issues a JWT-scoped one-use capability and HMAC cursor',async()=>{
 const f=fx();
 const result=await f.api.handle(req);
 assert.equal(result.status,200,JSON.stringify(result));
 assert.deepEqual(result.body.items,rows);
 assert.equal(result.body.nextPosition,undefined);
 assert.equal(result.body.productionEnabled,false);
 assert.equal(typeof result.body.nextCursor,'string');
 assert.equal(result.body.nextCursor.includes(driver),false);
 assert.deepEqual(f.calls[0],['mint',{
  operation:'DRIVER_INBOX',actorId:driver,sessionId:session,tokenIatMs:at-1000
 }]);
 assert.deepEqual(f.calls[1],['sql',{
  operation:'DRIVER_INBOX',ticket:id(901),expectedRevision:null,
  beforeMs:null,beforeId:null,limit:2
 }]);
 const second=await f.api.handle({...req,cursor:result.body.nextCursor});
 assert.equal(second.status,503,'DB repeating prior rows must be rejected');
 const proper=fx({executeScopedTicket:async a=>({
  data:{...page,items:[{...rows[1],conversationId:id(300),updatedAt:at-9000}],
   hasMore:false,nextPosition:null}
 })});
 const next=await proper.api.handle({...req,cursor:result.body.nextCursor});
 assert.equal(next.status,200,JSON.stringify(next));
 assert.equal(next.body.nextCursor,null);
});
test('G56B HMAC cursor cannot be replayed by another account/session or tampered',async()=>{
 const first=(await fx().api.handle(req)).body.nextCursor;
 const altered=first.slice(0,-1)+(first.at(-1)==='A'?'B':'A');
 for(const cursor of [altered,'not-signed',first.slice(0,13),first+'more'])
  assert.equal((await fx().api.handle({...req,cursor})).status,409);
 for(const auth of [
  {...actor,id:other},{...actor,sessionId:other},
  {...actor,tokenIatMs:at-2000}
 ])assert.equal((await fx({verifyAccessToken:async()=>auth})
  .api.handle({...req,cursor:first})).status,409);
 assert.equal((await fx({now:()=>at+61000}).api.handle({
  ...req,cursor:first})).status,409);
});
test('G56B malformed input and forged actor never touch SQL',async()=>{
 const f=fx();
 for(const bad of [
  {...req,actorId:driver},{...req,role:'driver'},
  {...req,sessionId:session},{...req,limit:0},
  {...req,limit:101},{...req,limit:1.2},
  {...req,cursor:22},{...req,bearer:'small'},
  {...req,throughSeq:123}
 ]){
  assert.equal((await f.api.handle(bad)).status,400);
 }
 assert.equal(f.calls.length,0);
});
test('G56B rejects corrupt SQL inbox metadata, privacy leaks and bad pagination',async()=>{
 for(const malformed of [
  {...page,ownerId:other},{...page,productionEnabled:true},
  {...page,qaOnly:false},{...page,revision:0},
  {...page,expiresAt:at-1},{...page,pii:'secret'},
  {...page,items:[{...rows[0],passengerPhone:'+595'}]},
  {...page,items:[{...rows[0],counterpartRole:'driver'}]},
  {...page,items:[{...rows[0],serviceKind:'MOTO_RIDE'}]},
  {...page,items:[{...rows[0],unreadCount:-1}]},
  {...page,items:[rows[1],rows[0]]},
  {...page,items:[rows[0],rows[0]]},
  {...page,hasMore:true,nextPosition:null},
  {...page,hasMore:false,nextPosition:page.nextPosition},
  {...page,items:[{...rows[0],updatedAt:at+1}]}
 ]){
  const f=fx({executeScopedTicket:async()=>({data:malformed})});
  assert.equal((await f.api.handle(req)).status,503,JSON.stringify(malformed).slice(0,150));
 }
});
test('G56B JWT, G42 revocation, exclusive role, ticket, limiter and SQL fail closed',async()=>{
 for(const [changed,status] of [
  [{verifyAccessToken:async()=>{throw Error('forged JWT')}},401],
  [{verifyAccessToken:async()=>({...actor,id:'invalid'})},401],
  [{verifyAccessToken:async()=>({...actor,expiresAtMs:at})},401],
  [{verifyAccessToken:async()=>({...actor,is_anonymous:true})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('offline')}},503],
  [{resolveExclusiveRole:async()=> 'passenger'},403],
  [{resolveExclusiveRole:async()=> ['driver','passenger']},403],
  [{allowRequest:()=>false},429],
  [{mintOwnerTicket:async()=>{throw Error('offline')}},503],
  [{mintOwnerTicket:async()=>({ticket:id(901),operation:'CHAT_INBOX',
   expiresAtMs:at+5000,productionEnabled:false,qaOnly:true})},503],
  [{executeScopedTicket:async()=>{throw Error('offline')}},503],
  [{executeScopedTicket:async()=>({error:{code:'G5611'}})},401],
  [{executeScopedTicket:async()=>({error:{code:'G5613'}})},403],
  [{executeScopedTicket:async()=>({error:{code:'G5615'}})},409],
  [{executeScopedTicket:async()=>({error:{code:'G5619'}})},409],
  [{executeScopedTicket:async()=>({error:{code:'G5612'}})},400]
 ]){
  assert.equal((await fx(changed).api.handle(req)).status,status,JSON.stringify(changed));
 }
});
test('G56B does not enable LIVE or weak secrets or missing server authorities',()=>{
 for(const change of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {cursorSecret:Buffer.alloc(10)}, {verifyAccessToken:null},
  {verifySessionNotRevoked:null},{resolveExclusiveRole:null},
  {allowRequest:null},{mintOwnerTicket:null},{executeScopedTicket:null}
 ])assert.throws(()=>fx(change));
});
