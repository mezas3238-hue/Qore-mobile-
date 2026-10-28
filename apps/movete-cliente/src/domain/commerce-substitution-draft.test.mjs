import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommerceSubstitutionDraft} from './commerce-substitution-draft.mjs';
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const clock=1800000000000;
const actor={authenticated:true,subject:id(501),sessionRevision:19};
const item=(n,patch={})=>({
 itemId:id(n),itemTag:'ITEM_'+n,itemClass:'GENERAL',active:true,
 unitPricePyg:1000,stockUnits:20,...patch
});
const line=(n,quantity=1)=>({
 itemId:id(n),itemTag:'ITEM_'+n,quantity,
 unitPricePyg:1000,lineSubtotalPyg:quantity*1000
});
const basket=(patch={})=>({
 branchId:id(600),vehicleKind:'MOTO',catalogVersion:'g44:7',
 catalogExpiresAt:clock+60000,stage:'SERVER_CATALOG',stock:'SERVER_SNAPSHOT',
 items:[line(1),line(2)],catalogItems:[item(1),item(2)],
 estimatedSubtotalPyg:2000,finalTotalPyg:null,catalogReadReady:true,
 checkoutEnabled:false,paymentEnabled:false,serverOrderReceipt:null,...patch
});
const create=()=>createCommerceSubstitutionDraft({now:()=>clock});
const selected=(result,n)=>result.choices.find(x=>x.itemId===id(n))?.choice;

