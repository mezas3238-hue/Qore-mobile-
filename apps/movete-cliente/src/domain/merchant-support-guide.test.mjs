import test from 'node:test';
import assert from 'node:assert/strict';
import {MERCHANT_SUPPORT_REASONS,createMerchantSupportGuide}
 from './merchant-support-guide.mjs';
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const actor={role:'passenger',subject:id(1),sessionRevision:4};
const completed=(reason='MISSING_ITEM',severity='LOW')=>{
 const guide=createMerchantSupportGuide();
 guide.update(actor,{orderId:id(5)});
 guide.update(actor,{reason});
 guide.update(actor,{severity});
 return guide;
};

test('R40 enum de motivos restringido al soporte de comercios sin contacto',()=>{
 assert.deepEqual(MERCHANT_SUPPORT_REASONS.map(x=>x.code),[
  'MISSING_ITEM','WRONG_ITEM','DAMAGED_ITEM','LATE_DELIVERY',
  'PRICE_DISPUTE','SAFETY_CONCERN']);
 assert.equal(Object.isFrozen(MERCHANT_SUPPORT_REASONS),true);
 assert.equal(Object.isFrozen(MERCHANT_SUPPORT_REASONS[0]),true);
});
test('R40 un borrador válido mapea al contrato G40 sin requestKey ni envío',()=>{
 const g=completed();
 const result=g.review(actor);
 assert.equal(result.ok,true);
 assert.deepEqual(result.intent,{
  subjectKind:'MERCHANT_ORDER',subjectId:id(5),category:'LOSS',severity:'LOW'
 });
 assert.equal(Object.isFrozen(result),true);
 assert.equal(Object.isFrozen(result.intent),true);
 for(const field of ['caseCreated','operatorNotified','merchantContacted',
  'sosDispatched','ownershipVerified','submitted','customerContacted'])
  assert.equal(result[field],false);
 assert.equal('requestKey' in result,false);
 assert.equal('send' in g,false);
 assert.equal('submit' in g,false);
 assert.equal('fetch' in g,false);
});
test('R40 todos los motivos mapean solo a categorías G40 existentes',()=>{
 for(const opt of MERCHANT_SUPPORT_REASONS){
  const reviewed=completed(opt.code,'MEDIUM').review(actor);
  assert.equal(reviewed.ok,true);
  assert.equal(reviewed.intent.category,opt.category);
  assert.equal(reviewed.intent.severity,'MEDIUM');
 }
});
test('R40 no asigna gravedad automáticamente ni simula SOS',()=>{
 const g=createMerchantSupportGuide();
 g.update(actor,{orderId:id(5)});
 g.update(actor,{reason:'SAFETY_CONCERN'});
 assert.equal(g.review(actor).code,'INCOMPLETE_GUIDE');
 assert.equal(g.snapshot(actor).severity,null);
 g.update(actor,{severity:'HIGH'});
 const r=g.review(actor);
 assert.equal(r.intent.category,'SAFETY');
 assert.equal(r.sosDispatched,false);
 assert.equal(r.operatorNotified,false);
});
test('R40 impide editar con payload extra, PII y códigos desconocidos',()=>{
 const g=completed();
 const invalid=[
  {reason:'PRESCRIPTION'}, {severity:'EMERGENCY'}, {orderId:'telefono 0981'},
  {orderId:'123e4567-e89b-42d3-a456-000000000005\n'}, 
  {orderId:id(5),phone:'0999999999'}, {}, {category:'SAFETY'}, null
 ];
 for(const change of invalid)assert.equal(g.update(actor,change).ok,false);
 assert.equal(g.review(actor).ok,true);
});
test('R40 ingreso gradual de UUID no certifica servicio ni crea caso',()=>{
 const g=createMerchantSupportGuide();
 const draft=g.update(actor,{orderId:'123'});
 assert.equal(draft.ok,true);
 assert.equal(draft.canReview,false);
 g.update(actor,{reason:'PRICE_DISPUTE'});
 g.update(actor,{severity:'LOW'});
 assert.equal(g.review(actor).code,'INCOMPLETE_GUIDE');
 g.update(actor,{orderId:id(16)});
 const result=g.review(actor);
 assert.equal(result.ok,true);
 assert.equal(result.ownershipVerified,false);
 assert.equal(result.intent.category,'DISPUTE');
});
test('R40 cambiar cuenta o JWT borra orden y razón de la sesión anterior',()=>{
 const g=completed('WRONG_ITEM','HIGH');
 assert.equal(g.review(actor).ok,true);
 const other=g.snapshot({...actor,subject:id(2)});
 assert.equal(other.ok,true);
 assert.equal(other.orderId,'');
 assert.equal(other.reason,null);
 assert.equal(other.canReview,false);
 assert.equal(g.review(actor).code,'INCOMPLETE_GUIDE');
 g.update(actor,{orderId:id(7)});
 g.update(actor,{reason:'MISSING_ITEM'});
 g.update(actor,{severity:'LOW'});
 assert.equal(g.review(actor).ok,true);
 const rotated=g.snapshot({...actor,sessionRevision:5});
 assert.equal(rotated.reason,null);
 assert.equal(rotated.orderId,'');
 assert.equal(g.review(actor).code,'INCOMPLETE_GUIDE');
});
test('R40 deniega usuario/rol inválidos, sin filtrar identificador privado',()=>{
 const g=completed();
 for(const other of [
  null,{role:'driver',subject:actor.subject,sessionRevision:4},
  {role:'admin',subject:actor.subject,sessionRevision:4},
  {...actor,subject:'bad'},{...actor,sessionRevision:-1}
 ]){
  const state=g.snapshot(other);
  assert.equal(state.ok,false);
  assert.equal(state.orderId,'');
  assert.equal(state.reason,null);
  assert.equal(state.operatorNotified,false);
 }
 assert.equal(g.review(actor).code,'INCOMPLETE_GUIDE');
});
test('R40 clear/dispose impide reutilizar borrador en misma sesión',()=>{
 const g=completed('DAMAGED_ITEM','LOW');
 g.clear();
 assert.equal(g.review(actor).code,'INCOMPLETE_GUIDE');
 g.update(actor,{orderId:id(5)});
 g.update(actor,{reason:'WRONG_ITEM'});
 g.update(actor,{severity:'LOW'});
 g.dispose();
 assert.equal(g.snapshot(actor).code,'GUIDE_DISPOSED');
 assert.equal(g.review(actor).code,'GUIDE_DISPOSED');
 assert.equal(g.update(actor,{severity:'HIGH'}).ok,false);
});
test('R40 rechaza variaciones de UUID inválidas y texto fuera de política',()=>{
 const g=createMerchantSupportGuide();
 const ids=['',id(5).toUpperCase(),id(5).replaceAll('-',''),
  'https://example.com', 'a'.repeat(37),'abc\u202e123'];
 for(const entry of ids){
  const updated=g.update(actor,{orderId:entry});
  if(entry.length<=36&&!entry.includes('\u202e')){
   assert.equal(updated.ok,true);
   assert.equal(updated.canReview,false);
  } else assert.equal(updated.ok,false);
 }
});
