import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMERCE_VERTICALS,validateCommerceSearch,selectCommerceVertical,
 filterVerifiedCatalogPage,filterVerifiedBranchPage} from './commerce-storefront.mjs';

const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const product=(tag,extra={})=>({itemId:id(2),itemTag:tag,itemClass:'GENERAL',
 active:true,unitPricePyg:12500,stockUnits:5,...extra});
const branch=(kind,extra={})=>({branchId:id(1),branchTag:'Mercado central',
 merchantKind:kind,eligibleByPolicy:false,orderEnabled:false,...extra});

test('R37 separa cinco rubros y no habilita categorías desconocidas',()=>{
 assert.deepEqual(COMMERCE_VERTICALS.map(x=>x.code),
  ['SUPERMARKET','PHARMACY','RESTAURANT','RETAIL','OTHER']);
 assert.equal(selectCommerceVertical('PHARMACY')?.label,'Farmacias');
 assert.equal(selectCommerceVertical('MOTO_PASSENGER'),null);
 assert.equal(Object.isFrozen(COMMERCE_VERTICALS),true);
});
test('R37 nunca muestra catálogo sin autorización y frescura comprobadas',()=>{
 assert.equal(filterVerifiedCatalogPage([product('Leche')]).code,'CATALOG_NOT_VERIFIED');
 assert.deepEqual(filterVerifiedCatalogPage([product('Leche')]).items,[]);
 assert.equal(filterVerifiedBranchPage([branch('SUPERMARKET')],{vertical:'SUPERMARKET'}).code,
  'BRANCH_PAGE_NOT_VERIFIED');
});
test('R37 búsqueda tolera acentos, mayúsculas, espacios y subrayado',()=>{
 const items=[product('CAFÉ MOLIDO'),product('LECHE_ENTERA'),product('Pan integral')];
 const found=filterVerifiedCatalogPage(items,{query:'cafe',verified:true});
 assert.equal(found.ok,true);
 assert.deepEqual(found.items.map(x=>x.itemTag),['CAFÉ MOLIDO']);
 assert.equal(filterVerifiedCatalogPage(items,{query:'leche entera',verified:true}).items.length,1);
 assert.equal(filterVerifiedCatalogPage(items,{query:' PAN ',verified:true}).items.length,1);
 assert.equal(found.scope,'CURRENT_VERIFIED_PAGE_ONLY');
 assert.equal(found.globalTotalKnown,false);
 assert.equal(found.checkoutEnabled,false);
});
test('R37 filtra únicamente la página, no infiere ausencia total de sucursales',()=>{
 const items=[branch('SUPERMARKET'),branch('PHARMACY',{branchId:id(3)})];
 const result=filterVerifiedBranchPage(items,{vertical:'PHARMACY',verified:true});
 assert.equal(result.ok,true);
 assert.deepEqual(result.items.map(x=>x.merchantKind),['PHARMACY']);
 assert.equal(result.scope,'CURRENT_VERIFIED_PAGE_ONLY');
 assert.equal(result.globalTotalKnown,false);
 assert.equal(result.ordersEnabled,false);
});
test('R37 no muestra productos inactivos ni fabrica existencias o descuentos',()=>{
 const items=[product('Yerba mate',{stockUnits:0}),product('Descontinuado',{active:false})];
 const r=filterVerifiedCatalogPage(items,{verified:true});
 assert.equal(r.ok,true);
 assert.deepEqual(r.items.map(x=>x.itemTag),['Yerba mate']);
 assert.equal(r.items[0].stockUnits,0);
 assert.equal(Object.hasOwn(r.items[0],'discount'),false);
 assert.equal(Object.isFrozen(r.items),true);
});
test('R37 rechaza búsquedas con PII de control, bidi, HTML y caracteres excesivos',()=>{
 for(const q of ['A'.repeat(65),'<script>', 'Limpieza\nCocina','item\u202eevil'])
  assert.equal(validateCommerceSearch(q).ok,false);
 assert.equal(validateCommerceSearch('').ok,true);
 assert.equal(filterVerifiedCatalogPage([product('Arroz')],{query:'<script>',
  verified:true}).code,'INVALID_SEARCH');
});
test('R37 descarta páginas manipuladas, capacidades true y precios mal formados',()=>{
 for(const bad of [
  [{...product('Arroz'),unitPricePyg:-10}],
  [{...product('Arroz'),stockUnits:Infinity}],
  [{...product('Arroz'),active:'yes'}],
  [{...product('Arroz'),itemTag:null}],
  Array(1001).fill(product('Arroz'))
 ])assert.equal(filterVerifiedCatalogPage(bad,{verified:true}).ok,false);
 assert.equal(filterVerifiedBranchPage([branch('PHARMACY',{orderEnabled:true})],
  {vertical:'PHARMACY',verified:true}).ok,false);
 assert.equal(filterVerifiedBranchPage([branch('DRUGS')],{vertical:'PHARMACY',
  verified:true}).ok,false);
});
test('R37 admite hasta 100 registros de sucursal por página, sin techo global',()=>{
 const items=Array.from({length:100},(_,i)=>branch('SUPERMARKET',{branchId:id(i+1)}));
 assert.equal(filterVerifiedBranchPage(items,{vertical:'SUPERMARKET',verified:true}).items.length,100);
 assert.equal(filterVerifiedBranchPage([...items,branch('SUPERMARKET')],
  {vertical:'SUPERMARKET',verified:true}).code,'INVALID_BRANCH_PAGE');
});
