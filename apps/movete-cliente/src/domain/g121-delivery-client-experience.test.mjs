import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const id=n=>'12100000-0000-4121-8121-'+String(n).padStart(12,'0');
const owner=id(1),foreign=id(2),requestKey=id(31),deliveryId=id(41);
const host='https://qore-b17-g121.onrender.com';
const body=kind=>({requestKey,vehicleKind:kind,category:'PARCEL',
 grams:1500,lengthCm:20,widthCm:12,heightCm:8,pickupTag:'San Lorenzo',
 deliveryTag:'Villa Morra',restrictedItemDeclared:false});
const dto=(kind,override={})=>({mode:'STAGING_DEMO_ONLY',
 liveDeliveriesEnabled:false,serverPersisted:true,ownerId:owner,
 requestKey,deliveryId,vehicleKind:kind,status:'requested',revision:1,...override});
const http=(payload,status=200)=>({ok:status===200,status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(payload)});
const config=fetchImpl=>({
 enabled:true,ownerApproved:true,contractCertified:true,
 externalRuntimeVerified:true,passengerRlsVerified:true,
 origin:host,pinnedOrigin:host,fetchImpl
});
function make({kind='MOTO',allow=true,serverResponse=null}={}){
 let user=owner,jwt='synthetic-g121-passenger-jwt-token-1234567';
 let posts=0;const gets=[];
 const app=createClientExperience({now:()=>T,
  authProvider:{readSession:async()=>({role:'passenger',subject:user,token:jwt,
   expiresAt:T+60000}),signOut:async()=>{}},
  gateway:{send:async()=>{posts++;return {ok:false,code:'NETWORK_OR_TIMEOUT'};}},
  deliveryRegistrationOptions:allow?config(async(url,init)=>{
   gets.push({url,method:init.method,headers:init.headers});
   return serverResponse??http(dto(kind));
  }):null
 });
 return {app,gets,posts:()=>posts,
  rotate:()=>jwt='rotated-g121-passenger-jwt-1234567',
  switchOwner:()=>user=foreign};
}
test('B17 AUTO/MOTO: same POST key reconciled only via G121 GET; never repeat delivery',async()=>{
 for(const kind of ['AUTO','MOTO']){
  const t=make({kind});
  assert.equal((await t.app.refreshSession()).ok,true);
  assert.equal(t.app.prepareDelivery(body(kind)).ok,true);
  assert.equal((await t.app.submit()).code,'NETWORK_OR_TIMEOUT');
  assert.equal(t.app.snapshot().mutation.phase,'failed');
  assert.equal(t.app.snapshot().deliveryRegistration.readReady,true);
  const check=await t.app.readUnconfirmedDeliveryRegistration();
  assert.equal(check.ok,true);
  assert.equal(check.registrationOnly,true);
  assert.equal(check.deliveryId,deliveryId);
  const state=t.app.snapshot();
  assert.equal(state.mutation.phase,'failed'); // G121 cannot authorize booking.
  assert.equal(state.deliveryRegistration.deliveryId,deliveryId);
  assert.equal(state.deliveryRegistration.vehicleKind,kind);
  assert.equal(state.deliveryRegistration.registrationOnly,true);
  assert.equal(state.quote,null);
  assert.equal(state.tracking.assignedDriver,null);
  assert.equal((await t.app.retry()).code,'NO_READY_REQUEST');
  assert.equal(t.posts(),1);
  assert.equal(t.gets.length,1);
  assert.equal(t.gets[0].url,host+'/v1/staging/sender/deliveries/requests/'+requestKey);
  assert.equal(t.gets[0].method,'GET');
 }
});
test('B17 no certification means no G121 HTTP or public registration ID',async()=>{
 const t=make({allow:false});
 await t.app.refreshSession();
 t.app.prepareDelivery(body('AUTO'));
 await t.app.submit();
 assert.equal(t.app.snapshot().deliveryRegistration.readReady,false);
 assert.equal((await t.app.readUnconfirmedDeliveryRegistration()).code,'G121_NOT_CERTIFIED');
 assert.equal(t.gets.length,0);
});
test('B17 forged G121 owner cannot populate the UI or unblock POST',async()=>{
 const t=make({serverResponse:http(dto('MOTO',{ownerId:foreign}))});
 await t.app.refreshSession();t.app.prepareDelivery(body('MOTO'));
 await t.app.submit();
 assert.equal((await t.app.readUnconfirmedDeliveryRegistration()).ok,false);
 assert.equal(t.app.snapshot().deliveryRegistration.deliveryId,null);
 assert.equal(t.app.snapshot().mutation.phase,'failed');
 assert.equal(t.posts(),1);
});
test('B17 JWT rotation clears owner G121 proof and old key without another POST',async()=>{
 const t=make();
 await t.app.refreshSession();t.app.prepareDelivery(body('MOTO'));await t.app.submit();
 assert.equal((await t.app.readUnconfirmedDeliveryRegistration()).ok,true);
 t.rotate();await t.app.refreshSession();
 const updated=t.app.snapshot();
 assert.equal(updated.deliveryRegistration.deliveryId,null);
 assert.equal(updated.mutation.phase,'idle');
 assert.equal(t.posts(),1);
 t.switchOwner();await t.app.refreshSession();
 assert.equal(t.app.snapshot().deliveryRegistration.deliveryId,null);
 assert.equal((await t.app.readUnconfirmedDeliveryRegistration()).ok,false);
});
test('B17 404 and network failure cannot permit replay or new key',async()=>{
 for(const serverResponse of [http({error:'not found'},404),null]){
  const t=make({serverResponse:serverResponse??http({error:'offline'},503)});
  await t.app.refreshSession();t.app.prepareDelivery(body('MOTO'));await t.app.submit();
  assert.equal((await t.app.readUnconfirmedDeliveryRegistration()).ok,false);
  assert.equal(t.app.snapshot().deliveryRegistration.deliveryId,null);
  assert.equal(t.app.prepareDelivery({...body('AUTO'),requestKey:id(99)}).code,
   'RECONCILE_BEFORE_NEW_REQUEST');
  assert.equal(t.posts(),1);
 }
});
