import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverMessagingController,DRIVER_MESSAGING_LIVE_ENABLED}
 from './driver-messaging.mjs';
const id=n=>'60600000-0000-4060-8060-'+String(n).padStart(12,'0');
const user=id(1),other=id(2),service=id(100),conversation=id(101);
const m1=id(201),m2=id(202),key=id(301),marker=id(401);
const bearer='verified-driver-token-in-private-closure-000001';
const at=Date.parse('2026-10-24T16:00:00Z');
const session={role:'driver',userId:user,accessToken:bearer};
const inboxRow={conversationId:conversation,serviceId:service,serviceKind:'RIDE',
 counterpartRole:'passenger',state:'ACTIVE',assignmentVerified:true,canSend:true,
 revision:3,unreadCount:1,updatedAt:at-2000};
const inboxPage=()=>({ownerId:user,revision:3,generatedAt:at,expiresAt:at+60000,
 items:[inboxRow],nextCursor:null,productionEnabled:false,qaOnly:true});
const message=(id,senderRole,revision,body)=>({messageId:id,senderRole,body,
 revision,createdAt:at-1000});
const readPage=(messages=[
 message(m2,'driver',3,'Estoy llegando'),
 message(m1,'passenger',2,'Estoy en la entrada')
],nextCursor=null)=>({
 status:200,body:{page:{
 conversationId:conversation,serviceId:service,serviceKind:'RIDE',
 ownerId:user,counterpartRole:'passenger',assignmentVerified:true,state:'ACTIVE',
 revision:3,generatedAt:at,expiresAt:at+60000,messages,nextCursor,
 canSend:true,productionEnabled:false,qaOnly:true},
 readMarkers:messages.filter(m=>m.senderRole==='passenger').map(m=>({
  marker,messageId:m.messageId,expiresAtMs:at+30000})),
 qaOnly:true,productionEnabled:false
}});
const ack={conversationId:conversation,serviceId:service,requestKey:key,
 messageId:id(601),senderRole:'driver',body:'Estoy a una cuadra',
 createdAt:at-500,revision:4,serverStored:true};
const recovery={state:'COMMITTED',ack,latestRevision:6,
 historyRefreshRequired:true,qaOnly:true,productionEnabled:false,retrySafe:false};
