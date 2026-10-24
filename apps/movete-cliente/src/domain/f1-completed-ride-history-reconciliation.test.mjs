import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const id=n=>'c1111111-1111-4111-8111-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),trip=id(3),requestKey=id(4);
const token='synthetic-f1-passenger-jwt-1234567890';
const request={requestKey,originTag:'CENTRO',destinationTag:'SHOPPING',service:'economico'};
const receipt={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,requestKey,operation:'rideRequest',
 serviceId:trip,revision:1,serverPersisted:true,status:'ACCEPTED_QA'};
const event=(status,revision)=>({
 source:'server',tripId:trip,passengerId:owner,
 serverRevision:revision,trackingSequence:revision-1,status,
 acceptedDriver:null,tracking:null
});
const searching=()=>({tripId:trip,ownerId:owner,revision:1,state:'searching',
 assignmentPersisted:false,driver:null,vehicle:null,gpsConsent:false,
 location:null,etaVerified:false,etaMinutes:null,mode:'STAGING_DEMO_ONLY',
 commercialRidesEnabled:false,event:event('searching',1),
 locationVisible:false,deliveryConfirmed:false});
const completed=()=>({...searching(),revision:5,state:'completed',
 assignmentPersisted:true,event:event('completed',5)});
const history=(patch={},itemPatch={})=>({
 ownerId:owner,generatedAt:T-100,expiresAt:T+30000,nextCursor:null,
 items:[{serviceId:trip,kind:'RIDE',status:'completed',
  createdAt:T-10000,revision:5,...itemPatch}],...patch
});
const respond=(data,status=200)=>({ok:status===200||status===201,
 status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
function fixture({historyReady=true,historyReply=async()=>respond(history()),
 bookingReply=async()=>respond(receipt,201)}={}){
 let now=T,current=searching(),readHistory=0,readStatus=0,bookingPosts=0;
 let user={subject:owner,role:'passenger',token,expiresAt:T+180000};
 const client=createClientExperience({
  now:()=>now,authProvider:{readSession:async()=>user,signOut:async()=>{}},
  bookingHttpOptions:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,qaReceiptContractCertified:true,
   origin:'https://qa.example.invalid',pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async(url,req)=>{bookingPosts++;
    assert.equal(req.method,'POST');
    assert(url.endsWith('/rider/trips/request'));
    return bookingReply();}},
  statusGatewayOptions:{enabled:true,contractCertified:true,
   origin:'https://qa.example.invalid',pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async(url,req)=>{readStatus++;
    assert.equal(req.method,'GET');
    assert(url.endsWith('/rider/trips/'+trip+'/status'));
    return respond(current);}},
  historyGatewayOptions:{enabled:historyReady,contractCertified:true,
   origin:'https://qa.example.invalid',pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async(url,req)=>{readHistory++;
    assert.equal(req.method,'GET');assert.equal(req.credentials,'omit');
    assert.equal(url,'https://qa.example.invalid/v1/staging/rider/history');
    return historyReply();}}
 });
 return {client,finish:()=>current=completed(),status:()=>current,
  setUser:v=>user=v,setTime:n=>now=n,
  reads:()=>readHistory,statusReads:()=>readStatus,posts:()=>bookingPosts};
}
async function finish(f){
 assert.equal((await f.client.refreshSession()).ok,true);
 assert.equal(f.client.prepareRide(request).ok,true);
 assert.equal((await f.client.submit()).ok,true);
 assert.equal((await f.client.continueVerifiedRide()).ok,true);
 f.finish();
 assert.equal((await f.client.syncTracking()).ok,true);
 assert.equal(f.client.snapshot().tracking.state,'completed');
}
test('F1 real Client composer: booking → completed status → private history GET → independently verified completion',async()=>{
 const f=fixture();await finish(f);
 const start=f.client.snapshot();
 assert.equal(start.completedRideHistory.readReady,true);
 assert.equal(start.completedRideHistory.verified,false);
 assert.equal(f.reads(),0);
 assert.equal((await f.client.verifyCompletedRideHistory()).ok,true);
 const shown=f.client.snapshot();
 assert.equal(shown.completedRideHistory.verified,true);
 assert.equal(shown.completedRideHistory.tripId,trip);
 assert.equal(shown.completedRideHistory.productionEnabled,false);
 assert.equal(shown.history.items[0].status,'completed');
 assert.equal(f.posts(),1,'history verification never sends another booking');
 assert.equal(f.reads(),1);
 assert.equal(JSON.stringify(shown).includes(token),false);
});
test('F1 completed tracking alone cannot claim history completion or payment',async()=>{
 const f=fixture();await finish(f);
 assert.equal(f.client.snapshot().completedRideHistory.verified,false);
 assert.equal(f.client.snapshot().quote,null);
 assert.equal(f.client.snapshot().tracking.assignedDriver,null);
 assert.equal(f.client.snapshot().tracking.position,null);
});
test('F1 forged or manually injected history cannot certify completion',async()=>{
 const f=fixture();await finish(f);
 assert.equal(f.client.acceptHistory(history()),true);
 assert.equal(f.client.snapshot().completedRideHistory.verified,false);
 assert.equal(f.reads(),0);
});
test('F1 only a fully matched RIDE completed row at equal-or-higher revision confirms history',async()=>{
 for(const [patch,item] of [
  [{}, {revision:4}],
  [{}, {status:'in_progress'}],
  [{},{kind:'DELIVERY'}],
  [{},{serviceId:id(9)}],
  [{},{status:'cancelled'}],
  [{items:[]},{}]
 ]){
  const f=fixture({historyReply:async()=>respond(history(patch,item))});
  await finish(f);
  assert.equal((await f.client.verifyCompletedRideHistory()).code,
   'COMPLETED_HISTORY_NOT_CONFIRMED',JSON.stringify([patch,item]));
  assert.equal(f.client.snapshot().completedRideHistory.verified,false);
  assert.equal(f.client.snapshot().tracking.state,'completed');
 }
});
test('F1 cross-account history, 503 and malformed DTO never assert a completed record',async()=>{
 for(const answer of [
  respond(history({ownerId:other})),{ok:false,status:503,redirected:false},
  respond({ownerId:owner,items:[{serviceId:trip,kind:'RIDE',status:'completed',
   revision:5,paymentCard:'EXPOSED'}]})
 ]){
  const f=fixture({historyReply:async()=>answer});await finish(f);
  assert.equal((await f.client.verifyCompletedRideHistory()).ok,false);
  assert.equal(f.client.snapshot().completedRideHistory.verified,false);
 }
});
test('F1 history read is closed if HTTP permission/contract is not certified',async()=>{
 const f=fixture({historyReady:false});await finish(f);
 assert.equal(f.client.snapshot().completedRideHistory.readReady,false);
 assert.equal((await f.client.verifyCompletedRideHistory()).code,
  'COMPLETED_HISTORY_NOT_READY');
 assert.equal(f.reads(),0);
});
test('F1 cancelled/searching trip cannot fetch its final-completion record',async()=>{
 const f=fixture();await f.client.refreshSession();
 assert.equal(f.client.snapshot().completedRideHistory.readReady,false);
 assert.equal((await f.client.verifyCompletedRideHistory()).ok,false);
 assert.equal(f.reads(),0);
});
test('F1 old status after 60s without fresh GET invalidates completed-history proof',async()=>{
 const f=fixture();await finish(f);
 assert.equal((await f.client.verifyCompletedRideHistory()).ok,true);
 f.setTime(T+60001);
 assert.equal(f.client.snapshot().completedRideHistory.verified,false);
 assert.equal(f.client.snapshot().completedRideHistory.readReady,false);
});
test('F1 remote history rerender or cache injection revokes completion evidence',async()=>{
 const f=fixture();await finish(f);
 await f.client.verifyCompletedRideHistory();
 assert.equal(f.client.snapshot().completedRideHistory.verified,true);
 f.client.acceptHistory(history());
 assert.equal(f.client.snapshot().completedRideHistory.verified,false);
});
test('F1 logout/token rotation revokes completed-history proof permanently',async()=>{
 const f=fixture();await finish(f);await f.client.verifyCompletedRideHistory();
 f.setUser({subject:owner,role:'passenger',
  token:'qa-rotated-passenger-token-1234567890',expiresAt:T+180000});
 await f.client.refreshSession();
 assert.equal(f.client.snapshot().completedRideHistory.verified,false);
 assert.equal(f.client.snapshot().completedRideHistory.readReady,false);
 assert.equal(f.client.snapshot().tracking.subscriptionActive,false);
});
test('F1 no double GET to history during one pending verification',async()=>{
 let unblock;
 const pending=new Promise(resolve=>unblock=resolve);
 const f=fixture({historyReply:async()=>pending});await finish(f);
 const first=f.client.verifyCompletedRideHistory();
 assert.equal((await f.client.verifyCompletedRideHistory()).code,'COMPLETED_HISTORY_IN_FLIGHT');
 unblock(respond(history()));
 assert.equal((await first).ok,true);
 assert.equal(f.reads(),1);
});
test('F1 JWT rotation while history GET in-flight cannot resurrect old completed ride',async()=>{
 let unblock;
 const pending=new Promise(resolve=>unblock=resolve);
 const f=fixture({historyReply:async()=>pending});await finish(f);
 const inFlight=f.client.verifyCompletedRideHistory();
 f.setUser({subject:owner,role:'passenger',
  token:'qa-new-passenger-session-12345678901',expiresAt:T+180000});
 await f.client.refreshSession();
 unblock(respond(history()));
 assert.equal((await inFlight).ok,false);
 assert.equal(f.client.snapshot().completedRideHistory.verified,false);
 assert.equal(f.client.snapshot().tracking.subscriptionActive,false);
});
