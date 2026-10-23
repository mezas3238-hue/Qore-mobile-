import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommerceCatalogPager} from './commerce-catalog-pages.mjs';
const time=1800000000000;
const uuid=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const branch=uuid(1);
const actor=()=>({role:'passenger',subject:uuid(2),sessionRevision:4});
const cursor=n=>'C'+String(n).padStart(43,'0');
const row=n=>({itemId:uuid(n+100),itemTag:'ITEM_'+n,itemClass:'GENERAL',
 active:true,unitPricePyg:1500,stockUnits:5});
const page=(index,nextCursor=index<3?cursor(index):null)=>({
 branchId:branch,version:'catalog-rev7',expiresAt:time+120000,
 items:[row(index)],nextCursor
});
const gw=(readCatalogPage,flags={})=>({
 enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 isConfigured:()=>true,readCatalogPage,...flags
});
const make=(reader,who=async()=>actor())=>createCommerceCatalogPager({
 gateway:reader,getActor:who,now:()=>time
});
test('sin contrato A montado no llama a la API ni crea precios o productos',async()=>{
 let hits=0;
 const x=make(gw(async()=>{hits++;return {ok:true,data:page(1)};},
  {stagingRuntimeVerified:false}));
 assert.equal((await x.load({branchId:branch})).code,'CATALOG_PAGING_NOT_CERTIFIED');
 assert.equal(hits,0);
 assert.equal(x.snapshot().visibleItems.length,0);
 assert.equal(x.snapshot().paymentsEnabled,false);
});
test('avanzar y retroceder consulta servidor y nunca retiene productos antiguos',async()=>{
 const seen=[];
 const x=make(gw(async(_branch,{cursor:anchor,...identity})=>{
  seen.push({anchor,identity});
  const n=anchor===null?1:Number(anchor.slice(1))+1;
  return {ok:true,data:page(n)};
 }));
 await x.load({branchId:branch});
 assert.equal(x.snapshot().visibleItems[0].itemTag,'ITEM_1');
 await x.load({branchId:branch,next:true});
 await x.load({branchId:branch,next:true});
 assert.equal(x.snapshot().pageNumber,3);
 assert.equal(x.snapshot().visibleItems.length,1);
 assert.equal(x.snapshot().visibleItems[0].itemTag,'ITEM_3');
 assert.equal((await x.load({branchId:branch,previous:true})).ok,true);
 assert.equal(x.snapshot().pageNumber,2);
 assert.equal(x.snapshot().visibleItems[0].itemTag,'ITEM_2');
 assert.deepEqual(seen.map(x=>x.anchor),[null,cursor(1),cursor(2),cursor(1)]);
 assert.deepEqual(seen[0].identity,{subject:uuid(2),sessionRevision:4});
 assert.equal(x.snapshot().globalTotalKnown,false);
});
test('cientos de páginas, 100 elementos cada una, sin límite global',async()=>{
 const perPage=100;
 const x=make(gw(async(_branch,{cursor:anchor})=>{
  const n=anchor===null?1:Number(anchor.slice(1))+1;
  return {ok:true,data:{...page(n,n<130?cursor(n):null),
   items:Array.from({length:perPage},(_,i)=>row((n-1)*perPage+i+1))}};
 }));
 assert.equal((await x.load({branchId:branch})).ok,true);
 for(let i=1;i<130;i++)assert.equal((await x.load({branchId:branch,next:true})).ok,true);
 assert.equal(x.snapshot().pageNumber,130);
 assert.equal(x.snapshot().visibleItems.length,100);
 assert.equal(x.snapshot().globalTotalKnown,false);
 assert.equal(x.snapshot().hasNext,false);
 assert.equal(x.snapshot().ordersEnabled,false);
});
test('salto de sucursal o cursor no verificado provoca bloqueo, no consulta',async()=>{
 let calls=0;
 const x=make(gw(async()=>{calls++;return {ok:true,data:page(1)};}));
 assert.equal((await x.load({branchId:'not-uuid'})).code,'INVALID_BRANCH_OR_DIRECTION');
 assert.equal((await x.load({branchId:branch,next:true})).code,'NO_NEXT_PAGE');
 assert.equal((await x.load({branchId:branch,previous:true})).code,'NO_PREVIOUS_PAGE');
 assert.equal((await x.load({branchId:branch,next:true,previous:true})).code,
  'INVALID_BRANCH_OR_DIRECTION');
 assert.equal(calls,0);
});
test('cambio de versión, expiración o sucursal no expone precios anteriores',async()=>{
 for(const body of [
  {...page(2),version:'rev8'}, {...page(2),expiresAt:time+100000},
  {...page(2),branchId:uuid(99)}
 ]){
  let n=0;const x=make(gw(async()=>{
   n++;return {ok:true,data:n===1?page(1):body};
  }));
  await x.load({branchId:branch});
  assert.equal((await x.load({branchId:branch,next:true})).ok,false);
  assert.equal(x.snapshot().visibleItems.length,0);
 }
});
test('datos extra/PII no entran al pager',async()=>{
 const x=make(gw(async()=>({ok:true,data:{...page(1),customerPhone:'0981123456'}})));
 assert.equal((await x.load({branchId:branch})).code,'INVALID_CATALOG_PAGE');
 assert.equal(x.snapshot().visibleItems.length,0);
});
test('una cuenta rotada durante GET descarta el catálogo sin falsear precios',async()=>{
 let current=actor(),release;const pending=new Promise(r=>release=r);
 const x=make(gw(async()=>pending),async()=>current);
 const task=x.load({branchId:branch});
 await Promise.resolve();await Promise.resolve();
 current={...current,sessionRevision:5};release({ok:true,data:page(1)});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(x.snapshot().visibleItems.length,0);
});
test('logout aborta visualización de respuesta tardía',async()=>{
 let release;const pending=new Promise(r=>release=r);
 const x=make(gw(async()=>pending));
 const task=x.load({branchId:branch});
 await Promise.resolve();await Promise.resolve();
 x.clear();release({ok:true,data:page(1)});
 assert.equal((await task).code,'STALE_RESPONSE_IGNORED');
 assert.equal(x.snapshot().visibleItems.length,0);
});
test('cursor repetido o inválido no perpetúa paginación',async()=>{
 const x=make(gw(async()=>({ok:true,data:page(1,'bad')})));
 assert.equal((await x.load({branchId:branch})).code,'INVALID_CATALOG_PAGE');
 assert.equal(x.snapshot().hasNext,false);
 const y=make(gw(async()=>({ok:true,data:page(1,cursor(1))})));
 await y.load({branchId:branch});
 assert.equal((await y.load({branchId:branch,next:true})).code,'CURSOR_REPEATED');
 assert.equal(y.snapshot().visibleItems.length,0);
});

