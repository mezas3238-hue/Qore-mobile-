import test from 'node:test';
import assert from 'node:assert/strict';
import {createG44BranchDirectory} from './g44-branch-directory.mjs';
const t=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const municipality='Asunción',serviceKind='MOTO_DELIVERY';
const actor=()=>({role:'passenger',subject:id(1),sessionRevision:4});
const cursor=n=>'C'+String(n).padStart(43,'0');
const page=(n,nextCursor=null)=>({municipality,serviceKind,
 items:[{branchId:id(n+100),branchTag:'SUCURSAL_'+n,merchantKind:'SUPERMARKET',
  municipality,serviceKind,eligibleByPolicy:false,orderEnabled:false}],
 nextCursor,orderEnabled:false,productionEnabled:false});
const create=(reader,flags={})=>createG44BranchDirectory({
 enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 now:()=>t,getActor:async()=>actor(),readBuyerBranches:reader,...flags
});
test('G44 branch directory OFF: no descubre sucursales ni llama red',async()=>{
 let hits=0;
 const x=create(async()=>{hits++;return {ok:true,status:200,data:page(1)};},
  {stagingRuntimeVerified:false});
 assert.equal(x.snapshot().readReady,false);
 assert.equal((await x.load({municipality,serviceKind})).code,
  'BRANCH_DIRECTORY_RUNTIME_NOT_CERTIFIED');
 assert.equal(hits,0);
});
test('G44 admite 120 páginas sin tope global de registros',async()=>{
 const calls=[];
 const x=create(async args=>{
  calls.push(args);
  const n=args.cursor?Number(args.cursor.slice(1))+1:1;
  return {ok:true,status:200,data:page(n,n<120?cursor(n):null)};
 });
 assert.equal((await x.load({municipality,serviceKind})).ok,true);
 for(let i=1;i<120;i++)
  assert.equal((await x.load({municipality,serviceKind,next:true})).ok,true);
 assert.equal(x.snapshot().pageNumber,120);
 assert.equal(x.snapshot().items.length,1);
 assert.equal(x.snapshot().hasNext,false);
 assert.equal(x.snapshot().globalTotalKnown,false);
 assert.equal(x.snapshot().ordersEnabled,false);
 assert.equal(x.snapshot().availabilityVerified,false);
 assert.equal(calls.length,120);
 assert.deepEqual(Object.keys(calls[0]).sort(),
  ['municipality','serviceKind','cursor','subject','sessionRevision'].sort());
});
test('G44 rechaza fila PII, cobertura falsa habilitada, filtro ajeno y cursor malicioso',async()=>{
 const bad=[
  {...page(1),items:[{...page(1).items[0],phone:'0981111111'}]},
  {...page(1),items:[{...page(1).items[0],orderEnabled:true}]},
  {...page(1),serviceKind:'AUTO_DELIVERY'},
  {...page(1),nextCursor:'../../'},
  {...page(1),productionEnabled:true}
 ];
 for(const data of bad){
  const x=create(async()=>({ok:true,status:200,data}));
  assert.equal((await x.load({municipality,serviceKind})).code,
   'INVALID_G44_BRANCH_PAGE');
  assert.equal(x.snapshot().items.length,0);
 }
});
test('G44 logout durante Auth permite sesión nueva sin revelar respuestas viejas',async()=>{
 let releaseAuth,hits=0;
 const auth=new Promise(resolve=>{releaseAuth=resolve;});
 const x=create(async()=>{hits++;return {ok:true,status:200,data:page(1)};},
  {getActor:()=>auth});
 const old=x.load({municipality,serviceKind});
 assert.equal((await x.load({municipality,serviceKind})).code,'BRANCH_DIRECTORY_IN_FLIGHT');
 x.clear();releaseAuth(actor());
 assert.equal((await old).code,'STALE_RESPONSE_IGNORED');
 assert.equal(x.snapshot().items.length,0);
 assert.equal(hits,0);
});
test('G44 páginas viejas no aparecen durante lectura ni luego de TTL local',async()=>{
 let tick=t,release,hits=0;
 const p=new Promise(resolve=>{release=resolve;});
 const x=create(async()=>{hits++;return hits===1?
  {ok:true,status:200,data:page(1,cursor(1))}:p;
 },{now:()=>tick});
 assert.equal((await x.load({municipality,serviceKind})).ok,true);
 const next=x.load({municipality,serviceKind,next:true});
 assert.equal(x.snapshot().loading,true);
 assert.equal(x.snapshot().items.length,0);
 release({ok:true,status:200,data:page(2)});
 assert.equal((await next).ok,true);
 assert.equal(x.snapshot().pageNumber,2);
 tick+=30001;
 assert.equal(x.snapshot().items.length,0);
 assert.equal(x.snapshot().pageNumber,0);
 assert.equal((await x.load({municipality,serviceKind,next:true})).code,'NO_NEXT_PAGE');
});
test('G44 no mezcla sucursales de diferentes municipios ni servicios',async()=>{
 const x=create(async()=>({ok:true,status:200,data:page(1,cursor(1))}));
 await x.load({municipality,serviceKind});
 assert.equal((await x.load({municipality:'San Lorenzo',serviceKind,next:true})).code,
  'NO_NEXT_PAGE');
 assert.equal((await x.load({municipality,serviceKind:'AUTO_DELIVERY',next:true})).code,
  'NO_NEXT_PAGE');
 assert.equal(x.snapshot().items.length,1);
});

