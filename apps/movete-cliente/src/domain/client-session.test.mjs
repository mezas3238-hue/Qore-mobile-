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

test('cierre mientras Auth lee no restaura sesión pasajero',async()=>{
 let complete;
 const pending=new Promise(resolve=>complete=resolve);
 const ctrl=createClientSessionController({
  provider:{readSession:()=>pending,signOut:()=>{}},now:()=>10000
 });
 const old=ctrl.refresh();
 await ctrl.logout();
 complete(valid());
 assert.equal((await old).code,'STALE_SESSION_RESPONSE');
 assert.equal(ctrl.getSessionForGateway(),null);
});
test('en dos refresh pasajeros gana el último, sin mezclar identidades',async()=>{
 const done=[];
 const ctrl=createClientSessionController({
  provider:{readSession:()=>new Promise(resolve=>done.push(resolve))},now:()=>10000
 });
 const older=ctrl.refresh(),newer=ctrl.refresh();
 done[1](valid(u));
 assert.equal((await newer).ok,true);
 done[0](valid());
 assert.equal((await older).code,'STALE_SESSION_RESPONSE');
 assert.equal(ctrl.publicSession().subject,u);
});

test('nuevo token del mismo pasajero borra recursos privados anteriores',async()=>{
 let next=valid(),clears=0;
 const state=createClientSessionController({
  provider:{readSession:async()=>next},clearPrivateState:()=>clears++,now:()=>10000
 });
 await state.refresh();
 next={...valid(),token:'synthetic-new-token-that-is-longer-123456'};
 assert.equal((await state.refresh()).ok,true);
 assert.equal(clears,1);
 assert.equal(state.getSessionForGateway().token,next.token);
});
test('renovación idéntica no vacía estado ni desencadena borrado',async()=>{
 let clears=0;
 const state=createClientSessionController({
  provider:{readSession:async()=>valid()},clearPrivateState:()=>clears++,now:()=>10000
 });
 await state.refresh();await state.refresh();
 assert.equal(clears,0);
});

test('privacidad UI cambia al login, logout, rotación y nueva cuenta, no al refresh idéntico',async()=>{
 let next=valid();
 const c=createClientSessionController({provider:{readSession:async()=>next,signOut:async()=>{}},now:()=>10000});
 const initial=c.privacyRevision();
 assert.equal((await c.refresh()).ok,true);
 const logged=c.privacyRevision();assert.ok(logged>initial);
 assert.equal((await c.refresh()).ok,true);
 assert.equal(c.privacyRevision(),logged);
 next={...valid(),token:'synthetic-new-jwt-rotation-123456'};
 await c.refresh();
 const rotated=c.privacyRevision();assert.ok(rotated>logged);
 next=valid(u);await c.refresh();
 const switched=c.privacyRevision();assert.ok(switched>rotated);
 await c.logout();
 const exited=c.privacyRevision();assert.ok(exited>switched);
 next=valid(u);await c.refresh();
 assert.ok(c.privacyRevision()>exited);
 assert.equal(JSON.stringify(c.publicSession()).includes('token'),false);
});
test('sesión expirada invalida también el alcance de los formularios privados',async()=>{
 let clock=10000;
 const c=createClientSessionController({provider:{readSession:()=>valid()},now:()=>clock});
 await c.refresh();const revision=c.privacyRevision();
 clock=90000;
 assert.equal(c.publicSession(),null);
 assert.ok(c.privacyRevision()>revision);
});
