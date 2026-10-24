import test from 'node:test';
import assert from 'node:assert/strict';
import {createG53PassengerChatSendQa} from './g53-passenger-chat-send-qa.mjs';
const uuid=n=>'53530000-0000-4353-8353-'+String(n).padStart(12,'0');
const p=uuid(1),driver=uuid(2),sid=uuid(101),service=uuid(200),conv=uuid(300),key=uuid(401),message=uuid(501);
const at=Date.parse('2026-10-23T23:30:00Z');
const jwt='g53-private-passenger-verified-jwt-only-qa-0000000';
const identity={id:p,sessionId:sid,tokenIatMs:at-15000,expiresAtMs:at+60000,is_anonymous:false};
const req={bearer:jwt,serviceKind:'RIDE',serviceId:service,conversationId:conv,
 requestKey:key,body:'Estoy en la entrada'};
const ack={conversationId:conv,serviceId:service,requestKey:key,messageId:message,
 senderRole:'passenger',body:req.body,createdAt:at-500,revision:3,serverStored:true};
function fx(changes={}){
 const calls=[];
 const opts={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  verifyAccessToken:async()=>identity,verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'passenger',allowRequest:()=>true,now:()=>at,
  rpc:async(name,args)=>{calls.push({name,args});return {data:ack};},
  ...changes};
 return {gw:createG53PassengerChatSendQa(opts),calls};
}
test('G53 sends exact SQL args from JWT; durable ACK is B sealed schema',async()=>{
 const f=fx();const r=await f.gw.handle(req);
 assert.equal(r.status,200,JSON.stringify(r));assert.deepEqual(r.body,ack);
 assert.deepEqual(f.calls,[{name:'mobility_stage_g53_passenger_send_owner_qa',
  args:{_kind:'RIDE',_service:service,_conversation:conv,_actor:p,
   _session:sid,_iat:at-15000,_request:key,_body:req.body}}]);
});
test('G53 refuses forged actor/session/role, PII, URLs, HTML and invalid requestKey before SQL',async()=>{
 const f=fx();
 for(const invalid of [
  {...req,actorId:p},{...req,subject:p},{...req,role:'passenger'},
  {...req,senderRole:'passenger'},{...req,sessionId:sid},
  {...req,body:''},{...req,body:' '},{...req,body:' hola'},
  {...req,body:'hola '},{...req,body:'<b>hola</b>'},
  {...req,body:'visita https://example.com'},
  {...req,body:'correo@example.com'},
  {...req,body:'tel 0981 123 456'},
  {...req,body:'hola'+String.fromCharCode(0x200e)+'final'},
  {...req,body:'hola'+String.fromCharCode(0x202e)+'final'},
  {...req,body:'x'.repeat(501)},
  {...req,requestKey:'not-uuid'},{...req,serviceKind:'MOTO_RIDE'},
  {...req,serviceId:'INVALID'},{...req,conversationId:'INVALID'},
  {...req,bearer:'bad'}
 ]){
  const r=await f.gw.handle(invalid);
  assert.equal(r.status,400,JSON.stringify(invalid).slice(0,200));
 }
 assert.equal(f.calls.length,0);
});
test('G53 untrusted ACK is never a success, even if status claims serverStored',async()=>{
 for(const poisoned of [
  {...ack,serverStored:false},{...ack,body:'sustituido'},
  {...ack,serviceId:uuid(888)},{...ack,conversationId:uuid(889)},
  {...ack,requestKey:uuid(890)},{...ack,senderRole:'driver'},
  {...ack,createdAt:at+10},{...ack,createdAt:-1},
  {...ack,revision:1},{...ack,revision:2.5},
  {...ack,messageId:'bad'},{...ack,objectKey:'secreto'},
  {...ack,body:'mailto@example.com'}
 ]){
  const f=fx({rpc:async()=>({data:poisoned})});
  assert.equal((await f.gw.handle(req)).status,503,JSON.stringify(poisoned).slice(0,120));
 }
});
test('G53 JWT, revocation, exclusive role, limiter, SQL return and expiration fail closed',async()=>{
 for(const [changes,status] of [
  [{verifyAccessToken:async()=>{throw Error('bad signature')}},401],
  [{verifyAccessToken:async()=>({...identity,id:'bad'})},401],
  [{verifyAccessToken:async()=>({...identity,expiresAtMs:at})},401],
  [{verifyAccessToken:async()=>({...identity,is_anonymous:true})},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('provider offline')}},503],
  [{resolveExclusiveRole:async()=> 'driver'},403],
  [{resolveExclusiveRole:async()=> ['passenger','driver']},403],
  [{resolveExclusiveRole:async()=>{throw Error('role outage')}},503],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('limiter outage')}},503],
  [{rpc:async()=>{throw Error('db offline')}},503],
  [{now:(()=>{let n=0;return ()=>n++===0?at:at+61000;})()},401]
 ]){
  const f=fx(changes);
  assert.equal((await f.gw.handle(req)).status,status);
  assert.equal(f.calls.length,status===401&&changes.now?1:0);
 }
 for(const [code,status] of [
  ['G5001',401],['G5002',400],['G5003',403],
  ['G5004',409],['G5009',409],['G5302',400],
  ['G5303',403],['G5304',409],['G5305',503],['XX001',503]
 ]){
  const f=fx({rpc:async()=>({error:{code}})});
  assert.equal((await f.gw.handle(req)).status,status);
 }
});
test('G53 construction is permanently non-LIVE with all authorities required',()=>{
 for(const bad of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},{rpc:null}
 ])assert.throws(()=>fx(bad));
});
