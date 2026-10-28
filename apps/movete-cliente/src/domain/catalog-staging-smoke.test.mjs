import test from 'node:test';
import assert from 'node:assert/strict';
import {createBuyerCatalogStagingSmoke} from './catalog-staging-smoke.mjs';
const t=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const actor=()=>({role:'passenger',subject:id(1),sessionRevision:7});
const page=()=>({branchId:id(2),version:'catalog-1',expiresAt:t+60000,
 items:[{itemId:id(3),itemTag:'ARROZ_1KG',itemClass:'GENERAL',
 active:true,unitPricePyg:8500,stockUnits:15}],nextCursor:null});
const make=(props={})=>createBuyerCatalogStagingSmoke({
 enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 getActor:async()=>actor(),readPage:async()=>({ok:true,status:200,data:page()}),
 now:()=>t,...props
});
test('default OFF no crea una URL ni puede consultar un servicio inexistente',async()=>{
 let calls=0;
 const smoke=createBuyerCatalogStagingSmoke({readPage:async()=>{calls++;}});
 assert.equal(smoke.isConfigured(),false);
 assert.equal((await smoke.probe(id(2))).code,'BUYER_CATALOG_RUNTIME_NOT_VERIFIED');
 assert.equal(smoke.snapshot().liveOrdersEnabled,false);
 assert.equal(calls,0);
});
test('handshake QA acepta metadata propia sin exponer artículos o precios',async()=>{
 let args;
 const smoke=make({readPage:async(branch,identity)=>{
  args={branch,identity};return {ok:true,status:200,data:page()};
 }});
 const outcome=await smoke.probe(id(2));
 assert.equal(outcome.ok,true);
 assert.deepEqual(args,{branch:id(2),identity:{cursor:null,subject:id(1),sessionRevision:7}});
 assert.equal(outcome.itemsOnPage,1);
 assert.equal(outcome.globalTotalKnown,false);
 assert.equal(Object.hasOwn(outcome,'items'),false);
 assert.equal(Object.hasOwn(outcome,'unitPricePyg'),false);
 assert.equal(outcome.liveOrdersEnabled,false);
 assert.equal(outcome.paymentsEnabled,false);
});
test('401/403/404/409/429/503 fail closed sin fingir catálogo ni pedido',async()=>{
 for(const [status,code] of [
  [401,'AUTH_REQUIRED'],[403,'FORBIDDEN'],[404,'BRANCH_NOT_FOUND'],
  [409,'CATALOG_CONFLICT'],[429,'RATE_LIMITED'],[503,'SERVICE_UNAVAILABLE']
 ]){
  const smoke=make({readPage:async()=>({ok:false,status})});
  assert.equal((await smoke.probe(id(2))).code,code);
  assert.equal(smoke.snapshot().globalTotalKnown,false);
 }
});
test('TTL, PII, versión y cursor extraño rechazan páginas contaminadas',async()=>{
 const bad=[
  {...page(),expiresAt:t-1},
  {...page(),nextCursor:'short'},
  {...page(),customerPhone:'0981111111'},
  {...page(),items:[{...page().items[0],passport:'secret'}]},
  {...page(),version:''},
  {...page(),branchId:id(44)}
 ];
 for(const data of bad){
  const smoke=make({readPage:async()=>({ok:true,status:200,data})});
  assert.equal((await smoke.probe(id(2))).code,'INVALID_CATALOG_PAGE');
 }
});
test('revoke/logout durante Identity o GET invalida el probe sin publicar datos',async()=>{
 let releaseAuth,hits=0;
 const pendingAuth=new Promise(resolve=>{releaseAuth=resolve;});
 const smoke=make({getActor:()=>pendingAuth,
  readPage:async()=>{hits++;return {ok:true,status:200,data:page()};}});
 const task=smoke.probe(id(2));
 assert.equal((await smoke.probe(id(2))).code,'CATALOG_PROBE_IN_FLIGHT');
 smoke.clear();releaseAuth(actor());
 assert.equal((await task).code,'STALE_RESPONSE_IGNORED');
 assert.equal(hits,0);
 let identity=actor(),release;
 const pending=new Promise(resolve=>{release=resolve;});
 const swapped=make({getActor:async()=>identity,readPage:async()=>pending});
 const task2=swapped.probe(id(2));
 await Promise.resolve();await Promise.resolve();
 identity={...identity,subject:id(12),sessionRevision:8};
 release({ok:true,status:200,data:page()});
 assert.equal((await task2).code,'STALE_SESSION_RESPONSE');
});
