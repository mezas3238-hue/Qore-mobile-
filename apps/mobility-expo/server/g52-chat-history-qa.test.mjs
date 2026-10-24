import test from 'node:test';
import assert from 'node:assert/strict';
import {createG52ChatHistoryQa} from './g52-chat-history-qa.mjs';
const id=n=>'52520000-0000-4252-8252-'+String(n).padStart(12,'0');
const passenger=id(1),other=id(2),session=id(101),serviceId=id(200),conversationId=id(300);
const bearer='g52-provider-verified-test-access-token-not-a-real-jwt';
const now=Date.parse('2026-10-23T22:00:00Z');
const identity={id:passenger,sessionId:session,tokenIatMs:now-1000,expiresAtMs:now+240000,is_anonymous:false};
const open={conversationId,serviceKind:'RIDE',serviceId,serverStored:true,qaOnly:true};
const message=(n)=>({messageId:id(500+n),senderRole:n%2?'passenger':'driver',
 body:'Mensaje '+n,createdAt:now-1000-n,revision:202-n});
const first={conversationId,serviceId,serviceKind:'RIDE',ownerId:passenger,
 counterpartRole:'driver',assignmentVerified:true,state:'ACTIVE',
 revision:202,generatedAt:now,expiresAt:now+60000,
 messages:[message(0),message(1)],hasMore:true,
 nextPosition:{beforeSeq:78},canSend:true,productionEnabled:false,qaOnly:true};
