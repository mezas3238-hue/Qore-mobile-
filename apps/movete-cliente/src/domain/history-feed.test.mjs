import test from 'node:test';
import assert from 'node:assert/strict';
import {projectClientHistory,createClientHistoryStore} from './history-feed.mjs';
const owner='123e4567-e89b-42d3-a456-426614174000',other='123e4567-e89b-42d3-a456-426614174001';
const signed=payload=>'v1.'+payload+'.'+'s'.repeat(43);
const id='123e4567-e89b-42d3-a456-426614174002';
const entry={serviceId:id,kind:'RIDE',status:'completed',createdAt:500,revision:3};
const page={ownerId:owner,generatedAt:1000,expiresAt:2000,nextCursor:null,items:[entry]};
test('historial aceptado solo para titular',()=>{
 assert.equal(projectClientHistory(page,{subject:owner,now:1100}).items.length,1);
 assert.equal(projectClientHistory(page,{subject:other,now:1100}),null);
});
test('historial nunca acepta identidad de conductor ni precio inventado',()=>{
 for(const key of ['driverName','driverPhone','plate','receiptUrl','amountGs','passengerId']){
  assert.equal(projectClientHistory({...page,items:[{...entry,[key]:'privado'}]},{subject:owner,now:1100}),null);
 }
});
test('filtra estado extraño, id inválido o duplicado',()=>{
 assert.equal(projectClientHistory({...page,items:[{...entry,kind:'DRIVER_EARNINGS'}]},{subject:owner,now:1100}),null);
 assert.equal(projectClientHistory({...page,items:[entry,entry]},{subject:owner,now:1100}),null);
 assert.equal(projectClientHistory({...page,items:[{...entry,status:'approved'}]},{subject:owner,now:1100}),null);
});
test('expiración de snapshot elimina datos privados del store',()=>{
 let time=1100;
 const store=createClientHistoryStore({now:()=>time});
 assert.equal(store.consume(page,owner),true);
 assert.equal(store.current(owner).items.length,1);
 time=2100;
 assert.equal(store.current(owner),null);
});
test('paginación usa mayor revisión y no duplica registros',()=>{
 const store=createClientHistoryStore({now:()=>1100});
 store.consume(page,owner);
 const updated={...page,items:[{...entry,revision:5,status:'cancelled'}]};
 assert.equal(store.consume(updated,owner,{append:true}),true);
 assert.equal(store.current(owner).items.length,1);
 assert.equal(store.current(owner).items[0].revision,5);
});
test('cambio de cuenta no conserva historial previo',()=>{
 const store=createClientHistoryStore({now:()=>1100});
 store.consume(page,owner);
 assert.equal(store.current(other),null);
 assert.equal(store.current(owner),null);
});

test('50 registros por página no limita el historial total: 5.000 servicios de 100 páginas',()=>{
 const store=createClientHistoryStore({now:()=>1100,maxItems:5000});
 const record=n=>({serviceId:'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0'),
  kind:'RIDE',status:'completed',createdAt:500,revision:1});
 for(let pageNo=1;pageNo<=100;pageNo++){
  const items=Array.from({length:50},(_,i)=>record((pageNo-1)*50+i+1));
  const payload={...page,items,nextCursor:pageNo<100?signed('cursor_'+(pageNo+1)):null};
  assert.equal(store.consume(payload,owner,{append:pageNo!==1}),true);
 }
 assert.equal(store.current(owner).items.length,5000);
 assert.equal(store.current(owner).nextCursor,null);
 assert.equal(store.current(owner).items[4999].serviceId.length,36);
 assert.equal(store.current(owner).window.rowsRead,5000);
 assert.equal(store.current(owner).window.evictedCount,0);
});

test('100.000 servicios se recorren con ventana acotada sin imponer límite global',()=>{
 const store=createClientHistoryStore({now:()=>1100,maxItems:500});
 const record=n=>({serviceId:'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0'),
  kind:'RIDE',status:'completed',createdAt:500,revision:1});
 for(let pageNo=1;pageNo<=2000;pageNo++){
  const items=Array.from({length:50},(_,i)=>record((pageNo-1)*50+i+1));
  const payload={...page,items,nextCursor:pageNo<2000?signed('window_'+(pageNo+1)):null};
  assert.equal(store.consume(payload,owner,{append:pageNo!==1}),true);
 }
 const view=store.current(owner);
 assert.equal(view.items.length,500);
 assert.equal(view.window.maxItems,500);
 assert.equal(view.window.rowsRead,100000);
 assert.equal(view.window.evictedCount,99500);
 assert.equal(view.window.hasEvictedNewer,true);
 assert.equal(view.items[0].serviceId,'123e4567-e89b-42d3-a456-000000099501');
 assert.equal(view.items[499].serviceId,'123e4567-e89b-42d3-a456-000000100000');
 assert.equal(view.nextCursor,null);
});
test('cursor de historial no admite rutas, parámetros, tokens ni valor inválido',()=>{
 for(const cursor of ['../../admin','hello?role=owner','a+b','token@example.org','','x'.repeat(201)]){
  assert.equal(projectClientHistory({...page,nextCursor:cursor},{subject:owner,now:1100}),null);
 }
 assert.equal(projectClientHistory({...page,nextCursor:signed('p_123')},{subject:owner,now:1100}).nextCursor,signed('p_123'));
});

test('historial grande reutiliza lista ya ordenada sin recalcular cada refresco UI',()=>{
 const store=createClientHistoryStore({now:()=>1100});
 const one={...entry,createdAt:400,serviceId:'123e4567-e89b-42d3-a456-426614174011'};
 const two={...entry,createdAt:500,serviceId:'123e4567-e89b-42d3-a456-426614174012'};
 assert.equal(store.consume({...page,items:[one,two]},owner),true);
 const initial=store.current(owner);
 const repeat=store.current(owner);
 assert.equal(initial.items,repeat.items);
 assert.equal(initial.items[0].serviceId,two.serviceId);
 assert.equal(store.consume({...page,items:[{...one,revision:4}]},owner,{append:true}),true);
 const after=store.current(owner);
 assert.notEqual(after.items,initial.items);
 assert.equal(after.items[1].revision,4);
 store.clear();
 assert.equal(store.current(owner),null);
});

test('IDs iguales de viaje, envío y pedido se conservan como tres servicios',()=>{
 const store=createClientHistoryStore({now:()=>1100});
 const rides={...entry,kind:'RIDE',revision:1};
 const deliveries={...entry,kind:'DELIVERY',revision:2};
 const orders={...entry,kind:'MERCHANT_ORDER',revision:3};
 assert.equal(projectClientHistory({...page,items:[rides,deliveries,orders]},{subject:owner,now:1100}).items.length,3);
 assert.equal(store.consume({...page,items:[rides]},owner),true);
 assert.equal(store.consume({...page,items:[deliveries,orders]},owner,{append:true}),true);
 assert.equal(store.current(owner).items.length,3);
 assert.deepEqual(store.current(owner).items.map(x=>x.kind),['DELIVERY','MERCHANT_ORDER','RIDE']);
 assert.equal(store.consume({...page,items:[{...deliveries,revision:4}]},owner,{append:true}),true);
 assert.equal(store.current(owner).items.length,3);
 assert.equal(store.current(owner).items.find(x=>x.kind==='DELIVERY').revision,4);
});
