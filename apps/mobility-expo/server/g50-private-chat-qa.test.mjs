import test from 'node:test';
import assert from 'node:assert/strict';
import {createG50PrivateChatQa} from './g50-private-chat-qa.mjs';
const uuid=n=>'50500000-0000-4050-8050-'+String(n).padStart(12,'0');
const passenger=uuid(1),driver=uuid(2),foreign=uuid(3),sessionId=uuid(101);
const serviceId=uuid(200),conversationId=uuid(300),requestKey=uuid(400),msg=uuid(500);
const at=Date.parse('2026-10-23T20:00:00Z');
const bearer='qa-provider-verifiable-private-chat-bearer-000000';
const identity={id:passenger,sessionId,tokenIatMs:at-15000,expiresAtMs:at+180000,
 is_anonymous:false};
const opened={conversationId,serviceKind:'RIDE',serviceId,serverStored:true,qaOnly:true};
const sent={conversationId,messageId:msg,seq:1,senderId:passenger,body:'Estoy en el punto',
 createdAt:'2026-10-23T20:00:00Z',serverStored:true,qaOnly:true};
const page={conversationId,messages:[{messageId:msg,seq:1,senderId:passenger,
 body:sent.body,createdAt:sent.createdAt,serverStored:true}],
 nextAfter:1,hasMore:false,qaOnly:true};
const open={bearer,operation:'OPEN',serviceKind:'RIDE',serviceId};
const send={bearer,operation:'SEND',conversationId,requestKey,body:sent.body};
const read={bearer,operation:'PAGE',conversationId,after:0,limit:50};
function fx(changes={}){
 const calls=[];
 const opts={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>at,verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,resolveExclusiveRole:async()=> 'passenger',
  allowRequest:()=>true,rpc:async(name,args)=>{calls.push({name,args});
   return {data:name.includes('_open_')?opened:name.includes('_send_')?sent:page};},
  ...changes};
 return {chat:createG50PrivateChatQa(opts),calls};
}
test('G50 never trusts client actor/role; identity is derived from verified token and passes G42 fields to SQL',async()=>{
 const f=fx();
 const out=await f.chat.handle(open);
 assert.equal(out.status,200);
 assert.deepEqual(out.body,opened);
 assert.deepEqual(f.calls,[{name:'mobility_stage_g50_open_owner_qa',
  args:{_kind:'RIDE',_service:serviceId,_actor:passenger,_session:sessionId,_iat:at-15000}}]);
 for(const extra of [{actorId:foreign},{role:'admin'},{senderId:driver},{pricePyg:20},
  {messageBody:'secret'},{sessionId:uuid(222)}]){
  assert.equal((await f.chat.handle({...open,...extra})).status,400);
 }
});
test('G50 message accepted only with storage-confirmed server receipt',async()=>{
 const f=fx();
 assert.deepEqual((await f.chat.handle(send)),{status:200,body:sent});
 assert.equal(f.calls[0].name,'mobility_stage_g50_send_owner_qa');
 assert.equal(f.calls[0].args._actor,passenger);
 assert.equal(f.calls[0].args._request,requestKey);
 for(const poisoned of [{...sent,serverStored:false},{...sent,senderId:foreign},
  {...sent,body:'edited'},{...sent,objectKey:'private/doc.png'},
  {...sent,seq:-1},{...sent,qaOnly:false},{...sent,createdAt:'invalid'}]){
  const g=fx({rpc:async()=>({data:poisoned})});
  assert.equal((await g.chat.handle(send)).status,503);
 }
});
test('G50 keyset pages are finite, strictly ascending and have no total history cap',async()=>{
 const f=fx();
 assert.deepEqual((await f.chat.handle(read)).body,page);
 assert.equal(f.calls[0].args._after,0);
 for(const invalid of [
  {...page,messages:[page.messages[0],page.messages[0]]},
  {...page,messages:[{...page.messages[0],senderId:'foreign'}]},
  {...page,nextAfter:5},{...page,qaOnly:false},
  {...page,messages:[{...page.messages[0],storageUrl:'private'}]}
 ]){
  const g=fx({rpc:async()=>({data:invalid})});
  assert.equal((await g.chat.handle(read)).status,503);
 }
 for(const after of [-1,'1',1.5,Number.MAX_SAFE_INTEGER+1]){
  assert.equal((await f.chat.handle({...read,after})).status,400);
 }
 assert.equal((await f.chat.handle({...read,limit:101})).status,400);
});
test('G50 refuses forged fields, body overflow and SQL request key abuse',async()=>{
 const f=fx();
 for(const req of [
  {...send,body:''},{...send,body:' '.repeat(10)},
  {...send,body:'hola https://example.com'},
  {...send,body:'contacto ejemplo@correo.com'},
  {...send,body:'tel 0981 123 456'},
  {...send,body:' en la entrada '},
  {...send,body:'<b>llegué</b>'},
  {...send,body:'abc'+String.fromCharCode(0x200e)+'def'},
  {...send,body:'abc'+String.fromCharCode(0x200f)+'def'},
  {...send,body:'abc'+String.fromCharCode(0x202E)+'def'},
  {...send,body:'x'.repeat(501)},{...send,requestKey:'bad'},
  {...send,actorId:passenger},{...read,actorId:driver},
  {...open,serviceKind:'SHOPPING'},{...open,serviceId:'wrong'}
 ])assert.equal((await f.chat.handle(req)).status,400,JSON.stringify(req));
 assert.equal(f.calls.length,0);
});
test('G50 forged token, revoked grant, provider offline, dual role and spam block before SQL',async()=>{
 for(const [changes,status] of [
  [{verifyAccessToken:async()=>{throw Error('jwt signature')}} ,401],
  [{verifyAccessToken:async()=>({...identity,expiresAtMs:at-1})},401],
  [{verifyAccessToken:async()=>({...identity,sessionId:'bad'})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('provider down')}},503],
  [{resolveExclusiveRole:async()=>['passenger','driver']},403],
  [{resolveExclusiveRole:async()=>{throw Error('db down')}},503],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('limiter down')}},503]
 ]){
  const f=fx(changes);
  assert.equal((await f.chat.handle(send)).status,status);
  assert.equal(f.calls.length,0);
 }
});
test('G50 deny assignment changes, stale thread, replay and SQL errors fail closed',async()=>{
 for(const [code,status] of [['G5001',401],['G5002',400],
  ['G5003',403],['G5004',409],['G5009',409],['XX001',503]]){
  const f=fx({rpc:async()=>({error:{code}})});
  assert.equal((await f.chat.handle(send)).status,status);
 }
 assert.equal((await fx({rpc:async()=>{throw Error('SQL offline')}}).chat.handle(send)).status,503);
});
test('G50 construction cannot enable LIVE or omit independent sources',()=>{
 for(const bad of [{environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {rpc:null},{verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null}]){
  assert.throws(()=>fx(bad));
 }
});
