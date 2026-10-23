import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminSessionController} from './admin-session.mjs';
const who='123e4567-e89b-42d3-a456-426614174000';
const other='123e4567-e89b-42d3-a456-426614174001';
const ok=(subject=who)=>({subject,role:'admin',mfaVerified:true,expiresAt:90000,token:'synthetic-admin-session-token'});
test('sin proveedor no existe sesión Admin',async()=>{
 const ctrl=createAdminSessionController({now:()=>10000});
 assert.equal((await ctrl.refresh()).code,'NO_AUTH_PROVIDER');
 assert.equal(ctrl.getSessionForGateway(),null);
});
test('requiere admin y MFA declarados por proveedor de servidor',async()=>{
 for(const invalid of [{...ok(),role:'passenger'},{...ok(),role:'driver'},
  {...ok(),mfaVerified:false},{...ok(),expiresAt:10000},null]){
  const ctrl=createAdminSessionController({provider:{readSession:()=>invalid},now:()=>10000});
  assert.equal((await ctrl.refresh()).code,'ADMIN_AUTH_REQUIRED');
  assert.equal(ctrl.publicSession(),null);
 }
});
test('el snapshot público nunca contiene token',async()=>{
 const ctrl=createAdminSessionController({provider:{readSession:()=>ok()},now:()=>10000});
 await ctrl.refresh();
 assert.equal(Object.hasOwn(ctrl.publicSession(),'token'),false);
 assert.equal(ctrl.getSessionForGateway().token,ok().token);
});
test('cambio de cuenta borra metadatos KYC anteriores',async()=>{
 let state=ok(),clears=0;
 const ctrl=createAdminSessionController({provider:{readSession:()=>state},
  clearSensitive:()=>clears++,now:()=>10000});
 await ctrl.refresh();state=ok(other);await ctrl.refresh();
 assert.equal(clears,1);
 assert.equal(ctrl.publicSession().subject,other);
});
test('logout elimina sesión aunque falle revocación remota',async()=>{
 const ctrl=createAdminSessionController({provider:{readSession:()=>ok(),signOut:()=>{throw Error('offline');}},now:()=>10000});
 await ctrl.refresh();
 assert.equal((await ctrl.logout()).code,'REVOCATION_UNCONFIRMED');
 assert.equal(ctrl.getSessionForGateway(),null);
});
