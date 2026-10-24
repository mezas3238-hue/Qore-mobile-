import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverStagingRuntime,DRIVER_STAGING_RUNTIME_LIVE_ENABLED}
 from './driver-staging-runtime.mjs';
import {createDriverWorkspaceController}
 from './driver-workspace.mjs';
import {createDriverMessagingController}
 from './driver-messaging.mjs';
import {createDriverOfferActionsController}
 from './driver-offer-actions.mjs';
const id=n=>'62620000-0000-4262-8262-'+String(n).padStart(12,'0');
const driver=id(1),second=id(2),service=id(3),conversation=id(4),
 offer=id(5),incoming=id(6),sent=id(7),readProof=id(8),requestKey=id(9);
const now=Date.parse('2026-10-24T17:00:00Z');
const token='provider-verified-driver-token-000000000000000';
const url='https://api-staging.movetefacil.example';
function fixture(){
 const calls=[],grants=new Map([[driver,true],[second,true]]);
 let actor=driver,active=true,notify,network=true,lostAck=false;
 let lostOfferAck=false;
 const auth={
  async getSession(){return {error:null,data:{session:active?{
   user:{id:actor},access_token:token,
   expires_at:Math.floor(now/1000)+600}:null}};},
  async getUser(){return {error:null,data:{user:{
   id:actor,is_anonymous:false,
   email_confirmed_at:'2026-10-20T00:00:00Z'
  }}};},
  onAuthStateChange(fn){notify=fn;return {data:{
   subscription:{unsubscribe(){notify=null;}}}};}
 };
 const sendAck={conversationId:conversation,serviceId:service,
  requestKey,messageId:sent,senderRole:'driver',
  body:'Estoy llegando',createdAt:now-1000,revision:4,serverStored:true};
 const reply=(status,body)=>({
  status,
  headers:{get:key=>({'content-type':'application/json',
   'cache-control':'private, no-store'})[key]??null},
  text:async()=>JSON.stringify(body),
  json:async()=>body
 });
 const request=async(u,options)=>{
  calls.push({url:u,authorization:options.headers.authorization,
   method:options.method,body:options.body??null});
  if(!network)throw Error('network unavailable');
  if(u===url+'/v1/staging/driver/inbox')return reply(200,{
   mode:'STAGING_DEMO_ONLY',liveTripsEnabled:false,
   liveDeliveriesEnabled:false,pushDelivered:false,
   deviceReceived:false,suggestedPollIntervalMs:5000,
   offers:[{kind:'AUTO_RIDE',offerId:offer,serviceId:service,
    expiresAtMs:now+30000}]});
  if(u===url+'/v1/staging/driver/documents')return reply(200,{
   mode:'STAGING_DEMO_ONLY',liveOperationsEnabled:false,
   documents:[{kind:'licencia',status:'approved',
    submittedAtMs:now-30000,reviewedAtMs:now-10000}]});
  if(u===url+'/v1/staging/driver/license-readiness')return reply(200,{
   mode:'STAGING_DEMO_ONLY',currentLicenseApproved:true,
   driverEligible:false,liveOperationsEnabled:false,
   verificationScope:'CURRENT_LICENSE_REVIEW_ONLY'});
  if(u===url+'/v1/staging/driver/offers/accept'){
   if(lostOfferAck)throw Error('Decision response lost after COMMIT');
   return reply(200,{mode:'STAGING_DEMO_ONLY',
    commercialRidesEnabled:false,outcome:'accepted',
    eventId:sent,pushDelivered:false});
  }
  if(u===url+'/v1/staging/driver/offers/decline')
   return reply(200,{mode:'STAGING_DEMO_ONLY',
    commercialRidesEnabled:false,outcome:'declined',
    offerId:offer,pushDelivered:false});
  if(u===url+'/v1/staging/driver/chat/conversations?limit=50')
   return reply(200,{
    ownerId:actor,revision:3,generatedAt:now,
    expiresAt:now+45000,items:[{
     conversationId:conversation,serviceId:service,serviceKind:'RIDE',
     counterpartRole:'passenger',state:'ACTIVE',
     assignmentVerified:true,canSend:true,revision:3,
     unreadCount:1,updatedAt:now-1000}],
    nextCursor:null,productionEnabled:false,qaOnly:true});
  if(u===url+'/v1/staging/driver/chat/services/RIDE/'+service+
     '/conversations/'+conversation+'/history-with-ordered-markers?limit=50')
   return reply(200,{page:{
    conversationId:conversation,serviceId:service,serviceKind:'RIDE',
    ownerId:actor,counterpartRole:'passenger',
    assignmentVerified:true,state:'ACTIVE',revision:3,
    generatedAt:now,expiresAt:now+45000,
    messages:[{messageId:incoming,senderRole:'passenger',
     body:'Estoy esperando',createdAt:now-1000,revision:2}],
    nextCursor:null,canSend:true,productionEnabled:false,qaOnly:true},
    readMarkers:[{marker:readProof,messageId:incoming,expiresAtMs:now+30000}],
    qaOnly:true,productionEnabled:false});
  if(u===url+'/v1/staging/driver/chat/services/RIDE/'+service+
    '/conversations/'+conversation+'/send'){
   if(lostAck)throw Error('Connection lost after SQL COMMIT');
   return reply(200,sendAck);
  }
  if(u===url+'/v1/staging/driver/chat/services/RIDE/'+service+
    '/conversations/'+conversation+'/reconcile')
   return reply(200,{state:'COMMITTED',ack:sendAck,
    latestRevision:4,historyRefreshRequired:false,
    qaOnly:true,productionEnabled:false,retrySafe:false});
  if(u===url+'/v1/staging/driver/chat/conversations/'+conversation+
   '/mark-visible-ordered')return reply(200,{
    conversationId:conversation,messageId:incoming,
    readConfirmed:true,qaOnly:true});
  throw Error('Unlisted Driver API route: '+u);
 };
 const options={
  apiOrigin:url,approvedStagingHost:'api-staging.movetefacil.example',
  auth,verifyExclusiveDriverRole:async({userId})=>grants.get(userId)===true,
  request,makeRequestKey:()=>requestKey,
  verifyStopped:async()=>({
   vehicleStopped:true,source:'trusted_navigation',observedAtMs:now-100}),
  allowedByOwner:true,liveEnabled:false,now:()=>now
 };
 const runtime=createDriverStagingRuntime(options);
 const workspace=createDriverWorkspaceController({
  authAdapter:runtime.authAdapter,apiOrigin:runtime.apiOrigin,
  approvedStagingHost:runtime.approvedStagingHost,
  allowedByOwner:true,now:()=>now,
  ...runtime.workspaceReaders
 });
 const messenger=createDriverMessagingController({...runtime.chatAdapters,
  now:()=>now});
 return {runtime,workspace,messenger,calls,grants,
  loseAck:()=>{lostAck=true;},
  loseOfferAck:()=>{lostOfferAck=true;},
  outage:()=>{network=false;},
  logout:()=>{active=false;notify?.();},
  switchAccount:()=>{actor=second;grants.set(second,false);notify?.();}
 };
}
test('G62 Driver HTTPS runtime uses same verified Auth for offers, documents and messages',async()=>{
 const f=fixture();
 assert.equal(DRIVER_STAGING_RUNTIME_LIVE_ENABLED,false);
 assert.equal(f.runtime.productionEnabled,false);
 assert.equal(f.runtime.qaOnly,true);
 const ws=await f.workspace.refresh();
 assert.equal(ws.phase,'connected');
 assert.equal(ws.offers.length,1);
 assert.equal(ws.documents.length,1);
 assert.equal(ws.currentLicenseApproved,true);
 assert.equal(ws.driverEligible,false);
 const identity=await f.runtime.authAdapter.getSession();
 assert.equal(identity.role,'driver');
 f.messenger.setSession(identity);
 assert.equal((await f.messenger.refreshInbox()).phase,'inbox');
 assert.equal((await f.messenger.open(conversation)).phase,'connected');
 assert.equal(f.messenger.current().messages.length,1);
 assert.equal(f.messenger.current().messages[0].body,'Estoy esperando');
 assert(f.calls.every(c=>c.url.startsWith(url+'/v1/staging/driver/')));
 assert(f.calls.every(c=>c.authorization==='Bearer '+token));
 for(const value of [JSON.stringify(ws),JSON.stringify(f.messenger.current())]){
  assert(!value.includes(token));
  assert(!value.includes(driver));
  assert(!value.includes(readProof));
 }
});
test('G62 full Driver HTTPS action flow: SEND timeout then G59B reconcile, no duplicate POST',async()=>{
 const f=fixture();
 const identity=await f.runtime.authAdapter.getSession();
 f.messenger.setSession(identity);
 await f.messenger.refreshInbox();
 await f.messenger.open(conversation);
 f.loseAck();
 const send=await f.messenger.sendMessage('Estoy llegando');
 assert.equal(send.phase,'uncertain');
 assert.equal(send.sendState,'uncertain');
 await f.messenger.sendMessage('Estoy llegando');
 assert.equal(f.calls.filter(x=>x.url.endsWith('/send')).length,1);
 const recovered=await f.messenger.reconcilePending();
 assert.equal(recovered.sendState,'confirmed');
 assert.equal(recovered.lastConfirmedId,sent);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/reconcile')).length,1);
 await f.messenger.confirmVisible(incoming);
 assert.equal(f.messenger.current().readConfirmedIds.length,1);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/mark-visible-ordered')).length,1);
});
test('G62 network outage destroys KYC/offers snapshots and denies invented history',async()=>{
 const f=fixture();
 assert.equal((await f.workspace.refresh()).phase,'connected');
 const identity=await f.runtime.authAdapter.getSession();
 f.messenger.setSession(identity);
 await f.messenger.refreshInbox();
 f.outage();
 assert.equal((await f.workspace.refresh()).phase,'offline');
 assert.equal(f.workspace.current().offers.length,0);
 assert.equal(f.workspace.current().documents.length,0);
 assert.equal((await f.messenger.refreshInbox()).phase,'offline');
 assert.equal(f.messenger.current().conversations.length,0);
});
test('G62 SDK logout and swapped unauthorized actor fail closed in both controllers',async()=>{
 const f=fixture();
 await f.workspace.refresh();
 let identity=await f.runtime.authAdapter.getSession();
 f.messenger.setSession(identity);
 await f.messenger.refreshInbox();
 f.workspace.invalidate();
 f.messenger.clear();
 f.logout();
 assert.equal((await f.workspace.refresh()).phase,'signed-out');
 assert.equal((await f.runtime.authAdapter.getSession()),null);
 assert.equal(f.messenger.current().phase,'signed-out');
 assert.deepEqual(f.workspace.current().offers,[]);
 // New account cannot resurrect old Driver grants or messages.
 const g=fixture();
 await g.workspace.refresh();
 g.messenger.setSession(await g.runtime.authAdapter.getSession());
 await g.messenger.refreshInbox();
 g.workspace.invalidate();g.messenger.clear();
 g.switchAccount();
 await assert.rejects(()=>g.runtime.authAdapter.getSession());
 assert.notEqual((await g.workspace.refresh()).phase,'connected');
 assert.equal(g.messenger.current().conversations.length,0);
});
test('G62 requires complete explicitly authorized STAGING configuration; no defaults',()=>{
 assert.throws(()=>createDriverStagingRuntime());
 const f=fixture();
 assert.equal(f.runtime.apiOrigin,url);
 for(const changes of [
  {allowedByOwner:false},{liveEnabled:true},
  {apiOrigin:'http://api-staging.movetefacil.example'},
  {apiOrigin:'https://evil-staging.example'},
  {approvedStagingHost:'api.production.example'},
  {request:null},{auth:null},{makeRequestKey:null},
  {verifyExclusiveDriverRole:null},{verifyStopped:null}
 ]){
  const sdk={
   getSession:async()=>({data:{session:null},error:null}),
   getUser:async()=>({data:{user:null},error:null}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
  };
  const base={apiOrigin:url,
   approvedStagingHost:'api-staging.movetefacil.example',auth:sdk,
   verifyExclusiveDriverRole:async()=>true,
   request:async()=>{throw Error('no network')},
   makeRequestKey:()=>requestKey,
   verifyStopped:async()=>({vehicleStopped:true,
    source:'trusted_navigation',observedAtMs:now}),
   now:()=>now,allowedByOwner:true,liveEnabled:false};
  assert.throws(()=>createDriverStagingRuntime({...base,...changes}));
 }
});

test('G63 Driver accepted private HTTPS offer only from same verified runtime',async()=>{
 const f=fixture();
 const ws=await f.workspace.refresh();
 const verified=await f.runtime.authAdapter.getSession();
 const actions=createDriverOfferActionsController(f.runtime.offerActions);
 actions.setSession(verified);
 actions.setOffers(ws.offers,{currentLicenseApproved:ws.currentLicenseApproved});
 const result=await actions.decide({offerId:offer,action:'accept'});
 assert.equal(result.decisions.length,1);
 assert.equal(result.decisions[0].phase,'confirmed');
 assert.equal(result.offers.length,0);
 const posts=f.calls.filter(x=>x.url.endsWith('/offers/accept'));
 assert.equal(posts.length,1);
 assert.equal(posts[0].url,url+'/v1/staging/driver/offers/accept');
 assert.equal(posts[0].authorization,'Bearer '+token);
 assert.equal(posts[0].method,'POST');
 assert.deepEqual(JSON.parse(posts[0].body),{offerId:offer,requestKey});
 assert(!JSON.stringify(result).includes(token));
 assert(!JSON.stringify(result).includes(driver));
});
test('G63 lost Driver accept acknowledgment stays uncertain and never auto-posts twice',async()=>{
 const f=fixture();const ws=await f.workspace.refresh();
 const actions=createDriverOfferActionsController(f.runtime.offerActions);
 actions.setSession(await f.runtime.authAdapter.getSession());
 actions.setOffers(ws.offers,{currentLicenseApproved:true});
 f.loseOfferAck();
 const result=await actions.decide({offerId:offer,action:'accept'});
 assert.equal(result.decisions[0].phase,'uncertain');
 await actions.decide({offerId:offer,action:'accept'});
 await actions.decide({offerId:offer,action:'decline'});
 assert.equal(f.calls.filter(x=>x.url.endsWith('/offers/accept')).length,1);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/offers/decline')).length,0);
 actions.clear();
 assert.equal(actions.current().decisions.length,0);
});
test('G63 Driver offer decision remains unavailable without real approved runtime',()=>{
 assert.equal(fixture().runtime.offerActions.liveEnabled,false);
 const controller=createDriverOfferActionsController(fixture().runtime.offerActions);
 assert.equal(controller.current().phase,'signed-out');
 assert.equal(controller.current().productionEnabled,false);
});
