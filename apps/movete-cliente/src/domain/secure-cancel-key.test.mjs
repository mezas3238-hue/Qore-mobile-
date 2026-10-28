import test from 'node:test';
import assert from 'node:assert/strict';
import {createSecureCancellationKey} from './secure-cancel-key.mjs';
const uuid='123e4567-e89b-42d3-a456-426614174003';
test('admite UUID v4 provisto por Expo Crypto nativo',()=>{
 assert.deepEqual(createSecureCancellationKey(()=>uuid),{ok:true,requestKey:uuid});
});
test('nunca inventa clave cuando no existe CSPRNG nativo o falla',()=>{
 for(const generator of [undefined, null, 'not-function', ()=>{throw Error('sin OS');},
  ()=>undefined, ()=>null, ()=>42, ()=>'123e4567-e89b-12d3-a456-426614174003',
  ()=>'123e4567-e89b-42d3-7456-426614174003',()=>'',()=>uuid+'extra']){
  assert.equal(createSecureCancellationKey(generator).code,'SECURE_RANDOM_UNAVAILABLE');
 }
});
test('solo llama al proveedor una vez; no genera nueva clave durante retry',()=>{
 let calls=0;
 const result=createSecureCancellationKey(()=>{calls++;return uuid;});
 assert.equal(result.requestKey,uuid);
 assert.equal(calls,1);
 assert.equal(Object.isFrozen(result),true);
});
