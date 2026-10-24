import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommerceDraftCart,projectCatalog} from './commerce-draft.mjs';
const b1='123e4567-e89b-42d3-a456-426614174001';
const b2='123e4567-e89b-42d3-a456-426614174002';
const itemId='123e4567-e89b-42d3-a456-426614174003';
const secondId='123e4567-e89b-42d3-a456-426614174005';
const key='123e4567-e89b-42d3-a456-426614174004';
let clock=1000;
const base={branchId:b1,version:'catalog-7',expiresAt:65000,items:[
 {itemId,itemTag:'ARROZ_1KG',itemClass:'GENERAL',active:true,unitPricePyg:9900,stockUnits:8},
 {itemId:secondId,itemTag:'JABON',itemClass:'GENERAL',active:true,unitPricePyg:4200,stockUnits:3}
]};
const cart=()=>createCommerceDraftCart({now:()=>clock});

test('catálogo de comprador exige identidad, versión, vencimiento, precio y stock del servidor',()=>{
 const projected=projectCatalog(base,{branchId:b1,now:clock});
 assert.equal(projected.version,'catalog-7');assert.equal(projected.items[0].stockUnits,8);
 for(const broken of [
  {...base,branchId:b2},{...base,version:''},{...base,expiresAt:clock},
  {...base,items:[{...base.items[0],unitPricePyg:99}]},
  {...base,items:[{...base.items[0],stockUnits:-1}]},
  {...base,items:[base.items[0],base.items[0]]},
  {...base,items:[{...base.items[0],itemClass:'PRESCRIPTION'}]}
 ])assert.equal(projectCatalog(broken,{branchId:b1,now:clock}),null);
});

test('carrito solo admite artículos y cantidades disponibles en catálogo vigente',()=>{
 const c=cart();c.selectBranch(b1);
 assert.equal(c.setQuantity(itemId,1).code,'CATALOG_REQUIRED');
 assert.equal(c.acceptCatalog(base).ok,true);
 assert.equal(c.setQuantity(itemId,9).code,'INSUFFICIENT_STOCK');
 assert.equal(c.setQuantity('123e4567-e89b-42d3-a456-426614174099',1).code,'ITEM_UNAVAILABLE');
 assert.equal(c.setQuantity(itemId,2).ok,true);
});

test('cantidades inválidas y más de 50 líneas se bloquean con catálogo real',()=>{
 const many={...base,version:'catalog-many',items:Array.from({length:51},(_,index)=>({
  itemId:'123e4567-e89b-42d3-a456-'+String(426614100000+index),
  itemTag:'ITEM_'+index,itemClass:'GENERAL',active:true,unitPricePyg:1000,stockUnits:10
 }))};
 const c=cart();c.selectBranch(b1);assert.equal(c.acceptCatalog(many).ok,true);
 assert.equal(c.setQuantity(many.items[0].itemId,-1).code,'INVALID_ITEM');
 assert.equal(c.setQuantity(many.items[0].itemId,1.5).code,'INVALID_ITEM');
 assert.equal(c.setQuantity(many.items[0].itemId,1000).code,'INVALID_ITEM');
 for(const item of many.items.slice(0,50))assert.equal(c.setQuantity(item.itemId,1).ok,true);
 assert.equal(c.setQuantity(many.items[50].itemId,1).code,'CART_LIMIT');
});

test('subtotal es derivado del snapshot del servidor y nunca es total final',()=>{
 const c=cart();c.selectBranch(b1);c.acceptCatalog(base);c.setQuantity(itemId,2);
 const snap=c.snapshot();
 assert.equal(snap.estimatedSubtotalPyg,19800);assert.equal(snap.finalTotalPyg,null);
 assert.equal(snap.stock,'SERVER_SNAPSHOT');assert.equal(snap.catalogVersion,'catalog-7');
 assert.equal(snap.items[0].unitPricePyg,9900);
});

test('cambiar sucursal descarta catálogo, líneas y precios anteriores',()=>{
 const c=cart();c.selectBranch(b1);c.acceptCatalog(base);c.setQuantity(itemId,2);
 c.selectBranch(b2);const snap=c.snapshot();
 assert.equal(snap.branchId,b2);assert.equal(snap.items.length,0);
 assert.equal(snap.catalogVersion,null);assert.equal(snap.estimatedSubtotalPyg,null);
});

test('misma versión con contenido distinto se rechaza y obliga a recargar',()=>{
 const c=cart();c.selectBranch(b1);c.acceptCatalog(base);c.setQuantity(itemId,1);
 const result=c.acceptCatalog({...base,items:[{...base.items[0],unitPricePyg:10900}]});
 assert.equal(result.code,'CATALOG_REVISION_CONFLICT');
 assert.equal(c.snapshot().items.length,0);assert.equal(c.snapshot().catalogVersion,null);
});

test('cambio de precio invalida el carrito antes del checkout',()=>{
 const c=cart();c.selectBranch(b1);c.acceptCatalog(base);c.setQuantity(itemId,2);
 const next={...base,version:'catalog-8',items:base.items.map(item=>
  item.itemId===itemId?{...item,unitPricePyg:10900}:item)};
 assert.equal(c.acceptCatalog(next).code,'PRICE_CHANGED');
 assert.equal(c.snapshot().items.length,0);assert.equal(c.snapshot().catalogVersion,'catalog-8');
});

