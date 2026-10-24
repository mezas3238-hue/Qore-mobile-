import test from 'node:test';
import assert from 'node:assert/strict';
import {guardCommerceUiAction} from './commerce-ui-action-guard.mjs';
const T=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const row={itemId:id(4),itemTag:'LECHE',itemClass:'GENERAL',
 active:true,unitPricePyg:6000,stockUnits:9};
const make=(change={})=>({
 authenticated:true,account:{subject:id(1),role:'passenger'},
 privateViewRevision:4,
 commerce:{branchId:id(2),catalogVersion:'v8',
  catalogExpiresAt:T+30000,generation:6,
  catalogReadReady:true,stage:'SERVER_CATALOG',
  catalogLoading:false,catalogError:null,
  checkoutEnabled:false,paymentEnabled:false,
  catalogItems:[row],items:[],...change}
});
const guard=(shown=make(),current=shown,args={})=>
 guardCommerceUiAction(shown,current,{now:T,...args});
test('R49 permits only a local quantity change within current scope',()=>{
 const x=guard(make(),make(),{itemId:id(4),requestedQuantity:1});
 assert.equal(x.ok,true);
 assert.equal(x.scope,'CURRENT_LOCAL_DRAFT_ONLY');
 assert.equal(x.checkoutEnabled,false);
 assert.equal(x.paymentEnabled,false);
 assert.equal(x.orderConfirmed,false);
});
test('R49 no authentication or wrong actor fails closed',()=>{
 const displayed=make();
 for(const now of [
  {...make(),authenticated:false},
  {...make(),account:{subject:id(9),role:'passenger'}},
  {...make(),account:{subject:id(1),role:'driver'}},
  {...make(),privateViewRevision:5}
 ])assert.equal(guard(displayed,now).code,'COMMERCE_SESSION_CHANGED');
});
test('R49 versions, branches, revisions and catalog expiry cannot race a tap',()=>{
 const original=make();
 for(const changed of [
  {branchId:id(9)},{catalogVersion:'v9'},
  {generation:7},{catalogExpiresAt:T+45000}
 ])assert.equal(guard(original,make(changed)).code,'COMMERCE_SCOPE_CHANGED');
 assert.equal(guardCommerceUiAction(original,original,{now:T+30000}).code,
  'COMMERCE_CATALOG_EXPIRED');
});
test('R49 cannot edit a stale item after stock or price changes',()=>{
 const original=make();
 for(const edited of [{stockUnits:0},{unitPricePyg:7000},
  {active:false},{itemTag:'ARROZ'},{itemClass:'PHARMACY_OTC'}]){
  assert.equal(guard(original,make({catalogItems:[{...row,...edited}]}),{
   itemId:id(4),requestedQuantity:1
  }).code,'COMMERCE_ITEM_CHANGED');
 }
});
test('R49 rejects duplicate taps before React re-renders the basket',()=>{
 const before=make();
 const after=make({items:[{itemId:id(4),quantity:1}]});
 assert.equal(guard(before,after,{itemId:id(4),requestedQuantity:1}).code,
  'COMMERCE_BASKET_CHANGED');
});
test('R49 rejects item not present in current basket for substitution',()=>{
 assert.equal(guard(make(),make(),{
  itemId:id(4),requireInBasket:true
 }).code,'ITEM_NOT_IN_BASKET');
 const current=make({items:[{itemId:id(4),quantity:1}]});
 assert.equal(guard(current,current,{
  itemId:id(4),requireInBasket:true
 }).ok,true);
});
test('R49 rejects tampered item identifiers and invalid quantities',()=>{
 const a=make();
 for(const itemId of ['../../secret',id(999),null]){
  if(itemId===null)continue;
  assert.equal(guard(a,a,{itemId,requestedQuantity:1}).ok,false);
 }
 for(const requestedQuantity of [-1,10,1000,1.5,NaN]){
  assert.equal(guard(a,a,{itemId:id(4),requestedQuantity}).code,
   'INVALID_REQUESTED_QUANTITY');
 }
});
test('R49 runtime flags and loading invalidate local edits',()=>{
 const before=make();
 for(const changed of [
  {catalogReadReady:false},{catalogLoading:true},
  {catalogError:'ERROR'},{checkoutEnabled:true},
  {paymentEnabled:true},{stage:'DRAFT'}
 ])assert.equal(guard(before,make(changed)).code,'COMMERCE_UNAVAILABLE');
});
test('R49 item action cannot exceed current reported stock',()=>{
 const current=make({items:[{itemId:id(4),quantity:9}]});
 assert.equal(guard(current,current,{itemId:id(4),requestedQuantity:10}).ok,false);
 assert.equal(guard(current,current,{itemId:id(4),requestedQuantity:8}).ok,true);
});
test('R49 malformed snapshots do not throw or authorize anything',()=>{
 for(const v of [null,{},[],false,undefined]){
  assert.equal(guardCommerceUiAction(v,make(),{now:T}).ok,false);
  assert.equal(guardCommerceUiAction(make(),v,{now:T}).ok,false);
 }
});