function setup(overrides={}){
 const calls={inbox:[],history:[],send:[],reconcile:[],mark:[],safety:0,ids:0};
 const options={now:()=>at,liveEnabled:false,
 readInbox:async req=>{calls.inbox.push(req);return {status:200,body:inboxPage()};},
 readHistory:async req=>{calls.history.push(req);return readPage();},
 send:async req=>{calls.send.push(req);return {status:200,body:ack};},
 reconcile:async req=>{calls.reconcile.push(req);return {status:200,body:recovery};},
 markVisible:async req=>{calls.mark.push(req);return {status:200,body:{
  conversationId:conversation,messageId:req.messageId,readConfirmed:true,qaOnly:true}};},
 makeRequestKey:async()=>{calls.ids++;return key;},
 verifyStopped:async()=>{calls.safety++;return {
  vehicleStopped:true,source:'trusted_navigation',observedAtMs:at-1000};},
 ...overrides};
 const ctl=createDriverMessagingController(options);
 return {ctl,calls};
}
async function connected(ctl){
 ctl.setSession(session);
 assert.equal((await ctl.refreshInbox()).phase,'inbox');
 assert.equal((await ctl.open(conversation)).phase,'connected');
}
test('G60A no default LIVE or shared Client data, no auth tokens in snapshots',async()=>{
 assert.equal(DRIVER_MESSAGING_LIVE_ENABLED,false);
 const {ctl,calls}=setup();
 assert.equal(ctl.current().phase,'signed-out');
 await connected(ctl);
 assert.equal(ctl.current().messages.length,2);
 assert.equal(ctl.current().messages[1].canConfirmRead,true);
 assert.equal(calls.send.length,0);
 assert.equal(calls.mark.length,0); // GET is NOT read confirmation
 const snapshot=JSON.stringify(ctl.current());
 for(const secret of [bearer,user,marker,key])assert.equal(snapshot.includes(secret),false);
 assert.equal(Object.isFrozen(ctl.current()),true);
 assert.equal(Object.isFrozen(ctl.current().messages),true);
});
test('G60A explicit visible event confirms only genuine Passenger message after interaction',async()=>{
 const {ctl,calls}=setup();
 await connected(ctl);
 await ctl.confirmVisible(m2);
 assert.equal(calls.mark.length,0); // own Driver message cannot be marked
 await ctl.confirmVisible(m1);
 assert.equal(calls.mark.length,1);
 assert.deepEqual(calls.mark[0],{bearer,conversationId:conversation,
  messageId:m1,marker});
 assert.deepEqual(ctl.current().readConfirmedIds,[m1]);
 await ctl.confirmVisible(m1);
 assert.equal(calls.mark.length,1);
});
test('G60A user-initiated SEND requires authoritative stopped-vehicle verification',async()=>{
 const f=setup();
 await connected(f.ctl);
 const done=await f.ctl.sendMessage(ack.body);
 assert.equal(done.phase,'connected');
 assert.equal(done.sendState,'confirmed');
 assert.equal(done.lastConfirmedId,ack.messageId);
 assert.equal(f.calls.send.length,1);
 assert.deepEqual(f.calls.send[0],{bearer,conversationId:conversation,
  serviceId:service,serviceKind:'RIDE',requestKey:key,body:ack.body});
 assert(!JSON.stringify(done).includes(bearer));
 const cases=[
  {vehicleStopped:false,source:'trusted_navigation',observedAtMs:at},
  {vehicleStopped:true,source:'user_toggle',observedAtMs:at},
  {vehicleStopped:true,source:'trusted_navigation',observedAtMs:at-7000},
  {vehicleStopped:true,source:'trusted_navigation',observedAtMs:at+100}
 ];
 for(const state of cases){
  const g=setup({verifyStopped:async()=>state});
  await connected(g.ctl);
  const r=await g.ctl.sendMessage(ack.body);
  assert.equal(r.sendState,'blocked');
  assert.equal(g.calls.send.length,0);
 }
});
test('G60A uncertain SEND never replays, recover original G59B receipt only',async()=>{
 const f=setup({send:async req=>{f.calls.send.push(req);
  throw Error('timeout AFTER PostgreSQL COMMIT');}});
 await connected(f.ctl);
 const u=await f.ctl.sendMessage(ack.body);
 assert.equal(u.phase,'uncertain');
 assert.equal(u.sendState,'uncertain');
 await f.ctl.sendMessage(ack.body);
 assert.equal(f.calls.send.length,1);
 assert.equal(f.calls.ids,1);
 const result=await f.ctl.reconcilePending();
 assert.equal(result.sendState,'confirmed');
 assert.equal(result.lastConfirmedId,ack.messageId);
 assert.equal(result.latestRevision,6);
 assert.equal(f.calls.reconcile.length,1);
 assert.equal(f.calls.reconcile[0].requestKey,key);
 assert.equal(f.calls.reconcile[0].body,ack.body);
});
test('G60A UNKNOWN/404/forged recovery responses do not unlock duplicate send',async()=>{
 for(const response of [
  {status:503,body:{code:'OUTCOME_UNKNOWN_RECONCILE_AGAIN'}},
  {status:409,body:{code:'ASSIGNMENT_CHANGED'}},
  {status:200,body:{...recovery,ack:{...ack,body:'tampered'}}},
  {status:200,body:{...recovery,retrySafe:true}},
  {status:200,body:{...recovery,latestRevision:3}},
  {status:200,body:{...recovery,historyRefreshRequired:false}}
 ]){
  const f=setup({send:async()=>({status:503,body:{code:'UNKNOWN'}}),
   reconcile:async()=>response});
  await connected(f.ctl);
  await f.ctl.sendMessage(ack.body);
  assert.equal(f.ctl.current().phase,'uncertain');
  assert.equal((await f.ctl.reconcilePending()).phase,'uncertain');
  assert.equal(f.calls.ids,1);
 }
});
test('G60A invalid Driver sessions, poisoned history or mismatched thread fail closed',async()=>{
 for(const wrong of [
  {...session,userId:'bad'},
  {...session,role:'passenger'},
  {...session,accessToken:'bad'}
 ]){
  const f=setup();
  assert.equal(f.ctl.setSession(wrong).phase,'authorization-required');
  assert.equal(f.calls.inbox.length,0);
 }
 for(const altered of [
  {page:{...readPage().body.page,ownerId:other}},
  {page:{...readPage().body.page,productionEnabled:true}},
  {page:{...readPage().body.page,messages:[{...message(m1,'passenger',2,'Hola'),phone:'123'}]}},
  {page:{...readPage().body.page,messages:[message(m1,'passenger',2,'hola'),message(m2,'driver',3,'adios')]}},
  {page:{...readPage().body.page,conversationId:other}},
  {readMarkers:[{marker:'bad',messageId:m1,expiresAtMs:at+30000}]},
  {readMarkers:[]}
 ]){
  const f=setup({readHistory:async()=>{
   const baseline=readPage();
   return {status:200,body:{...baseline.body,...altered}};
  }});
  f.ctl.setSession(session);
  await f.ctl.refreshInbox();
  assert.equal((await f.ctl.open(conversation)).phase,'offline',JSON.stringify(altered));
  assert.equal(f.ctl.current().messages.length,0);
 }
});
test('G60A logout while history or SEND outstanding never resurrects prior actor data',async()=>{
 let release;
 const wait=new Promise(resolve=>{release=resolve;});
 const f=setup({readHistory:async()=>wait});
 f.ctl.setSession(session);
 await f.ctl.refreshInbox();
 const flight=f.ctl.open(conversation);
 f.ctl.clear();
 release(readPage());
 await flight;
 assert.equal(f.ctl.current().phase,'signed-out');
 assert.deepEqual(f.ctl.current().messages,[]);
 assert.equal(JSON.stringify(f.ctl.current()).includes(bearer),false);
});
test('G60A missing adapters and LIVE always fail initialization',()=>{
 assert.throws(()=>createDriverMessagingController());
 for(const bad of [{liveEnabled:true},{readInbox:null},{send:null},
  {reconcile:null},{markVisible:null},{makeRequestKey:null},
  {verifyStopped:null},{now:null}]){
  assert.throws(()=>setup(bad));
 }
});