test('R39 dos decisiones de faltantes por ítem, sin autorizar reemplazos concretos',()=>{
 const d=create();
 let res=d.snapshot(basket(),actor);
 assert.equal(res.ok,true);
 assert.equal(selected(res,1),null);
 res=d.choose(basket(),actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 assert.equal(res.ok,true);
 assert.equal(selected(res,1),'OMIT_IF_UNAVAILABLE');
 res=d.choose(basket(),actor,{itemId:id(2),choice:'ASK_BEFORE_SUBSTITUTING'});
 assert.equal(selected(res,2),'ASK_BEFORE_SUBSTITUTING');
 assert.equal(Object.isFrozen(res.choices),true);
 assert.equal(Object.isFrozen(res.choices[0]),true);
 for(const key of ['submitted','orderConfirmed','contactSent','stockReserved',
  'preferencesSavedOnServer'])assert.equal(res[key],false);
 assert.equal('requestKey' in res,false);
 assert.equal('replacementItem' in res,false);
});
test('R39 anular una decisión no altera preferencias de otro artículo',()=>{
 const d=create(), b=basket();
 d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 d.choose(b,actor,{itemId:id(2),choice:'ASK_BEFORE_SUBSTITUTING'});
 const res=d.choose(b,actor,{itemId:id(1),choice:null});
 assert.equal(selected(res,1),null);
 assert.equal(selected(res,2),'ASK_BEFORE_SUBSTITUTING');
});
test('R39 nuevos precios, stocks y cantidades requieren revisión nueva',()=>{
 const d=create(),b=basket();
 d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 const changed=basket({
  items:[line(1,2),line(2)],estimatedSubtotalPyg:3000
 });
 assert.equal(selected(d.snapshot(changed,actor),1),null);
 d.choose(changed,actor,{itemId:id(1),choice:'ASK_BEFORE_SUBSTITUTING'});
 assert.equal(selected(d.snapshot({...changed,catalogVersion:'g44:8'},actor),1),null);
 d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 const increased=basket({
  items:[{...line(1),unitPricePyg:1500,lineSubtotalPyg:1500},line(2)],
  catalogItems:[item(1,{unitPricePyg:1500}),item(2)],
  estimatedSubtotalPyg:2500
 });
 assert.equal(selected(d.snapshot(increased,actor),1),null);
});
test('R39 cambio de sucursal, vehículo o expiración borra decisiones',()=>{
 const d=create(),b=basket();
 const scenarios=[
  {branchId:id(601)},{vehicleKind:'AUTO'},
  {catalogExpiresAt:clock+40000}
 ];
 for(const patch of scenarios){
  d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
  assert.equal(selected(d.snapshot(basket(patch),actor),1),null);
 }
});
test('R39 cambio de usuario o revisión de sesión no comparte decisiones',()=>{
 const d=create(),b=basket();
 d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 assert.equal(selected(d.snapshot(b,{...actor,subject:id(502)}),1),null);
 d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 assert.equal(selected(d.snapshot(b,{...actor,sessionRevision:20}),1),null);
});
test('R39 logout/expiry revoca decisiones incluso para la cuenta original',()=>{
 const d=create(),b=basket();
 d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 const loggedOut=d.snapshot(b,{...actor,authenticated:false});
 assert.equal(loggedOut.ok,false);
 assert.equal(loggedOut.code,'AUTH_REQUIRED');
 assert.deepEqual(loggedOut.choices,[]);
 assert.equal(selected(d.snapshot(b,actor),1),null);
 d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 assert.equal(d.snapshot({...b,catalogExpiresAt:clock-1},actor).ok,false);
 assert.equal(selected(d.snapshot(b,actor),1),null);
});
test('R39 no permite producto extraño, fármaco no autorizado o decisiones arbitrarias',()=>{
 const d=create(),b=basket();
 for(const action of [
  {itemId:id(999),choice:'OMIT_IF_UNAVAILABLE'},
  {itemId:'../hijack',choice:'OMIT_IF_UNAVAILABLE'},
  {itemId:id(1),choice:'REPLACE_AUTOMATICALLY'},
  {itemId:id(1),choice:'CONFIRM_PURCHASE'},
  {itemId:id(1),choice:undefined}
 ]){
  const out=d.choose(b,actor,action);
  assert.equal(out.ok,false);
 }
 assert.equal(d.snapshot(b,actor).choices.every(x=>x.choice===null),true);
 const prescription=basket({catalogItems:[
  item(1,{itemClass:'PRESCRIPTION'}),item(2)
 ]});
 assert.equal(d.choose(prescription,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'}).ok,false);
});
test('R39 impide preferencias cuando existe cualquier estado de checkout/pago',()=>{
 const d=create();
 for(const patch of [
  {checkoutEnabled:true},{paymentEnabled:true},
  {serverOrderReceipt:{orderId:id(2)}},{stage:'CATALOG_EXPIRED'},
  {catalogReadReady:false},{finalTotalPyg:2400}
 ]){
  assert.equal(d.choose(basket(patch),actor,{itemId:id(1),
   choice:'OMIT_IF_UNAVAILABLE'}).ok,false);
 }
});
test('R39 eliminación de producto elimina la decisión anterior',()=>{
 const d=create(),b=basket();
 d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 const next=basket({
  items:[line(2)],estimatedSubtotalPyg:1000
 });
 assert.equal(d.snapshot(next,actor).choices.length,1);
 assert.equal(d.choose(next,actor,{itemId:id(1),
  choice:'ASK_BEFORE_SUBSTITUTING'}).code,'ITEM_NOT_IN_CURRENT_BASKET');
 assert.equal(selected(d.snapshot(b,actor),1),null);
});
test('R39 clear elimina sin dejar resultados reutilizables ni POST',()=>{
 const d=create(),b=basket();
 d.choose(b,actor,{itemId:id(1),choice:'OMIT_IF_UNAVAILABLE'});
 d.clear();
 assert.equal(selected(d.snapshot(b,actor),1),null);
 assert.equal(Object.keys(d).sort().join(','),'choose,clear,snapshot');
});
test('R39 rechazo seguro de contexto inválido y cambio de cuenta',()=>{
 const d=create(),b=basket();
 const invalid=[null,'fake',{...actor,sessionRevision:-1},
  {...actor,subject:'not-uuid'},{...actor,subject:null}
 ];
 for(const a of invalid){
  const res=d.snapshot(b,a);
  assert.equal(res.ok,false);
  assert.equal(res.contactSent,false);
  assert.deepEqual(res.choices,[]);
 }
});
