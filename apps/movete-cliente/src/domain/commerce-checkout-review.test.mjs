import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCommerceBasket} from './commerce-checkout-review.mjs';

const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const clock=1800000000000;
const catalog=(n=1,patch={})=>({
 itemId:id(n),itemTag:n===1?'ARROZ_1KG':'JABON',
 itemClass:'GENERAL',active:true,unitPricePyg:n===1?9200:5000,
 stockUnits:12,...patch
});
const row=(n=1,quantity=2,patch={})=>({
 itemId:id(n),itemTag:n===1?'ARROZ_1KG':'JABON',
 quantity,unitPricePyg:n===1?9200:5000,
 lineSubtotalPyg:(n===1?9200:5000)*quantity,...patch
});
const cart=(patch={})=>({
 branchId:id(700),vehicleKind:'MOTO',
 catalogVersion:'g44:53',catalogExpiresAt:clock+60000,
 stage:'SERVER_CATALOG',stock:'SERVER_SNAPSHOT',
 items:[row()],catalogItems:[catalog()],
 estimatedSubtotalPyg:18400,finalTotalPyg:null,
 catalogReadReady:true,checkoutEnabled:false,paymentEnabled:false,
 serverOrderReceipt:null,...patch
});
const review=(c=cart(),options={})=>
 reviewCommerceBasket(c,{authenticated:true,now:clock,...options});