test('R48 directorio entrega expiresAt explícito y oculta exactamente a 30 segundos',async()=>{
 let clock=t;
 const x=create(async()=>({ok:true,status:200,data:page(1,cursor(1))}),{
  now:()=>clock
 });
 assert.equal((await x.load({municipality,serviceKind})).ok,true);
 assert.equal(x.snapshot().expiresAt,t+30000);
 assert.equal(x.snapshot().items.length,1);
 clock=t+29999;
 assert.equal(x.snapshot().items.length,1);
 assert.equal(x.snapshot().hasNext,true);
 clock=t+30000;
 assert.equal(x.snapshot().expiresAt,null);
 assert.equal(x.snapshot().pageNumber,0);
 assert.equal(x.snapshot().items.length,0);
 assert.equal(x.snapshot().hasNext,false);
 assert.equal(x.snapshot().hasPrevious,false);
 assert.equal((await x.load({municipality,serviceKind,next:true})).code,'NO_NEXT_PAGE');
});
test('R48 no expone expiración ni sucursales durante GET pendiente',async()=>{
 let release;
 const deferred=new Promise(resolve=>{release=resolve;});
 let hits=0,clock=t;
 const x=create(async()=>{
  hits++;
  return hits===1?{ok:true,status:200,data:page(1,cursor(1))}:deferred;
 },{now:()=>clock});
 await x.load({municipality,serviceKind});
 const next=x.load({municipality,serviceKind,next:true});
 const pending=x.snapshot();
 assert.equal(pending.loading,true);
 assert.equal(pending.expiresAt,null);
 assert.equal(pending.items.length,0);
 clock=t+400;
 release({ok:true,status:200,data:page(2)});
 assert.equal((await next).ok,true);
 assert.equal(x.snapshot().expiresAt,t+30400);
 assert.equal(x.snapshot().pageNumber,2);
});
test('R48 reloj no seguro o retroceso temporal nunca acredita lista vigente',async()=>{
 let clock=t;
 const x=create(async()=>({ok:true,status:200,data:page(1)}),{now:()=>clock});
 await x.load({municipality,serviceKind});
 for(const bad of [NaN,Infinity,t-1]){
  clock=bad;
  assert.equal(x.snapshot().expiresAt,null);
  assert.equal(x.snapshot().items.length,0);
  assert.equal(x.snapshot().hasNext,false);
 }
});
