import test from 'node:test';
import assert from 'node:assert/strict';
import {createPassengerChatStagingComposition,assertApprovedPassengerStagingOrigin,
 PASSENGER_CHAT_PRODUCTION_ENABLED} from './passenger-chat-staging-composition.mjs';
const time=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const validSession=()=>({role:'passenger',subject:id(1),
 token:'synthetic-jwt-token-1234567890-staging-qa',expiresAt:time+90000});
const base=()=>({
 ownerApprovedStaging:true,identityContractCertified:true,
 chatContractsCertified:true,httpsStagingRuntimeVerified:true,
 liveEnabled:false,apiOrigin:'https://qa.staging.example.invalid',
 approvedStagingHost:'qa.staging.example.invalid',
 now:()=>time,timeoutMs:4500,
 authProvider:{readSession:async()=>validSession(),signOut:async()=>({ok:true})},
 verifyExclusivePassengerRole:async()=>true,
 fetchImpl:async()=>{throw Error('No actual STAGING endpoint deployed');}
});
test('R55 default is OFF: no bearer, no chat and no remote network',async()=>{
 let calls=0;
 const x=createPassengerChatStagingComposition({
  fetchImpl:async()=>{calls++;throw Error('unexpected');},
  authProvider:{readSession:async()=>validSession()}
 });
 assert.equal(PASSENGER_CHAT_PRODUCTION_ENABLED,false);
 assert.equal(x.ready,false);assert.equal(x.productionEnabled,false);
 assert.equal(x.experience.snapshot().chat.contractReady,false);
 assert.equal(x.experience.snapshot().chatInbox.readReady,false);
 assert.equal((await x.experience.refreshSession()).ok,false);
 assert.equal(calls,0);
});
test('R55 a missing independent gate never enables network even with others true',async()=>{
 let calls=0;
 for(const key of ['ownerApprovedStaging','identityContractCertified',
  'chatContractsCertified','httpsStagingRuntimeVerified']){
  const x=createPassengerChatStagingComposition({...base(),[key]:false,
   fetchImpl:async()=>{calls++}});
  assert.equal(x.ready,false);
  assert.equal(x.experience.snapshot().chat.sendReady,false);
 }
 assert.equal(calls,0);
});
test('R55 refuses production override even when other staging evidence is true',()=>{
 const x=createPassengerChatStagingComposition({...base(),liveEnabled:true});
 assert.equal(x.ready,false);
 assert.equal(x.productionEnabled,false);
});
test('R55 origin pin rejects HTTP, production, localhost, IP, ports and userinfo',()=>{
 const origin='https://qa.staging.example.invalid';
 assert.equal(assertApprovedPassengerStagingOrigin({
  apiOrigin:origin,approvedStagingHost:'qa.staging.example.invalid'
 }),origin);
 for(const apiOrigin of [
  'http://qa.staging.example.invalid','https://production.example.com',
  origin+'/v1',origin+'?token=anything',origin+'#fragment',
  'https://user@qa.staging.example.invalid',
  'https://qa.staging.example.invalid:9443',
  'https://qa.staging.example.invalid\\@evil.example.invalid',
  'http://localhost','https://127.0.0.1'
 ]){
  assert.throws(()=>assertApprovedPassengerStagingOrigin({
   apiOrigin,approvedStagingHost:'qa.staging.example.invalid'
  }));
 }
 for(const approvedStagingHost of ['localhost','127.0.0.1',
  'api.production.example.com','STAGING.EXAMPLE.COM','fake..staging.com']){
  assert.throws(()=>assertApprovedPassengerStagingOrigin({
   apiOrigin:origin,approvedStagingHost
  }));
 }
});
test('R55 requires complete certified identity transport adapter',()=>{
 for(const fields of [
  {authProvider:null},{authProvider:{readSession:async()=>validSession()}},
  {verifyExclusivePassengerRole:null},{fetchImpl:null},
  {now:'bad'},{timeoutMs:100},{timeoutMs:60000}
 ])assert.throws(()=>createPassengerChatStagingComposition({...base(),...fields}));
});
test('R55 independently verified Passenger session exposes chat read/send gates',async()=>{
 let verified=0,hits=0;
 const x=createPassengerChatStagingComposition({...base(),
  verifyExclusivePassengerRole:async x=>{verified++;
   return x.subject===id(1)&&x.token===validSession().token;},
  fetchImpl:async()=>{hits++;throw Error('no real endpoint');}
 });
 assert.equal(x.ready,true);
 assert.equal(x.mode,'STAGING_QA_ONLY');
 assert.equal(x.productionEnabled,false);
 assert.equal((await x.experience.refreshSession()).ok,true);
 const s=x.experience.snapshot();
 assert.equal(s.authenticated,true);
 assert.equal(s.chat.contractReady,true);
 assert.equal(s.chat.sendReady,true);
 assert.equal(s.chatInbox.readReady,true);
 assert.equal(verified,1);
 assert.equal(hits,0); // composition and authorization do not call network
});
test('R55 exclusive-role verifier rejects unverified forged Passenger data',async()=>{
 for(const verifyExclusivePassengerRole of [
  async()=>false,async()=>null,async()=>({role:'passenger'})
 ]){
  const x=createPassengerChatStagingComposition({...base(),verifyExclusivePassengerRole});
  assert.equal((await x.experience.refreshSession()).ok,false);
  assert.equal(x.experience.snapshot().authenticated,false);
 }
});
test('R55 Driver/Admin/expired tokens denied before independent verifier',async()=>{
 let checks=0;
 for(const invalid of [
  {...validSession(),role:'driver'}, {...validSession(),role:'admin'},
  {...validSession(),subject:'not-uuid'}, {...validSession(),expiresAt:time-1000},
  {...validSession(),token:'bad\nAuthorization:evil'}
 ]){
  const x=createPassengerChatStagingComposition({...base(),
   authProvider:{readSession:async()=>invalid,signOut:async()=>({ok:true})},
   verifyExclusivePassengerRole:async()=>{checks++;return true;}
  });
  assert.equal((await x.experience.refreshSession()).ok,false);
 }
 assert.equal(checks,0);
});
test('R55 logout clears private account and never marks delivery',async()=>{
 const x=createPassengerChatStagingComposition(base());
 await x.experience.refreshSession();
 const done=await x.experience.signOut();
 assert.equal(done.ok,true);
 assert.equal(x.experience.snapshot().authenticated,false);
 assert.equal(x.experience.snapshot().chat.pendingSend,false);
 assert.equal(x.experience.snapshot().chat.messages.length,0);
});
test('R55 transport faults cannot invent delivery or payment',async()=>{
 let hits=0;
 const x=createPassengerChatStagingComposition({...base(),
  fetchImpl:async()=>{hits++;throw Error('Network offline');}
 });
 await x.experience.refreshSession();
 const result=await x.experience.loadChatInbox();
 assert.equal(result.ok,false);
 assert.equal(hits,1);
 assert.equal(x.experience.snapshot().chatInbox.items.length,0);
 assert.equal(x.experience.snapshot().chat.sendReady,true);
 assert.equal(x.experience.snapshot().chat.messages.length,0);
});
