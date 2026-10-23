import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommerceDraftCart,projectCatalog} from './commerce-draft.mjs';
const b1='123e4567-e89b-42d3-a456-426614174001';
const b2='123e4567-e89b-42d3-a456-426614174002';
const itemId='123e4567-e89b-42d3-a456-426614174003';
const key='123e4567-e89b-42d3-a456-426614174004';
test('carrito nunca calcula total ni inventa stock',()=>{
 const cart=createCommerceDraftCart();
 cart.selectBranch(b1);cart.setQuantity(itemId,2);
 const snap=cart.snapshot();
 assert.equal(snap.totalGs,null);
 assert.equal(snap.stock,'UNVERIFIED');
 assert.equal(snap.stage,'LOCAL_DRAFT');
});
test('al cambiar sucursal descarta items y evita mezcla de comercios',()=>{
 const cart=createCommerceDraftCart();
 cart.selectBranch(b1);cart.setQuantity(itemId,2);cart.selectBranch(b2);
 assert.equal(cart.snapshot().items.length,0);
 assert.equal(cart.snapshot().branchId,b2);
});
test('cantidades invalidas y más de 50 productos se bloquean',()=>{
 const cart=createCommerceDraftCart();cart.selectBranch(b1);
 assert.equal(cart.setQuantity(itemId,-1).ok,false);
 assert.equal(cart.setQuantity(itemId,1.5).ok,false);
 assert.equal(cart.setQuantity(itemId,1000).ok,false);
 for(let i=0;i<50;i++){
  const id='123e4567-e89b-42d3-a456-'+(426614100000+i).toString();
  assert.equal(cart.setQuantity(id,1).ok,true);
 }
 assert.equal(cart.setQuantity('123e4567-e89b-42d3-a456-426614199999',1).code,'CART_LIMIT');
});
test('previsualiza DTO OpenAPI pero no autoriza compra',()=>{
 const cart=createCommerceDraftCart();cart.selectBranch(b1);cart.setQuantity(itemId,3);
 const preview=cart.previewRequest(key);
 assert.equal(preview.ok,true);assert.equal(preview.submissionAllowed,false);
 assert.equal(preview.body.items[0].quantity,3);
 assert.equal(Object.hasOwn(preview.body.items[0],'priceGs'),false);
});
test('cambio de cuenta limpia carrito y no persiste estado',()=>{
 const cart=createCommerceDraftCart();cart.selectBranch(b1);cart.setQuantity(itemId,2);
 cart.clear();assert.equal(cart.snapshot().items.length,0);
 assert.equal(cart.snapshot().branchId,null);
});
const catalog={branchId:b1,revision:1,expiresAt:65000,items:[
 {itemId,title:'Producto QA sin receta',category:'PHARMACY_OTC',available:true,priceGs:9900}]};
test('catálogo sin expiración vigente o mal enlazado se oculta',()=>{
 assert.equal(projectCatalog(catalog,{branchId:b1,now:1000}).items[0].priceGs,9900);
 assert.equal(projectCatalog(catalog,{branchId:b2,now:1000}),null);
 assert.equal(projectCatalog(catalog,{branchId:b1,now:65000}),null);
});
test('precio inválido o categoria regulada no se visualiza',()=>{
 assert.equal(projectCatalog({...catalog,items:[{...catalog.items[0],priceGs:-1}]},{branchId:b1,now:1000}),null);
 assert.equal(projectCatalog({...catalog,items:[{...catalog.items[0],category:'PRESCRIPTION'}]},{branchId:b1,now:1000}),null);
});
test('items duplicados y sin stock señalado se rechazan',()=>{
 assert.equal(projectCatalog({...catalog,items:[catalog.items[0],catalog.items[0]]},{branchId:b1,now:1000}),null);
 const result=projectCatalog({...catalog,items:[{...catalog.items[0],available:false,priceGs:0}]},{branchId:b1,now:1000});
 assert.equal(result.items[0].priceGs,null);
});
