import test from 'node:test';
import assert from 'node:assert/strict';
import {createG51ChatInboxQa} from './g51-chat-inbox-qa.mjs';
const id=n=>'51510000-0000-4151-8151-'+String(n).padStart(12,'0');
const passenger=id(1),driver=id(2),session=id(101);
const at=Date.parse('2026-10-23T21:00:00Z');
const bearer='g51-synthetic-verified-provider-bearer-not-an-actual-jwt';
const identity={id:passenger,sessionId:session,tokenIatMs:at-1000,
 expiresAtMs:at+360000,is_anonymous:false};
const mk=(n)=>({conversationId:id(300+n),serviceId:id(500+n),
 serviceKind:'RIDE',state:'ACTIVE',assignmentVerified:true,
 counterpartRole:'driver',revision:10+n,unreadCount:n+1,updatedAt:at-(n+1)*1000,canSend:true});
const rows=[mk(0),mk(1)],sql=(items=rows,more=true,position=rows.at(-1))=>({
 ownerId:passenger,generatedAt:at,expiresAt:at+60000,revision:200,
 items,hasMore:more,nextPosition:more?{
  updatedAt:position.updatedAt,conversationId:position.conversationId
 }:null,productionEnabled:false,qaOnly:true
});
const base={bearer,cursor:null,limit:2};
function fx(o={}){
 const calls=[];
 const cfg={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  cursorSecret:Buffer.alloc(32,9),verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,resolveExclusiveRole:async()=> 'passenger',
  allowRequest:()=>true,now:()=>at,
  rpc:async(name,params)=>{calls.push({name,params});return {data:sql()};},...o};
 return {api:createG51ChatInboxQa(cfg),calls};
}
test('G51 returns exact B R13 private inbox fields and opaque signed cursor',async()=>{
 const f=fx(),answer=await f.api.handle(base);
 assert.equal(answer.status,200);
 assert.deepEqual(Object.keys(answer.body),['ownerId','generatedAt','expiresAt','revision',
  'items','nextCursor','productionEnabled']);
 assert.equal(answer.body.productionEnabled,false);
 assert.match(answer.body.nextCursor,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 assert.equal(answer.body.items.length,2);
 assert.deepEqual(f.calls,[{name:'mobility_stage_g51_passenger_inbox_owner_qa',
  params:{_actor:passenger,_session:session,_iat:at-1000,_expected_revision:null,
   _before_ms:null,_before_id:null,_limit:2}}]);
});
test('G51 follows signed second keyset and rejects wrong actor/session, tampering or expiration',async()=>{
 const f=fx();
 const page=await f.api.handle(base),cursor=page.body.nextCursor;
 const second=fx({rpc:async(_,args)=>({data:sql([mk(2)],false)})});
 const result=await second.api.handle({...base,cursor});
 assert.equal(result.status,200,JSON.stringify(result));
 assert.equal(result.body.nextCursor,null);
 const tampered=cursor.slice(0,-1)+(cursor.at(-1)==='A'?'B':'A');
 assert.equal((await f.api.handle({...base,cursor:tampered})).status,400);
 assert.equal((await fx({verifyAccessToken:async()=>({...identity,id:driver})}).api.handle({...base,cursor})).status,400);
 assert.equal((await fx({verifyAccessToken:async()=>({...identity,sessionId:id(999)})}).api.handle({...base,cursor})).status,400);
 assert.equal((await fx({now:()=>at+61000}).api.handle({...base,cursor})).status,400);
 assert.equal((await fx({cursorSecret:Buffer.alloc(32,7)}).api.handle({...base,cursor})).status,400);
});
test('G51 rejects excessive data, owner spoofing, invalid revision and cursor rollback',async()=>{
 const poison=[
  {...sql(),ownerId:driver},
  {...sql(),productionEnabled:true},
  {...sql(),items:[rows[1],rows[0]]},
  {...sql(),items:[rows[0],rows[0]]},
  {...sql(),items:[{...rows[0],messageBody:'private'},rows[1]]},
  {...sql(),items:[{...rows[0],unreadCount:-1},rows[1]]},
  {...sql(),items:[{...rows[0],counterpartRole:'admin'},rows[1]]},
  {...sql(),items:[{...rows[0],canSend:false},rows[1]]},
  {...sql(),nextPosition:{updatedAt:at,conversationId:rows[1].conversationId}},
  {...sql(),revision:1},
  {...sql(),expiresAt:at+999999},
  {...sql(),items:Array.from({length:101},(_,n)=>mk(n))}
 ];
 for(const data of poison){
  const f=fx({rpc:async()=>({data})});
  assert.equal((await f.api.handle(base)).status,503,JSON.stringify(data).slice(0,100));
 }
 const page=await fx().api.handle(base);
 const st=fx({rpc:async()=>({data:{...sql([mk(2)],false),revision:201}})});
 assert.equal((await st.api.handle({...base,cursor:page.body.nextCursor})).status,503);
});
test('G51 rejects body spoofing, invalid cursor and page size before DB',async()=>{
 const f=fx();
 for(const x of [
  {...base,limit:0},{...base,limit:101},{...base,limit:'50'},
  {...base,role:'admin'},{...base,actorId:driver},{...base,sessionId:session},
  {...base,cursor:'unverified.cursor'},{...base,bearer:'short'}
 ])assert.equal((await f.api.handle(x)).status,400);
 assert.equal(f.calls.length,0);
});
test('G51 provider/revocation/role/limiter errors fail closed',async()=>{
 for(const [diff,status] of [
  [{verifyAccessToken:async()=>{throw Error('bad sig')}},401],
  [{verifyAccessToken:async()=>({...identity,expiresAtMs:at})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('down')}},503],
  [{resolveExclusiveRole:async()=> 'driver'},403],
  [{resolveExclusiveRole:async()=>['passenger','driver']},403],
  [{allowRequest:()=>false},429],[{allowRequest:()=>{throw Error('redis down')}},503]
 ]){
  const f=fx(diff);
  assert.equal((await f.api.handle(base)).status,status);
  assert.equal(f.calls.length,0);
 }
 for(const [code,status] of [['G5101',401],['G5103',403],['G5102',400],
  ['G5109',409],['unexpected',503]]){
  const f=fx({rpc:async()=>({error:{code}})});
  assert.equal((await f.api.handle(base)).status,status);
 }
});
test('G51 cannot be started for production, without secret or without trusted dependencies',()=>{
 for(const bad of [{environment:'production'},{localQaOnly:false},
  {liveEnabled:true},{cursorSecret:Buffer.alloc(16,0)},{cursorSecret:'shared-secret'},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{rpc:null},{allowRequest:null}])
  assert.throws(()=>fx(bad));
});
