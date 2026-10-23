import test from 'node:test';
import assert from 'node:assert/strict';
import {projectClientHistory,createClientHistoryStore} from './history-feed.mjs';
const owner='123e4567-e89b-42d3-a456-426614174000',other='123e4567-e89b-42d3-a456-426614174001';
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
