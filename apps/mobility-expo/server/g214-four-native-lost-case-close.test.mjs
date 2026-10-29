/**
 * G214 cross-app contract: B Passenger and C Driver close the same original
 * G198 AUTO / G200 MOTO case via the A verified HTTP boundary. Requests and
 * receipts remain QA-only; no live authorization, GPS or payment is claimed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createG198PassengerLostItemsHttp} from '../../movete-cliente/src/domain/g198-lost-items-http.mjs';
import {createG200PassengerMotoLostItemsHttp} from '../../movete-cliente/src/domain/g200-moto-lost-items-http.mjs';
import {createG198DriverLostItemsHttp} from '../../movete-driver/src/domain/g198-driver-lost-items-http.mjs';
import {createG200DriverMotoLostItemsHttp} from '../../movete-driver/src/domain/g200-driver-moto-lost-items-http.mjs';

const uuid=n=>'21400000-0000-4214-8214-'+String(n).padStart(12,'0');
const subject=uuid(1),tripId=uuid(2),caseId=uuid(3);
const origin='https://qore-qa.onrender.com';
const token='g214-authed-provider-session-abcdefghijklmnopqrstuvwxyz';
const receipt=block=>({mode:'STAGING_DEMO_ONLY',
 caseId,state:block?'BLOCKED':'CLOSED',qaOnly:true,productionEnabled:false});
function createReply(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'private, no-store'
 }});
}
function mock(){
 const requests=[];
 const request=async(url,init)=>{
  const body=init.body?JSON.parse(init.body):null;
  requests.push({url,method:init.method,body,headers:init.headers});
  return createReply(receipt(body?.block));
 };
 return {request,requests};
}
function client(kind,request){
 const stableExpiresAt=Date.now()+120000;
 const getSession=async()=>({role:'passenger',subject,token,
  expiresAt:stableExpiresAt,privateViewRevision:4});
 const common={enabled:true,ownerApproved:true,providerVerified:true,
  origin,pinnedOrigin:origin,getSession,request};
 return kind==='AUTO'?
  createG198PassengerLostItemsHttp({...common,g198PostgresVerified:true}):
  createG200PassengerMotoLostItemsHttp({...common,g200PostgresVerified:true});
}
function driver(kind,request){
 const common={enabled:true,ownerApproved:true,postTripCertified:true,
  verifiedStoppedProvider:true,origin,pinnedOrigin:origin,request,
  getSession:async()=>({role:'driver',userId:subject,accessToken:token})};
 return kind==='AUTO'?
  createG198DriverLostItemsHttp(common):
  createG200DriverMotoLostItemsHttp(common);
}
test('G214 Client B AUTO/MOTO close requires exact original case, consent and pinned HTTPS',async()=>{
 for(const [kind,block] of [['AUTO',false],['MOTO',true]]){
  const m=mock(),api=client(kind,m.request);
  const scope={tripId,caseId,expectedSubject:subject,
   expectedPrivateViewRevision:4};
  assert.equal(api.isConfigured(),true);
  const invalid=await api.close(scope);
  assert.equal(invalid.ok,false);
  assert.equal(m.requests.length,0,'missing explicit decision never sends POST');
  const closed=await api.close({...scope,block});
  assert.equal(closed.ok,true,JSON.stringify(closed));
  assert.equal(closed.data.state,block?'BLOCKED':'CLOSED');
  assert.equal(closed.data.productionEnabled,false);
  assert.equal(m.requests.length,1);
  assert.equal(m.requests[0].method,'POST');
  assert.equal(m.requests[0].url,origin+'/v1/staging/'+
   (kind==='AUTO'?'lost-items/':'moto/lost-items/')+caseId+'/close');
  assert.deepEqual(m.requests[0].body,{block});
 }
});
test('G214 Driver C AUTO/MOTO requires explicit close/block and server proof',async()=>{
 for(const [kind,block] of [['AUTO',true],['MOTO',false]]){
  const m=mock(),api=driver(kind,m.request);
  assert.equal(api.isConfigured(),true);
  const missing=await api.close(caseId,undefined);
  assert.equal(missing.ok,false);
  assert.equal(m.requests.length,0);
  const closed=await api.close(caseId,block);
  assert.equal(closed.ok,true,JSON.stringify(closed));
  assert.equal(closed.data.state,block?'BLOCKED':'CLOSED');
  assert.equal(m.requests[0].method,'POST');
  assert.deepEqual(m.requests[0].body,{block});
 }
});
test('G214 Clients and Drivers never accept forged closure or retry unknown outcome',async()=>{
 for(const kind of ['AUTO','MOTO']){
  let calls=0;
  const wrong=async()=>{calls++;return createReply({
   ...receipt(true),caseId:uuid(99)
  });};
  const c=client(kind,wrong);
  const d=driver(kind,wrong);
  const scope={tripId,caseId,expectedSubject:subject,
   expectedPrivateViewRevision:4,block:true};
  assert.equal((await c.close(scope)).ok,false);
  assert.equal((await d.close(caseId,true)).ok,false);
  assert.equal(calls,2);
  const ambiguous=async()=>{calls++;throw Error('response lost after unknown COMMIT');};
  const c2=client(kind,ambiguous),d2=driver(kind,ambiguous);
  const x=await c2.close(scope),y=await d2.close(caseId,true);
  assert.equal(x.ok,false);
  assert.equal(y.ok,false);
  assert.equal(x.retrySafe,false);
  assert.equal(y.retrySafe,false);
  assert.equal(calls,4,'no blind replay after unknown COMMIT');
 }
});
