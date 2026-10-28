import test from 'node:test';
import assert from 'node:assert/strict';
import {projectOwnDeliveryActivity} from './own-delivery-activity.mjs';
const owner='16000000-0000-4116-8116-000000000001';
const auto='16000000-0000-4116-8116-000000000002';
const moto='16000000-0000-4116-8116-000000000003';
function view({
 subject=owner,historyOwner=owner,vehicleKind=null,state=null,
 selectedId=null,verified=false,ready=true,loading=false
}={}){
 return {authenticated:true,account:{subject,role:'passenger'},
  historyConfigured:true,historyLoading:false,
  senderCustody:{readReady:ready,loading,deliveryId:selectedId,vehicleKind,
   state,revision:3,proofVerified:verified},
  history:{ownerId:historyOwner,items:[
   {serviceId:auto,kind:'DELIVERY',revision:3,status:'in_progress',createdAt:100},
   {serviceId:moto,kind:'DELIVERY',revision:3,status:'in_progress',createdAt:99},
   {serviceId:'16000000-0000-4116-8116-000000000004',kind:'RIDE',
    revision:3,status:'assigned',createdAt:98}
  ]}
 };
}
test('B#16 lists only own server delivery IDs; no guessed AUTO/MOTO type or price',()=>{
 const result=projectOwnDeliveryActivity(view());
 assert.equal(result.ready,true);
 assert.equal(result.rows.length,2);
 assert.equal(result.rows[0].vehicleKind,null);
 assert.equal(result.rows[1].vehicleKind,null);
 assert.equal(result.rows.every(x=>x.canVerify),true);
 assert.equal(result.selected,null);
 assert(!JSON.stringify(result).includes('latitude'));
 assert(!JSON.stringify(result).includes('recipient'));
});
test('B#16 real G68 custody projection distinguishes AUTO from MOTO',()=>{
 for(const [id,kind] of [[auto,'AUTO'],[moto,'MOTO']]){
  const projected=projectOwnDeliveryActivity(view({selectedId:id,vehicleKind:kind,
   state:'picked_up',verified:false}));
  assert.equal(projected.selected.deliveryId,id);
  assert.equal(projected.selected.vehicleKind,kind);
  assert.equal(projected.selected.complete,false);
  assert.equal(projected.selected.paymentConfirmed,false);
  assert.equal(projected.selected.etaVerified,false);
 }
});
test('B#16 delivered is confirmed only from independently verified G68 proof',()=>{
 const incomplete=projectOwnDeliveryActivity(view({selectedId:auto,
  vehicleKind:'AUTO',state:'delivered',verified:false}));
 assert.equal(incomplete.selected.complete,false);
 const complete=projectOwnDeliveryActivity(view({selectedId:auto,
  vehicleKind:'AUTO',state:'delivered',verified:true}));
 assert.equal(complete.selected.complete,true);
 assert.equal(complete.selected.gpsVerified,false);
});
test('B#16 switching account or hiding history does not reveal previous delivery',()=>{
 for(const value of [
  view({subject:moto}),
  view({historyOwner:moto}),
  {...view(),authenticated:false},
  {...view(),history:null},
  view({selectedId:'16000000-0000-4116-8116-000000000099',
   vehicleKind:'AUTO',state:'delivered',verified:true}),
  view({selectedId:auto,vehicleKind:'AUTO',state:'delivered',
   verified:true,loading:true})
 ]){
  const result=projectOwnDeliveryActivity(value);
  assert.equal(result.selected,null);
 }
});
test('B#16 malformed or unverified custody cannot leak into a verified delivery UI',()=>{
 for(const kind of [null,'MOTO_RIDE','BICYCLE']){
  const result=projectOwnDeliveryActivity(view({selectedId:auto,vehicleKind:kind,
   state:'delivered',verified:true}));
  assert.equal(result.selected,null);
 }
 const n=projectOwnDeliveryActivity(view({selectedId:moto,
  vehicleKind:'MOTO',state:'requested',verified:false,ready:false}));
 assert.equal(n.selected,null);
 assert.equal(n.rows.every(x=>!x.canVerify),true);
});