test('cualquier cambio de stock o baja de artículo invalida el carrito',()=>{
 for(const [patch,code] of [[{stockUnits:7},'STOCK_CHANGED'],[{active:false},'ITEM_UNAVAILABLE']]){
  const c=cart();c.selectBranch(b1);c.acceptCatalog(base);c.setQuantity(itemId,2);
  const next={...base,version:'catalog-9',items:base.items.map(item=>
   item.itemId===itemId?{...item,...patch}:item)};
  assert.equal(c.acceptCatalog(next).code,code);assert.equal(c.snapshot().items.length,0);
 }
});

test('revisión nueva sin cambios en líneas elegidas conserva carrito y precondición',()=>{
 const c=cart();c.selectBranch(b1);c.acceptCatalog(base);c.setQuantity(itemId,2);
 const next={...base,version:'catalog-10',items:base.items.map(item=>
  item.itemId===secondId?{...item,unitPricePyg:4500}:item)};
 assert.equal(c.acceptCatalog(next).ok,true);
 const preview=c.previewRequest(key);
 assert.equal(preview.precondition.catalogVersion,'catalog-10');
 assert.deepEqual(preview.body,{requestKey:key,branchId:b1,vehicleKind:'MOTO',
  items:[{itemId,quantity:2}]});
 assert.equal(preview.submissionAllowed,false);
 assert.equal(preview.reason,'ATOMIC_ORDER_CONTRACT_PENDING');
 assert.equal(Object.hasOwn(preview.body.items[0],'unitPricePyg'),false);
});

test('catálogo vencido oculta precios e impide preparar checkout',()=>{
 const c=cart();c.selectBranch(b1);c.acceptCatalog(base);c.setQuantity(itemId,1);
 clock=65000;
 assert.equal(c.snapshot().stage,'CATALOG_EXPIRED');
 assert.equal(c.snapshot().estimatedSubtotalPyg,null);
 assert.equal(c.previewRequest(key).code,'CATALOG_EXPIRED');
 clock=1000;
});

test('logout limpia sucursal, catálogo, líneas y subtotal',()=>{
 const c=cart();c.selectBranch(b1);c.acceptCatalog(base);c.setQuantity(itemId,1);c.clear();
 const snap=c.snapshot();assert.equal(snap.branchId,null);assert.equal(snap.items.length,0);
 assert.equal(snap.catalogVersion,null);assert.equal(snap.estimatedSubtotalPyg,null);
});

test('catálogo bloquea campos inesperados de privacidad tanto en envoltura como artículos',()=>{
 const cases=[
  {...base,customerPhone:'0981000000'},
  {...base,items:[{...base.items[0],driverEmail:'secret@example.test'}]},
  {...base,items:[{...base.items[0],serviceRole:'never'}]},
  {...base,items:[{...base.items[0],documentUrl:'https://example.test/kyc'}]},
  {...base,items:[{...base.items[0],customerId:b2}]},
  {...base,items:[{itemId,...base.items[0],stockUnits:undefined}]}
 ];
 for(const candidate of cases)
  assert.equal(projectCatalog(candidate,{branchId:b1,now:clock}),null);
 // nextCursor solo es metadato permitido por el paginador; no entra al resultado.
 const cursorPayload={...base,nextCursor:'C'.repeat(44)};
 const projected=projectCatalog(cursorPayload,{branchId:b1,now:clock});
 assert.ok(projected);
 assert.equal(Object.hasOwn(projected,'nextCursor'),false);
});
test('Fuzz determinista de límites/version/UUID/tag/precio/stock no admite valores peligrosos',()=>{
 const bad=[
  {version:''},{version:'bad version'},{version:'x'.repeat(81)},
  {version:'<script>'},{branchId:b2},{branchId:'not-uuid'},
  {expiresAt:clock},{expiresAt:clock+300001},{expiresAt:NaN},
  {expiresAt:Infinity},{expiresAt:'65000'},{items:'not-list'},
  {items:new Array(101).fill(base.items[0])}
 ];
 for(const patch of bad)
  assert.equal(projectCatalog({...base,...patch},{branchId:b1,now:clock}),null);
 const mutations=[
  ['itemId',null],['itemId','bad-uuid'],['itemTag','<IMG>'],
  ['itemTag','Farmacia ✨'],['itemTag','X'],['itemTag','A'.repeat(51)],
  ['itemClass','PRESCRIPTION'],['itemClass','DRIVER'],
  ['active',1],['active','true'],['unitPricePyg',99],
  ['unitPricePyg',10000001],['unitPricePyg',NaN],
  ['unitPricePyg',Infinity],['unitPricePyg',Number.MAX_SAFE_INTEGER],
  ['unitPricePyg',200.5],['stockUnits',-1],['stockUnits',1000001],
  ['stockUnits',1.2],['stockUnits',Infinity],['stockUnits',Number.MAX_SAFE_INTEGER]
 ];
 for(let i=0;i<300;i++){
  const [key,value]=mutations[i%mutations.length];
  const altered={...base.items[0],[key]:value};
  const badCatalog={...base,items:[altered]};
  assert.equal(projectCatalog(badCatalog,{branchId:b1,now:clock}),null,
   'mutation '+i+' '+key);
 }
 const c=cart();c.selectBranch(b1);c.acceptCatalog(base);
 const invalidQuantities=[-1,0.5,1000,NaN,Infinity,Number.MAX_SAFE_INTEGER,'2',null];
 for(const qty of invalidQuantities)
  assert.equal(c.setQuantity(itemId,qty).code,'INVALID_ITEM');
 assert.equal(c.snapshot().estimatedSubtotalPyg,0);
 assert.equal(c.snapshot().finalTotalPyg,null);
});
