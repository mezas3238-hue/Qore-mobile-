import test from 'node:test';
import assert from 'node:assert/strict';
import {canAutoLoadHistory} from './history-auto-page.mjs';
const cursor='v1.synthetic.'+'s'.repeat(43);
const base={authenticated:true,configured:true,loading:false,error:null,
 nextCursor:cursor,lastRequested:null};
test('admite cursores sucesivos sin tope global de registros',()=>{
 assert.equal(canAutoLoadHistory(base),true);
 for(const n of [2,50,120,624,30000]){
  assert.equal(canAutoLoadHistory({...base,nextCursor:cursor+n}),true);
 }
});
test('no consulta sin cuenta, contrato, con error, carga activa ni cursor repetido',()=>{
 for(const variation of [{authenticated:false},{configured:false},{loading:true},
  {error:'NETWORK_OR_TIMEOUT'},{error:'INVALID_OR_EXPIRED_CURSOR'},
  {nextCursor:null},{nextCursor:undefined},{lastRequested:cursor}]){
  assert.equal(canAutoLoadHistory({...base,...variation}),false);
 }
});