const input={bearer,serviceKind:'RIDE',serviceId,cursor:null,limit:2,expectedConversationId:null};
function fixture(options={}){
 const calls=[];
 const spec={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  cursorSecret:Buffer.alloc(32,18),now:()=>now,verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,resolveExclusiveRole:async()=> 'passenger',
  allowRequest:()=>true,
  rpc:async(name,args)=>{calls.push({name,args});return {data:name.includes('_open_')?open:first};},
  ...options
 };
 return {api:createG52ChatHistoryQa(spec),calls};
}
test('G52 sealed B history newest-first, opens assigned persisted thread, HMAC cursor',async()=>{
 const f=fixture(),r=await f.api.handle(input);
 assert.equal(r.status,200,JSON.stringify(r));
 assert.deepEqual(Object.keys(r.body),['conversationId','serviceId','serviceKind','ownerId',
  'counterpartRole','assignmentVerified','state','revision','generatedAt',
  'expiresAt','messages','nextCursor','canSend','productionEnabled']);
 assert.match(r.body.nextCursor,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 assert.equal(r.body.messages.length,2);
 assert.equal(f.calls.length,2);
 assert.equal(f.calls[0].name,'mobility_stage_g50_open_owner_qa');
 assert.equal(f.calls[1].name,'mobility_stage_g52_history_owner_qa');
 assert.equal(f.calls[1].args._actor,passenger);
 assert.equal(f.calls[1].args._session,session);
 assert.equal(f.calls[1].args._conversation,conversationId);
});
test('G52 second page never re-opens and keeps thread pinned; final page cursor null',async()=>{
 const page=await fixture().api.handle(input),next=page.body.nextCursor;
 const f=fixture({rpc:async(name,args)=>({data:{
  ...first,messages:[message(2)],hasMore:false,nextPosition:null
 }})});
 const r=await f.api.handle({...input,cursor:next,expectedConversationId:conversationId});
 assert.equal(r.status,200,JSON.stringify(r));
 assert.equal(r.body.nextCursor,null);
 assert.equal(f.calls.length,0); // custom RPC, no incidental open happens
});
test('G52 forbids forged cursors, account/session switches, stale and rotated threads',async()=>{
 const page=await fixture().api.handle(input),token=page.body.nextCursor;
 const cases=[
  [fixture(),{...input,cursor:token.slice(0,-2)+'xx'},400],
  [fixture({verifyAccessToken:async()=>({...identity,id:other})}),{...input,cursor:token},400],
  [fixture({verifyAccessToken:async()=>({...identity,sessionId:id(102)})}),{...input,cursor:token},400],
  [fixture({cursorSecret:Buffer.alloc(32,17)}),{...input,cursor:token},400],
  [fixture({now:()=>now+61000}),{...input,cursor:token},400],
  [fixture(),{...input,cursor:token,serviceId:id(201)},400],
  [fixture(),{...input,cursor:token,expectedConversationId:id(301)},409],
  [fixture({rpc:async(name)=>({data:name.includes('_open_')?{...open,conversationId:id(444)}:first})}),
   {...input,expectedConversationId:conversationId},409]
 ];
 for(const [f,request,code] of cases)
  assert.equal((await f.api.handle(request)).status,code);
});
test('G52 rejects provider expiry, role swap, revocation, limiter outage and database failures',async()=>{
 for(const [changes,status] of [
  [{verifyAccessToken:async()=>{throw Error('JWT signature')}},401],
  [{verifyAccessToken:async()=>({...identity,expiresAtMs:now})},401],
  [{verifyAccessToken:async()=>({...identity,sessionId:'invalid'})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('offline')}},503],
  [{resolveExclusiveRole:async()=> 'driver'},403],
  [{resolveExclusiveRole:async()=> ['passenger','driver']},403],
  [{resolveExclusiveRole:async()=>{throw Error('offline')}},503],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('redis offline')}},503],
  [{rpc:async()=>{throw Error('DB offline')}},503]
 ])assert.equal((await fixture(changes).api.handle(input)).status,status);
 for(const [sql,status] of [['G5001',401],['G5003',403],['G5004',409],
  ['G5203',403],['G5204',409],['G5209',409],['XX999',503]]){
  const f=fixture({rpc:async name=>({data:name.includes('_open_')?open:null,
   error:name.includes('_open_')?undefined:{code:sql}})});
  assert.equal((await f.api.handle(input)).status,status);
 }
});
test('G52 refuses page role, content PII, ordering, lifetime totals and extra fields',async()=>{
 const variations=[
  {...first,ownerId:other},{...first,qaOnly:false},
  {...first,productionEnabled:true},{...first,assignmentVerified:false},
  {...first,state:'CLOSED'},
  {...first,messages:[message(1),message(0)]},
  {...first,messages:[message(0),message(0)]},
  {...first,messages:[{...message(0),body:'http://example.com'},message(1)]},
  {...first,messages:[{...message(0),body:'0981 123 456'},message(1)]},
  {...first,messages:[{...message(0),attachment:'file'},message(1)]},
  {...first,messages:[{...message(0),senderRole:'admin'},message(1)]},
  {...first,messages:[{...message(0),revision:203},message(1)]},
  {...first,messages:[...first.messages],hasMore:true,nextPosition:{beforeSeq:0}},
  {...first,messages:[...first.messages],hasMore:true,nextPosition:null}
 ];
 for(const data of variations){
  const f=fixture({rpc:async name=>({data:name.includes('_open_')?open:data})});
  const r=await f.api.handle(input);
  assert.equal(r.status,503,JSON.stringify(data).slice(0,150));
 }
 const f=fixture();
 for(const req of [
  {...input,actorId:passenger},{...input,role:'admin'},
  {...input,expectedConversationId:'not-a-uuid'},
  {...input,limit:101},{...input,limit:0},{...input,limit:1.5},
  {...input,serviceKind:'MOTO_RIDE'},
  {...input,cursor:'1'},
  {...input,bearer:'short'}
 ])assert.equal((await f.api.handle(req)).status,400);
 assert.equal(f.calls.length,0);
});
test('G52 cannot be enabled for production or without trusted actor and HMAC secret',()=>{
 for(const invalid of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {cursorSecret:Buffer.alloc(16)},{cursorSecret:'insecure'},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},{rpc:null}
 ])assert.throws(()=>fixture(invalid));
});
