import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCommerceItemAccessible,projectCommercePageAccessible} from './commerce-accessible-summary.mjs';
const item=()=>({
 itemId:'123e4567-e89b-42d3-a456-000000000001',itemTag:'ARROZ_INTEGRAL',
 itemClass:'GENERAL',active:true,unitPricePyg:12500,stockUnits:7
});
test('R51 a11y renders local cart quantity and guaranies without promising a purchase',()=>{
 const x=projectCommerceItemAccessible(item(),{verified:true,quantity:3});
 assert.equal(x.ok,true);
 assert.match(x.description,/12\.500 guaraníes/);
 assert.match(x.description,/En carrito: 3/);
 assert.match(x.description,/Stock informado: 7/);
 assert.equal(x.stockReserved,false);
 assert.equal(x.noOrderConfirmed,true);
 assert.match(x.addHint,/No confirma compra/);
});
test('R51 prevents unverified products from becoming screen reader announcements',()=>{
 assert.deepEqual(projectCommerceItemAccessible(item()),{ok:false,code:'PAGE_NOT_VERIFIED'});
});
test('R51 never echoes extra PII fields from an untrusted item',()=>{
 for(const ext of [{phone:'0981111222'},{customerName:'PERSON'}, {merchantAddress:'HOME'}]){
  const x=projectCommerceItemAccessible({...item(),...ext},{verified:true});
  assert.equal(x.ok,false);
  assert.equal(JSON.stringify(x).includes(Object.values(ext)[0]),false);
 }
});
test('R51 invalid or manipulative item tags fail closed',()=>{
 for(const itemTag of ['<script>','TELEFONO 0981','a'.repeat(130),'X','A\u202eB']){
  assert.equal(projectCommerceItemAccessible({...item(),itemTag},{verified:true}).ok,false);
 }
});
test('R51 zero stock is a valid read-only description, with disabled add hint',()=>{
 const x=projectCommerceItemAccessible({...item(),stockUnits:0},{verified:true,quantity:0});
 assert.equal(x.ok,true);
 assert.match(x.addHint,/No se puede agregar/);
 assert.match(x.removeHint,/No hay unidades/);
});
test('R51 quantity or stock tampering never produces an accessible product offer',()=>{
 for(const quantity of [-1,8,1000,NaN,1.4]){
  assert.equal(projectCommerceItemAccessible(item(),{verified:true,quantity}).ok,false);
 }
 for(const stockUnits of [-1,NaN,Infinity,1000001]){
  assert.equal(projectCommerceItemAccessible({...item(),stockUnits},{verified:true}).ok,false);
 }
});
test('R51 hidden or non-OTC categories cannot be announced as purchasable',()=>{
 for(const change of [{active:false},{itemClass:'PRESCRIPTION'},
  {unitPricePyg:-1},{unitPricePyg:10000001}]){
  assert.equal(projectCommerceItemAccessible({...item(),...change},{verified:true}).ok,false);
 }
});
test('R51 current page summary never claims global inventory',()=>{
 const x=projectCommercePageAccessible({verified:true,kind:'CATALOG',
  pageNumber:3,visibleCount:8});
 assert.equal(x.ok,true);
 assert.match(x.summary,/Página 3: 8 productos/);
 assert.match(x.summary,/solo en esta página/);
 assert.equal(x.globalTotalKnown,false);
 assert.equal(x.orderConfirmed,false);
});
test('R51 empty directory page does not claim no shops in a city',()=>{
 const x=projectCommercePageAccessible({verified:true,kind:'BRANCHES',
  pageNumber:2,visibleCount:0});
 assert.equal(x.ok,true);
 assert.match(x.summary,/Podés revisar otras páginas/);
 assert.doesNotMatch(x.summary,/sin comercios en tu ciudad/);
});
test('R51 loading or expired pages never announce stale row counts',()=>{
 for(const config of [{verified:false},{verified:true,loading:true}]){
  assert.equal(projectCommercePageAccessible(config).code,'PAGE_NOT_VERIFIED');
 }
});
test('R51 no platform-wide 50 record cap: only page <=100',()=>{
 assert.equal(projectCommercePageAccessible({verified:true,visibleCount:100}).ok,true);
 assert.equal(projectCommercePageAccessible({verified:true,visibleCount:101}).code,'INVALID_PAGE');
});
test('R51 invalid page numbers are discarded',()=>{
 for(const pageNumber of [0,-1,1.5,NaN,Infinity]){
  assert.equal(projectCommercePageAccessible({verified:true,pageNumber}).ok,false);
 }
});
