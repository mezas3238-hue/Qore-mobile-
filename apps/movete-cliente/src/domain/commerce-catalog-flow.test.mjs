import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommerceCatalogFlow} from './commerce-catalog-flow.mjs';
const now=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const actor=()=>({subject:id(1),role:'passenger',sessionRevision:2});
const catalog=()=>({branchId:id(2),version:'catalog-1',expiresAt:now+60000,
 items:[{itemId:id(3),itemTag:'ARROZ_1KG',itemClass:'GENERAL',
 active:true,unitPricePyg:8500,stockUnits:5}]});
const gateway=(readCatalog,flags={})=>({
 enabled:true,stagingRuntimeVerified:true,contractCertified:true,
 isConfigured:()=>true,readCatalog,...flags
});
const create=(gw,who=async()=>actor())=>createCommerceCatalogFlow({
 gateway:gw,getActor:who,now:()=>now
});
test('sin contrato buyer real, catálogo no llama red ni inventa productos',async()=>{
 let hits=0;
 const flow=create(gateway(async()=>{hits++;return {ok:true,data:catalog()};},
  {stagingRuntimeVerified:false}));
 assert.equal((await flow.loadCatalog(id(2))).code,'CATALOG_READ_NOT_CERTIFIED');
 assert.equal(flow.snapshot().catalogItems.length,0);
 assert.equal(flow.snapshot().checkoutEnabled,false);
 assert.equal(hits,0);
});
test('catálogo inyectado y versionado admite carrito privado; jamás checkout',async()=>{
 let args;
 const flow=create(gateway(async(branch,identity)=>{
  args={branch,identity};return {ok:true,data:catalog()};
 }));
 assert.equal((await flow.loadCatalog(id(2))).ok,true);
 assert.deepEqual(args,{branch:id(2),identity:actor()});
 assert.equal(flow.snapshot().catalogItems[0].unitPricePyg,8500);
 assert.equal(flow.changeQuantity(id(3),2).ok,true);
 assert.equal(flow.snapshot().estimatedSubtotalPyg,17000);
 const preview=flow.preview(id(4));
 assert.equal(preview.submissionAllowed,false);
 assert.equal(preview.reason,'ATOMIC_ORDER_CONTRACT_PENDING');
});
test('JWT rotado durante lectura descarta todo el catálogo anterior',async()=>{
 let active=actor(),finish;const promise=new Promise(r=>finish=r);
 const flow=create(gateway(()=>promise),async()=>active);
 const task=flow.loadCatalog(id(2));
 await Promise.resolve();await Promise.resolve();
 active={...active,sessionRevision:3};finish({ok:true,data:catalog()});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(flow.snapshot().catalogItems.length,0);
});
test('logout rechaza respuesta tardía sin restaurar precios',async()=>{
 let finish;const promise=new Promise(r=>finish=r);
 const flow=create(gateway(()=>promise));
 const task=flow.loadCatalog(id(2));await Promise.resolve();await Promise.resolve();
 flow.clear();finish({ok:true,data:catalog()});
 assert.equal((await task).code,'STALE_RESPONSE_IGNORED');
 assert.equal(flow.snapshot().catalogItems.length,0);
});
test('sucursal ajena o contenido inválido no se representa',async()=>{
 const flow=create(gateway(async()=>({ok:true,data:{...catalog(),branchId:id(8)}})));
 assert.equal((await flow.loadCatalog(id(2))).code,'INVALID_CATALOG');
 assert.equal(flow.snapshot().catalogItems.length,0);
});
test('error del servidor elimina precios y borrador que podrían estar vencidos',async()=>{
 let hits=0;
 const flow=create(gateway(async()=>{
  hits++;return hits===1?{ok:true,data:catalog()}:{ok:false,code:'SERVICE_UNAVAILABLE'};
 }));
 await flow.loadCatalog(id(2));flow.changeQuantity(id(3),2);
 assert.equal(flow.snapshot().estimatedSubtotalPyg,17000);
 assert.equal((await flow.loadCatalog(id(2))).code,'SERVICE_UNAVAILABLE');
 assert.equal(flow.snapshot().estimatedSubtotalPyg,null);
 assert.equal(flow.snapshot().items.length,0);
});