test('R38 presenta resumen privado congelado sin afirmar pago ni entrega',()=>{
 const r=review();
 assert.equal(r.ok,true);
 assert.equal(r.estimatedSubtotalPyg,18400);
 assert.equal(r.branchId,id(700));
 assert.equal(r.catalogVersion,'g44:53');
 assert.equal(r.lines[0].quantity,2);
 assert.equal(r.lines[0].lineSubtotalPyg,18400);
 for(const name of ['deliveryFeePyg','discountPyg','finalTotalPyg'])
  assert.equal(r[name],null);
 for(const name of ['checkoutEnabled','paymentEnabled','orderConfirmed',
  'stockReserved','deliveryAvailable'])assert.equal(r[name],false);
 assert.equal(Object.isFrozen(r),true);
 assert.equal(Object.isFrozen(r.lines),true);
 assert.equal(Object.isFrozen(r.lines[0]),true);
 assert.equal('requestKey' in r,false);
 assert.equal('orderId' in r,false);
});
test('R38 fail-closed cuando no hay sesión o catálogo certificado',()=>{
 assert.equal(review(cart(),{authenticated:false}).code,'AUTH_REQUIRED');
 for(const patch of [
  {catalogReadReady:false},{checkoutEnabled:true},{paymentEnabled:true},
  {serverOrderReceipt:{orderId:id(10)}},{serverOrderReceipt:undefined}
 ])assert.equal(review(cart(patch)).code,'COMMERCE_RUNTIME_NOT_CERTIFIED');
});
test('R38 no expone precios de catálogo vencido o no verificado',()=>{
 for(const patch of [
  {catalogExpiresAt:clock},{catalogExpiresAt:clock-1},
  {catalogExpiresAt:clock+300001},{catalogExpiresAt:null},
  {stage:'CATALOG_LOADING'},{stage:'CATALOG_EXPIRED'},
  {stock:'UNVERIFIED'}
 ]){
  const r=review(cart(patch));
  assert.equal(r.ok,false);
  assert.equal(r.code,'CATALOG_EXPIRED_OR_UNVERIFIED');
  assert.equal('estimatedSubtotalPyg' in r,false);
 }
});
test('R38 cero productos y cuenta cruzada o ámbito corrupto se rechazan',()=>{
 assert.equal(review(cart({items:[]})).code,'EMPTY_BASKET');
 for(const patch of [
  {branchId:id(7)+'?'},
  {branchId:null},{catalogVersion:'<bad>'},
  {catalogVersion:'other company'}, {vehicleKind:'BIKE'},
  {catalogVersion:null}
 ])assert.equal(review(cart(patch)).code,'INVALID_COMMERCE_SCOPE');
});
test('R38 detecta precio adulterado, cantidad sin stock y producto retirado',()=>{
 const cases=[
  [{items:[row(1,2,{unitPricePyg:9201})]},'PRICE_OR_CATALOG_CHANGED'],
  [{items:[row(1,13,{lineSubtotalPyg:119600})]},'STOCK_CHANGED'],
  [{catalogItems:[catalog(1,{active:false})]},'ITEM_UNAVAILABLE'],
  [{catalogItems:[]},'ITEM_UNAVAILABLE'],
  [{items:[row(1,2,{itemTag:'OTRO'})]},'PRICE_OR_CATALOG_CHANGED']
 ];
 for(const [patch,code] of cases)assert.equal(review(cart(patch)).code,code);
});
test('R38 no declara importe final con subtotal falso o manipulación aritmética',()=>{
 for(const patch of [
  {estimatedSubtotalPyg:18500},{estimatedSubtotalPyg:null},
  {finalTotalPyg:18400},
  {items:[row(1,2,{lineSubtotalPyg:1})]},
  {items:[row(1,2,{lineSubtotalPyg:18400.5})]}
 ]){
  const r=review(cart(patch));assert.equal(r.ok,false);
  assert.equal('finalTotalPyg' in r,false);
 }
});
test('R38 rechaza artículos duplicados y líneas con campos privados o corruptos',()=>{
 const duplicate=cart({items:[row(),row()],estimatedSubtotalPyg:36800});
 assert.equal(review(duplicate).code,'INVALID_BASKET_ROW');
 for(const patch of [
  {quantity:0},{quantity:1000},{quantity:NaN},
  {itemId:'../../admin'},{itemTag:null},
  {itemTag:'ARROZ_1KG',customerPhone:'0981000000'},
  {unitPricePyg:'9200'},
  {lineSubtotalPyg:null}
 ])assert.equal(review(cart({items:[row(1,2,patch)]})).code,'INVALID_BASKET_ROW');
});
test('R38 ignora cambios de orden siempre que precio, stock y suma coincidan',()=>{
 const rows=[row(1,2),row(2,1)];
 const products=[catalog(1),catalog(2)];
 const r=review(cart({items:rows.reverse(),catalogItems:products,
  estimatedSubtotalPyg:23400}));
 assert.equal(r.ok,true);
 assert.equal(r.lines.length,2);
 assert.equal(r.estimatedSubtotalPyg,23400);
});
test('R38 línea farmacéutica OTC, pero rechaza receta médica / campo inyectado',()=>{
 const otc=catalog(1,{itemClass:'PHARMACY_OTC'});
 assert.equal(review(cart({catalogItems:[otc]})).ok,true);
 assert.equal(review(cart({catalogItems:[{...otc,itemClass:'PRESCRIPTION'}]})).code,
  'INVALID_CATALOG_ROW');
 assert.equal(review(cart({catalogItems:[{...otc,customerId:id(8)}]})).code,
  'INVALID_CATALOG_ROW');
});
test('R38 no confunde 50 líneas por pedido con total global de comercios',()=>{
 const products=Array.from({length:50},(_,i)=>catalog(1,{
  itemId:id(i+1),itemTag:'ARTICULO_'+i,unitPricePyg:1000,stockUnits:4
 }));
 const rows=products.map(p=>({itemId:p.itemId,itemTag:p.itemTag,
  quantity:1,unitPricePyg:1000,lineSubtotalPyg:1000}));
 assert.equal(review(cart({items:rows,catalogItems:products,estimatedSubtotalPyg:50000})).ok,true);
 assert.equal(review(cart({items:[...rows,rows[0]],catalogItems:products,
  estimatedSubtotalPyg:51000})).code,'INVALID_BASKET');
});
test('R38 solo permite catálogo de máximo una página y campos tipados',()=>{
 for(const patch of [
  {catalogItems:Array(101).fill(catalog())},
  {catalogItems:[catalog(1,{itemTag:'<img>'})]},
  {catalogItems:[catalog(1,{itemId:null})]},
  {catalogItems:[catalog(1,{unitPricePyg:200.5})]},
  {catalogItems:[catalog(1,{stockUnits:-1})]}
 ])assert.equal(review(cart(patch)).ok,false);
});
test('R38 respuesta de error no filtra productos, importes o datos de sesión',()=>{
 const r=review(cart({items:[row(1,2,{unitPricePyg:'hack'})]}));
 assert.equal(r.ok,false);
 assert.equal(Object.keys(r).sort().join(','),
  'checkoutEnabled,code,ok,orderConfirmed,paymentEnabled');
 assert.equal(JSON.stringify(r).includes('ARROZ'),false);
});
