import test from 'node:test';
import assert from 'node:assert/strict';
import {createG58FQaTicketExchange} from './g58f-qa-ticket-exchange.mjs';

const uid=n=>'58580000-0000-4858-8858-'+String(n).padStart(12,'0');
const epoch=Date.parse('2026-10-24T13:00:00Z');
const verified={actorId:uid(1),sessionId:uid(2),tokenIatMs:epoch-30000,
 role:'driver',providerPinVerified:true,sessionActive:true};
const jwt='not-a-real-jwt-qa-mock-only';
const allowed={environment:'isolated_staging',localQaOnly:true,productionEnabled:false};
const ticket=operation=>({ticket:uid(50),operation,expiresAtMs:epoch+12000,
 productionEnabled:false,qaOnly:true});
function make(overrides={}){
 const calls=[];
 const config={...allowed,now:()=>epoch,
  verifyPinnedSession:async token=>{calls.push(['verified',token]);return {...verified};},
  seedOwnerAttestation:async payload=>{
   calls.push(['seed',payload]);return {attestation:uid(40)};
  },
  exchangeInTransaction:async proof=>{
   calls.push(['exchange',proof]);return ticket(calls.find(x=>x[0]==='seed')[1].operation);
  },...overrides};
 return {bridge:createG58FQaTicketExchange(config),calls};
}
test('G58F passes only provider-resolved identity into private SQL owner fixture',async()=>{
 const m=make();
 const scoped={operation:'DRIVER_INBOX'};
 const result=await m.bridge.mintForServerVerifiedJwt({jwt,scope:scoped});
 assert.deepEqual(result,ticket('DRIVER_INBOX'));
 assert.equal(Object.isFrozen(result),true);
 assert.equal(m.calls.length,3);
 assert.deepEqual(m.calls.map(x=>x[0]),['verified','seed','exchange']);
 assert.deepEqual(m.calls[1][1],{
  actorId:uid(1),sessionId:uid(2),tokenIatMs:epoch-30000,
  operation:'DRIVER_INBOX'
 });
 assert.equal(Object.isFrozen(m.calls[1][1]),true);
});
test('G58F passenger role and server-scoped open/read/inbox remain separate from Driver',async()=>{
 const passenger={...verified,role:'passenger'};
 for(const scope of [
  {operation:'CHAT_OPEN',serviceKind:'RIDE',serviceId:uid(3),conversationId:null},
  {operation:'CHAT_HISTORY',serviceKind:'RIDE',serviceId:uid(3),conversationId:uid(4)},
  {operation:'CHAT_INBOX'},
  {operation:'CHAT_READ',conversationId:uid(4)}
 ]){
  const m=make({verifyPinnedSession:async()=>passenger});
  assert.equal((await m.bridge.mintForServerVerifiedJwt({jwt,scope})).operation,scope.operation);
 }
 const other=make();
 await assert.rejects(()=>other.bridge.mintForServerVerifiedJwt({
  jwt,scope:{operation:'CHAT_INBOX'}}),/UNTRUSTED_PROVIDER/);
 assert.equal(other.calls.filter(x=>x[0]==='seed').length,0);
});
test('G58F rejects self-declared actor, role, iat, unknown scope and malformed resource before calling provider',async()=>{
 const m=make();
 const invalid=[
  {operation:'DRIVER_INBOX',actorId:uid(9)},
  {operation:'DRIVER_INBOX',role:'driver'},
  {operation:'DRIVER_INBOX',tokenIatMs:1},
  {operation:'DRIVER_INBOX',sessionId:uid(9)},
  {operation:'DRIVER_INBOX',sql:'SELECT *'},
  {operation:'ADMIN_MINT'},
  {operation:'DRIVER_HISTORY',serviceKind:'RIDE',serviceId:uid(3),conversationId:null},
  {operation:'DRIVER_HISTORY',serviceKind:'BOAT',serviceId:uid(3),conversationId:uid(4)},
  {operation:'DRIVER_MARK_VISIBLE',conversationId:'bad'},
  {operation:'CHAT_OPEN',serviceKind:'RIDE',serviceId:uid(3),conversationId:uid(4)}
 ];
 for(const scope of invalid)await assert.rejects(
  ()=>m.bridge.mintForServerVerifiedJwt({jwt,scope}));
 assert.deepEqual(m.calls,[]);
});
test('G58F insists on a pinned, unrevoked and exclusive independently verified session',async()=>{
 for(const bad of [
  {providerPinVerified:false},{sessionActive:false},
  {role:'admin'},{role:['driver','passenger']},
  {tokenIatMs:epoch+1000},{actorId:uid(3),role:'passenger'},
  {sessionId:'bad'},{tokenIatMs:0},{role:'driver',userId:uid(2)}
 ]){
  const m=make({verifyPinnedSession:async()=>({...verified,...bad})});
  await assert.rejects(()=>m.bridge.mintForServerVerifiedJwt({
   jwt,scope:{operation:'DRIVER_INBOX'}}));
  assert.equal(m.calls.length,0);
 }
});
test('G58F invalid QA owner proof or SQL response is never accepted',async()=>{
 for(const overrides of [
  {seedOwnerAttestation:async()=>({attestation:'bad'})},
  {seedOwnerAttestation:async()=>({attestation:uid(40),userId:uid(8)})},
  {exchangeInTransaction:async()=>({...ticket('DRIVER_INBOX'),productionEnabled:true})},
  {exchangeInTransaction:async()=>({...ticket('DRIVER_INBOX'),qaOnly:false})},
  {exchangeInTransaction:async()=>({...ticket('DRIVER_INBOX'),expiresAtMs:epoch+30000})},
  {exchangeInTransaction:async()=>({...ticket('CHAT_INBOX')})},
  {exchangeInTransaction:async()=>({...ticket('DRIVER_INBOX'),jwt})}
 ]){
  const m=make(overrides);
  await assert.rejects(()=>m.bridge.mintForServerVerifiedJwt({
   jwt,scope:{operation:'DRIVER_INBOX'}}));
 }
});
test('G58F cannot be enabled in production, nor without independent verifier and SQL exchange',()=>{
 for(const bad of [
  {environment:'production'},{productionEnabled:true},{localQaOnly:false},
  {verifyPinnedSession:null},{seedOwnerAttestation:null},
  {exchangeInTransaction:null},{now:null}
 ]){
  assert.throws(()=>createG58FQaTicketExchange({...allowed,
   verifyPinnedSession:async()=>verified,
   seedOwnerAttestation:async()=>({attestation:uid(40)}),
   exchangeInTransaction:async()=>ticket('DRIVER_INBOX'),...bad}));
 }
});
