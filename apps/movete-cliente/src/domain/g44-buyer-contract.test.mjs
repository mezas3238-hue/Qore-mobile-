import test from 'node:test';
import assert from 'node:assert/strict';
import {projectG44BuyerCatalog,projectG44BuyerBranches,
 createG44BuyerCatalogAdapter} from './g44-buyer-contract.mjs';
import {createCommerceCatalogPager} from './commerce-catalog-pages.mjs';
const now=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const branch=id(1),subject=id(2);
const item=()=>({itemId:id(3),itemTag:'ARROZ_1KG',itemClass:'GENERAL',
 active:true,unitPricePyg:4500,stockUnits:3});
const catalog=()=>({branchId:branch,version:42,expiresAt:now+60000,
 items:[item()],nextCursor:null,orderEnabled:false,eligibleByPolicy:false,
 snapshotConsistent:false,productionEnabled:false});
const municipality='Asunción',serviceKind='MOTO_DELIVERY';
const branches=()=>({municipality,serviceKind,items:[{
 branchId:branch,branchTag:'SUCURSAL_CENTRO',merchantKind:'SUPERMARKET',
 municipality,serviceKind,eligibleByPolicy:false,orderEnabled:false
}],nextCursor:null,orderEnabled:false,productionEnabled:false});
test('G44 catalog int64 se proyecta como versión B opaca sin pedidos',()=>{
 const r=projectG44BuyerCatalog(catalog(),{branchId:branch,now});
 assert.equal(r.version,'g44:42');
 assert.equal(r.items.length,1);
 assert.equal(r.ordersEnabled,false);
 assert.equal(r.paymentsEnabled,false);
 assert.equal(Object.hasOwn(r,'productionEnabled'),false);
});
test('G44 rechaza flags de comercio real, PII, precios ajenos y revisiones inseguras',()=>{
 const invalid=[
  {...catalog(),orderEnabled:true},{...catalog(),eligibleByPolicy:true},
  {...catalog(),productionEnabled:true},{...catalog(),snapshotConsistent:true},
  {...catalog(),version:0},{...catalog(),version:'42'},
  {...catalog(),version:Number.MAX_SAFE_INTEGER+1},
  {...catalog(),customerPhone:'0981000000'},
  {...catalog(),nextCursor:'invalid'},
  {...catalog(),branchId:id(9)},
  {...catalog(),items:[{...item(),stockUnits:0}]},
  {...catalog(),items:[{...item(),active:false}]},
  {...catalog(),items:[{...item(),buyerName:'secreto'}]},
  {...catalog(),items:[item(),item()]},
  {...catalog(),expiresAt:now-1}
 ];
 for(const body of invalid)
  assert.equal(projectG44BuyerCatalog(body,{branchId:branch,now}),null);
});
test('G44 branches filtra servicio, municipio y campos privados',()=>{
 const good=projectG44BuyerBranches(branches(),{municipality,serviceKind});
 assert.equal(good.items.length,1);
 assert.equal(good.ordersEnabled,false);
 assert.equal(Object.hasOwn(good.items[0],'driverId'),false);
 const invalid=[
  {...branches(),orderEnabled:true},
  {...branches(),nextCursor:'bad'},
  {...branches(),serviceKind:'AUTO_RIDE'},
  {...branches(),items:[{...branches().items[0],driverPhone:'0981000000'}]},
  {...branches(),items:[{...branches().items[0],eligibleByPolicy:true}]},
  {...branches(),items:[branches().items[0],branches().items[0]]}
 ];
 for(const candidate of invalid)
  assert.equal(projectG44BuyerBranches(candidate,{municipality,serviceKind}),null);
});
test('G44 adapter OFF no consulta transporte con contrato no montado',async()=>{
 let hits=0;
 const adapter=createG44BuyerCatalogAdapter({
  enabled:true,contractCertified:true,stagingRuntimeVerified:false,
  readBuyerCatalog:async()=>{hits++;return {ok:true,status:200,data:catalog()};},
  now:()=>now
 });
 assert.equal(adapter.isConfigured(),false);
 assert.equal((await adapter.readCatalogPage(branch,{
  cursor:null,subject,sessionRevision:1})).code,'G44_RUNTIME_NOT_CERTIFIED');
 assert.equal(hits,0);
});
test('G44 adapter tipado alimenta pager de muchas páginas, sin checkout',async()=>{
 const cursor=n=>'C'+String(n).padStart(43,'0');
 let reads=0;
 const adapter=createG44BuyerCatalogAdapter({
  enabled:true,contractCertified:true,stagingRuntimeVerified:true,
  now:()=>now,readBuyerCatalog:async(_,context)=>{
   reads++;
   const n=context.cursor?Number(context.cursor.slice(1))+1:1;
   return {ok:true,status:200,data:{...catalog(),version:42,
    items:[{...item(),itemId:id(n+10)}],nextCursor:n<110?cursor(n):null}};
  }
 });
 const pager=createCommerceCatalogPager({gateway:adapter,now:()=>now,
  getActor:async()=>({role:'passenger',subject,sessionRevision:1})});
 assert.equal((await pager.load({branchId:branch})).ok,true);
 for(let n=1;n<110;n++)
  assert.equal((await pager.load({branchId:branch,next:true})).ok,true);
 assert.equal(reads,110);
 assert.equal(pager.snapshot().pageNumber,110);
 assert.equal(pager.snapshot().globalTotalKnown,false);
 assert.equal(pager.snapshot().ordersEnabled,false);
 assert.equal(pager.snapshot().hasNext,false);
});
test('G44 adapter rechaza 401/403/409/429/503 y no inventa precios',async()=>{
 for(const [status,code] of [
  [401,'AUTH_REQUIRED'],[403,'FORBIDDEN'],[409,'CATALOG_REVISION_CHANGED'],
  [429,'RATE_LIMITED'],[503,'SERVICE_UNAVAILABLE']
 ]){
  const x=createG44BuyerCatalogAdapter({enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,readBuyerCatalog:async()=>({ok:false,status})});
  const result=await x.readCatalogPage(branch,{cursor:null,subject,sessionRevision:1});
  assert.equal(result.code,code);
  assert.equal(Object.hasOwn(result,'data'),false);
 }
});
