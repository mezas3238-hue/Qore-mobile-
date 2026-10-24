import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createG49PinnedChatBridgeQa} from './g49-pinned-chat-scoped-bridge-qa.mjs';

const uuid=n=>'49490000-0000-4949-8949-'+String(n).padStart(12,'0');
const user=uuid(1),foreign=uuid(2),session=uuid(101),service=uuid(200),conv=uuid(300),key=uuid(401);
const issued=Date.parse('2026-10-23T21:30:00Z');
const issuer='https://isolated-stage.supabase.co/auth/v1';
const kp=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const publicKeys=new Map([['qa-p256',{alg:'ES256',jwk:kp.publicKey.export({format:'jwk'})}]]);
const b64=data=>Buffer.from(JSON.stringify(data)).toString('base64url');
const baseClaims={iss:issuer,aud:'authenticated',role:'authenticated',
 sub:user,session_id:session,iat:Math.floor(issued/1000)-10,
 exp:Math.floor(issued/1000)+60,is_anonymous:false};
function token(claims=baseClaims,privateKey=kp.privateKey){
 const head=b64({alg:'ES256',typ:'JWT',kid:'qa-p256'});
 const payload=b64(claims);
 const sig=sign('sha256',Buffer.from(head+'.'+payload),
  {key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return head+'.'+payload+'.'+sig;
}
const jwt=token();
const request={bearer:jwt,operation:'CHAT_SEND',serviceKind:'RIDE',
 serviceId:service,conversationId:conv,requestKey:key,
 body:'Estoy esperando',expectedRevision:null,beforeSeq:null,limit:null};
const providerUser={id:user,is_anonymous:false,email_confirmed_at:'2026-10-22T00:00:00Z'};
const providerSession={userId:user,sessionId:session,active:true,
 expiresAtMs:issued+120000,assuranceLevel:'aal1',verifiedAtMs:issued-60000};
const minted={ticket:uuid(909),operation:'CHAT_SEND',expiresAtMs:issued+10000,
 productionEnabled:false,qaOnly:true};
const ack={conversationId:conv,serviceId:service,requestKey:key,messageId:uuid(500),
 senderRole:'passenger',body:request.body,createdAt:issued-500,revision:2,
 serverStored:true};
const open={conversationId:conv,serviceKind:'RIDE',serviceId:service,
 serverStored:true,qaOnly:true};
const history={conversationId:conv,serviceId:service,serviceKind:'RIDE',
 ownerId:user,counterpartRole:'driver',assignmentVerified:true,state:'ACTIVE',
 revision:2,generatedAt:issued,expiresAt:issued+60000,messages:[{
  messageId:uuid(500),senderRole:'passenger',body:'Estoy esperando',
  createdAt:issued-500,revision:2
 }],hasMore:false,nextPosition:null,canSend:true,productionEnabled:false,qaOnly:true};
function fixture(patches={}){
 const calls=[];
 const config={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  issuer,audience:'authenticated',publicKeys,now:()=>issued,
  readProviderUser:async()=>providerUser,
  readProviderSession:async()=>providerSession,
  readPrivateSessionGrant:async()=>true,
  resolveExclusiveRole:async()=> 'passenger',allowRequest:()=>true,
  mintOwnerTicket:async params=>{calls.push({step:'mint',params});return minted;},
  executeScopedTicket:async params=>{
   calls.push({step:'delegate',params});
   return {data:params.operation==='CHAT_OPEN'?open:
    params.operation==='CHAT_HISTORY'?history:ack};
  },...patches};
 return {api:createG49PinnedChatBridgeQa(config),calls};
}
test('G49 signed ES256 JWT is pinned to provider, session and SQL grant before scoped send',async()=>{
 const f=fixture();
 const r=await f.api.handle(request);
 assert.equal(r.status,200,JSON.stringify(r));
 assert.deepEqual(r.body,ack);
 assert.deepEqual(f.calls,[{
  step:'mint',params:{actorId:user,sessionId:session,
   tokenIatMs:baseClaims.iat*1000,operation:'CHAT_SEND',
   serviceKind:'RIDE',serviceId:service,conversationId:conv}
 },{
  step:'delegate',params:{operation:'CHAT_SEND',ticket:minted.ticket,
   requestKey:key,body:request.body}
 }]);
});
test('G49 handles OPEN and HISTORY without permitting direct actor or SQL names',async()=>{
 const openReq={...request,operation:'CHAT_OPEN',conversationId:null,
  requestKey:null,body:null};
 const f=fixture({mintOwnerTicket:async args=>({...minted,operation:args.operation})});
 const o=await f.api.handle(openReq);
 assert.deepEqual(o.body,open);
 assert.equal(o.status,200);
 const histReq={...request,operation:'CHAT_HISTORY',requestKey:null,
  body:null,limit:50};
 const h=await f.api.handle(histReq);
 assert.equal(h.status,200);
 assert.deepEqual(h.body,history);
});
test('G49 rejects token for other actor, wrong provider signature, issuer, kid and role',async()=>{
 const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 for(const bad of [
  token(baseClaims,other.privateKey),
  token({...baseClaims,iss:'https://evil.supabase.co/auth/v1'}),
  token({...baseClaims,role:'service_role'}),
  token({...baseClaims,sub:foreign}),
  token({...baseClaims,session_id:uuid(102)}),
  token({...baseClaims,exp:Math.floor(issued/1000)-1}),
  jwt.slice(0,-3)+'xxx'
 ]){
  const f=fixture();
  const r=await f.api.handle({...request,bearer:bad});
  assert.equal(r.status,401,JSON.stringify(r));
  assert.equal(f.calls.length,0);
 }
});
test('G49 no provider user/session/SQL grant/MFA bypass; no mint if provider unavailable',async()=>{
 for(const change of [
  {readProviderUser:async()=>null},
  {readProviderUser:async()=>({...providerUser,is_anonymous:true})},
  {readProviderSession:async()=>({...providerSession,active:false})},
  {readProviderSession:async()=>({...providerSession,sessionId:foreign})},
  {readProviderSession:async()=>{throw Error('provider offline')}},
  {readPrivateSessionGrant:async()=>false},
  {readPrivateSessionGrant:async()=>{throw Error('SQL grant denied')}}
 ]){
  const f=fixture(change);
  assert.equal((await f.api.handle(request)).status,401);
  assert.equal(f.calls.length,0);
 }
 for(const [change,status] of [
  [{resolveExclusiveRole:async()=> 'driver'},403],
  [{resolveExclusiveRole:async()=> ['passenger','driver']},403],
  [{resolveExclusiveRole:async()=>{throw Error('role store down')}},503],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('limiter down')}},503],
  [{mintOwnerTicket:async()=>{throw Error('owner down')}},503],
  [{executeScopedTicket:async()=>{throw Error('DB down')}},503]
 ]){
  const f=fixture(change);
  assert.equal((await f.api.handle(request)).status,status);
 }
});
test('G49 scope/cursor/raw actor forgery and body PII never reach ticket mint',async()=>{
 const f=fixture();
 const variants=[
  {...request,actorId:user},{...request,sessionId:session},
  {...request,role:'passenger'},{...request,table:'auth.users'},
  {...request,operation:'OWNER_EXEC'},{...request,serviceKind:'MOTO_RIDE'},
  {...request,serviceId:foreign},{...request,conversationId:'invalid'},
  {...request,requestKey:'invalid'},{...request,body:' https://example.com '},
  {...request,body:'tel 0981 123 456'},{...request,body:'<script>x</script>'},
  {...request,body:'Hola '+String.fromCharCode(0x200e)+'fin'},
  {...request,body:'Hola '},{...request,body:'x'.repeat(501)},
  {...request,expectedRevision:1},
  {...request,operation:'CHAT_OPEN',requestKey:null,body:null},
  {...request,operation:'CHAT_HISTORY',body:null,requestKey:null,limit:100,
   expectedRevision:2,beforeSeq:null},
  {...request,operation:'CHAT_HISTORY',body:null,requestKey:null,limit:101},
  {...request,operation:'CHAT_HISTORY',body:null,requestKey:null,limit:50,
   expectedRevision:2,beforeSeq:-1}
 ];
 for(const x of variants){
  const expected=x.serviceId===foreign?503:400;
  const r=await f.api.handle(x);
  if(x.serviceId===foreign)assert.equal(r.status,503);
  else assert.equal(r.status,expected,JSON.stringify(x).slice(0,150));
 }
 // Malformed inputs above must not mint, except foreign *valid* service UUID:
 // possession of UUID alone is not authorization, so DB mint must reject.
 assert.equal(f.calls.filter(c=>c.step==='mint').length,1);
});
test('G49 rejects untrusted mint or forged DB receipts and never switches to LIVE',async()=>{
 for(const badMint of [
  {...minted,qaOnly:false},{...minted,productionEnabled:true},
  {...minted,operation:'CHAT_HISTORY'},{...minted,ticket:'forged-invalid-ticket'},
  {...minted,expiresAtMs:issued+21000},
  {...minted,expiresAtMs:issued},
  {...minted,clientRole:'admin'}
 ]){
  const f=fixture({mintOwnerTicket:async()=>badMint});
  assert.equal((await f.api.handle(request)).status,503);
 }
 for(const bad of [
  {...ack,messageId:'invalid'},{...ack,serverStored:false},
  {...ack,body:'adulterado'},{...ack,senderRole:'driver'},
  {...ack,revision:1},{...ack,actorId:user}
 ]){
  const f=fixture({executeScopedTicket:async()=>({data:bad})});
  assert.equal((await f.api.handle(request)).status,503);
 }
 for(const bad of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {issuer:'http://bad/auth/v1'},{publicKeys:new Map()},
  {readProviderSession:null},{mintOwnerTicket:null},
  {executeScopedTicket:null},{allowRequest:null}
 ])assert.throws(()=>fixture(bad));
});
test('G49 SQL G42 / role / ticket delegate failures are mapped closed',async()=>{
 for(const [code,status] of [
  ['G4901',401],['G4902',400],['G4903',403],['G4904',409],
  ['G4905',409],['G5001',401],['G5003',403],['G5004',409],
  ['G5009',409],['G5209',409],['G5305',503],['XX001',503]
 ]){
  const f=fixture({executeScopedTicket:async()=>({error:{code}})});
  assert.equal((await f.api.handle(request)).status,status);
 }
});
