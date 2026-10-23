import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientSessionController} from './client-session.mjs';
const s='123e4567-e89b-42d3-a456-426614174000',u='123e4567-e89b-42d3-a456-426614174001';
const valid=(subject=s)=>({subject,role:'passenger',expiresAt:90000,token:'synthetic-only-auth-token-123456'});
test('sin proveedor Auth, operaciones no tienen sesión',async()=>{
 const state=createClientSessionController({now:()=>10000});
 assert.equal((await state.refresh()).code,'NO_AUTH_PROVIDER');
 assert.equal(state.getSessionForGateway(),null);
});
test('UI nunca recibe token en publicSession',async()=>{
 const state=createClientSessionController({provider:{readSession:()=>valid()},now:()=>10000});
 assert.equal((await state.refresh()).ok,true);
 assert.deepEqual(state.publicSession(),{subject:s,role:'passenger',expiresAt:90000});
 assert.equal(state.getSessionForGateway().token,valid().token);
});
test('sesiones driver/admin y vencidas son rechazadas',async()=>{
 for(const sess of [{...valid(),role:'driver'},{...valid(),role:'admin'},{...valid(),expiresAt:10000},null]){
  const state=createClientSessionController({provider:{readSession:()=>sess},now:()=>10000});
  assert.equal((await state.refresh()).ok,false);
  assert.equal(state.publicSession(),null);
 }
});
test('cambio de cuenta limpia los recursos privados de la cuenta anterior',async()=>{
 let next=valid(),count=0;
 const state=createClientSessionController({provider:{readSession:()=>next},clearPrivateState:()=>count++,now:()=>10000});
 await state.refresh();next=valid(u);await state.refresh();
 assert.equal(count,1);assert.equal(state.publicSession().subject,u);
});
test('logout borra token local aunque falle revocación servidor',async()=>{
 let count=0;
 const state=createClientSessionController({provider:{readSession:()=>valid(),signOut:()=>{throw Error('network');}},clearPrivateState:()=>count++,now:()=>10000});
 await state.refresh();
 assert.equal((await state.logout()).code,'SERVER_REVOCATION_UNCONFIRMED');
 assert.equal(state.getSessionForGateway(),null);
 assert.equal(count,1);
});
test('caducidad elimina sesión y token al consultar',async()=>{
 let clock=10000;
 const state=createClientSessionController({provider:{readSession:()=>valid()},now:()=>clock});
 await state.refresh();clock=90000;
 assert.equal(state.publicSession(),null);
 assert.equal(state.getSessionForGateway(),null);
});