test('dos taps mientras getActor no resuelve no lanzan dos lecturas',async()=>{
 let release,hits=0;
 const paused=new Promise(resolve=>release=resolve);
 const x=createCommerceCatalogPager({
  now:()=>time,getActor:()=>paused,
  gateway:gw(async()=>{hits++;return {ok:true,data:page(1)};})
 });
 const first=x.load({branchId:branch});
 assert.equal((await x.load({branchId:uuid(9)})).code,'CATALOG_PAGE_IN_FLIGHT');
 release(actor());
 assert.equal((await first).ok,true);
 assert.equal(hits,1);
 assert.equal(x.snapshot().branchId,branch);
});
test('logout durante validación de identidad no recupera una página privada',async()=>{
 let release,hits=0;
 const paused=new Promise(resolve=>release=resolve);
 const x=createCommerceCatalogPager({
  now:()=>time,getActor:()=>paused,
  gateway:gw(async()=>{hits++;return {ok:true,data:page(1)};})
 });
 const req=x.load({branchId:branch});
 x.clear();release(actor());
 assert.equal((await req).code,'STALE_RESPONSE_IGNORED');
 assert.equal(hits,0);
 assert.equal(x.snapshot().visibleItems.length,0);
});
test('autenticación rechazada al cambiar cuenta purga catálogo anterior',async()=>{
 let identity=actor();
 const x=make(gw(async()=>({ok:true,data:page(1)})),async()=>identity);
 await x.load({branchId:branch});
 identity={role:'driver',subject:uuid(2),sessionRevision:5};
 assert.equal((await x.load({branchId:branch})).code,'AUTH_REQUIRED');
 assert.equal(x.snapshot().visibleItems.length,0);
});

test('snapshot oculta precios mientras otra página está en vuelo',async()=>{
 let release,hits=0;
 const suspended=new Promise(resolve=>{release=resolve;});
 const x=make(gw(async()=>{
  hits++;return hits===1?{ok:true,data:page(1)}:suspended;
 }));
 assert.equal((await x.load({branchId:branch})).ok,true);
 assert.equal(x.snapshot().visibleItems.length,1);
 const task=x.load({branchId:branch,next:true});
 assert.equal(x.snapshot().loading,true);
 assert.equal(x.snapshot().visibleItems.length,0);
 assert.equal(x.snapshot().version,null);
 assert.equal(x.snapshot().pageNumber,0);
 assert.equal(x.snapshot().hasPrevious,false);
 assert.equal(x.snapshot().hasNext,false);
 release({ok:true,data:page(2)});
 assert.equal((await task).ok,true);
 assert.equal(x.snapshot().visibleItems[0].itemTag,'ITEM_2');
 assert.equal(x.snapshot().pageNumber,2);
});
test('clear durante consulta permite nueva sesión sin revivir precios anteriores',async()=>{
 let releaseOld,n=0;
 const pending=new Promise(resolve=>{releaseOld=resolve;});
 const x=make(gw(async()=>{n++;return n===1?pending:{ok:true,data:page(1)};}));
 const first=x.load({branchId:branch});
 await Promise.resolve();await Promise.resolve();
 x.clear();
 const second=x.load({branchId:branch});
 assert.equal((await second).ok,true);
 releaseOld({ok:true,data:page(2)});
 assert.equal((await first).code,'STALE_RESPONSE_IGNORED');
 assert.equal(x.snapshot().visibleItems[0].itemTag,'ITEM_1');
 assert.equal(x.snapshot().loading,false);
});
