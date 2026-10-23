import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminExperience} from './admin-experience.mjs';
const admin='123e4567-e89b-42d3-a456-426614174000',another='123e4567-e89b-42d3-a456-426614174001';
const vehicle='123e4567-e89b-42d3-a456-426614174002';
const now=1700000000000;
const auth=(subject=admin)=>({subject,role:'admin',mfaVerified:true,
 expiresAt:now+60000,token:'synthetic-admin-jwt-at-least-twenty'});
const dto={scope:'admin.kyc.read',revision:2,generatedAt:now-1000,expiresAt:now+30000,
 items:[{vehicleId:vehicle,vehicleKind:'AUTO',applicationStatus:'pending',licenseStatus:'valid',
  insuranceStatus:'pending',inspectionStatus:'pending',reviewRevision:1}]};
function fixture(initial=auth(),gateway=null){
 let user=initial;
 const app=createAdminExperience({authProvider:{readSession:async()=>user,signOut:async()=>{}},
  gateway,now:()=>now});
 return {app,setUser:x=>user=x};
}
test('sin proveedor nunca muestra expedientes ni habilita revisión',async()=>{
 const app=createAdminExperience({now:()=>now});
 assert.equal((await app.refreshSession()).ok,false);
 assert.equal(app.readKyc(dto),false);
 assert.equal(app.snapshot().kyc,null);
 assert.equal((await app.reviewVehicle({})).code,'ADMIN_AUTH_REQUIRED');
});
test('admin MFA válido ve solo metadatos KYC autorizados',async()=>{
 const {app}=fixture();
 assert.equal((await app.refreshSession()).ok,true);
 assert.equal(app.readKyc(dto),true);
 assert.equal(app.snapshot().kyc.items[0].vehicleId,vehicle);
 assert.equal(app.snapshot().account.mfaVerified,true);
 assert.equal(app.snapshot().actionsEnabled,false);
 assert.equal(Object.hasOwn(app.snapshot().account,'token'),false);
});
test('Passenger, Driver o Admin sin MFA no ven la cola',async()=>{
 for(const user of [{...auth(),role:'passenger'},{...auth(),role:'driver'},{...auth(),mfaVerified:false}]){
  const {app}=fixture(user);
  assert.equal((await app.refreshSession()).ok,false);
  assert.equal(app.readKyc(dto),false);
  assert.equal(app.snapshot().authenticated,false);
 }
});
test('cambio de admin destruye datos privados del anterior',async()=>{
 const {app,setUser}=fixture();
 await app.refreshSession();app.readKyc(dto);
 setUser(auth(another));
 await app.refreshSession();
 assert.equal(app.snapshot().account.subject,another);
 assert.equal(app.snapshot().kyc,null);
});
test('logout elimina cola local y token incluso sin revisión remota',async()=>{
 const {app}=fixture();
 await app.refreshSession();app.readKyc(dto);
 await app.logout();
 assert.equal(app.snapshot().authenticated,false);
 assert.equal(app.snapshot().kyc,null);
});
test('la cola no hace bypass de contrato write incluso si usuario tiene MFA',async()=>{
 const {app}=fixture();
 await app.refreshSession();app.readKyc(dto);
 assert.equal((await app.reviewVehicle({vehicleId:vehicle})).code,'ADMIN_CONTRACT_PENDING');
 assert.equal(app.snapshot().kyc.items.length,1);
});
test('una revisión confirmada exige nueva lectura servidor, sin aprobar localmente',async()=>{
 const gateway={isConfigured:()=>true,reviewVehicle:async()=>({ok:true,status:200})};
 const {app}=fixture(auth(),gateway);
 await app.refreshSession();app.readKyc(dto);
 const result=await app.reviewVehicle({});
 assert.equal(result.ok,true);
 assert.equal(result.refreshRequired,true);
 assert.equal(app.snapshot().kyc,null);
});
test('error 403 limpia sesión y cola sin mostrar aprobación',async()=>{
 const gateway={isConfigured:()=>true,reviewVehicle:async()=>({ok:false,code:'FORBIDDEN'})};
 const {app}=fixture(auth(),gateway);
 await app.refreshSession();app.readKyc(dto);
 assert.equal((await app.reviewVehicle({})).code,'FORBIDDEN');
 assert.equal(app.snapshot().authenticated,false);
});
test('observer unsubscribe deja de recibir actualizaciones',async()=>{
 const {app}=fixture();let n=0;const off=app.subscribe(()=>n++);
 await app.refreshSession();app.readKyc(dto);
 assert.equal(n,2);
 off();await app.logout();assert.equal(n,2);
});

const financeNow=now;
const owner='123e4567-e89b-42d3-a456-426614174051';
const financeData={
 scope:'owner.finance.read',ownerId:owner,
 period:{from:'2026-10-01',to:'2026-10-22',timezone:'America/Asuncion'},
 currency:'PYG',revision:1,ledgerRevision:2,reconciliationStatus:'RECONCILED',
 generatedAt:financeNow-1000,expiresAt:financeNow+30000,
 totals:{completedRides:3,completedDeliveries:2,completedMerchantOrders:1,
  grossCollectedGs:100000,driverPayoutGs:70000,platformCommissionGs:16000,
  refundsGs:2000,processingFeesGs:1000,netPlatformGs:13000}
};
test('Owner MFA ve únicamente sus totales financieros conciliados, sin KYC ni escritura',async()=>{
 const {app}=fixture({...auth(owner),role:'owner'});
 assert.equal((await app.refreshSession()).ok,true);
 assert.equal(app.readFinance(financeData),true);
 const state=app.snapshot();
 assert.equal(state.account.role,'owner');
 assert.equal(state.finance.totals.netPlatformGs,13000);
 assert.equal(state.kyc,null);
 assert.equal(state.actionsEnabled,false);
 assert.equal(app.readKyc(dto),false);
 assert.equal((await app.reviewVehicle({})).code,'FORBIDDEN');
});
test('Admin puede leer KYC pero jamás finanzas exclusivas owner',async()=>{
 const {app}=fixture(auth());
 await app.refreshSession();
 assert.equal(app.readFinance(financeData),false);
 assert.equal(app.snapshot().finance,null);
 assert.equal(app.readKyc(dto),true);
});
test('logout y cambio owner borran métricas financieras anteriores',async()=>{
 const {app,setUser}=fixture({...auth(owner),role:'owner'});
 await app.refreshSession();app.readFinance(financeData);
 setUser({...auth('123e4567-e89b-42d3-a456-426614174052'),role:'owner'});
 await app.refreshSession();
 assert.equal(app.snapshot().finance,null);
 await app.logout();
 assert.equal(app.snapshot().finance,null);
});
test('finanzas con otro titular no son aceptadas',async()=>{
 const {app}=fixture({...auth(owner),role:'owner'});
 await app.refreshSession();
 assert.equal(app.readFinance({...financeData,ownerId:admin}),false);
 assert.equal(app.snapshot().finance,null);
});

test('ACK de revisión recibido después de logout no confirma una decisión',async()=>{
 let resume;
 const pending=new Promise(resolve=>{resume=resolve;});
 const gateway={isConfigured:()=>true,reviewVehicle:async()=>pending};
 const {app}=fixture(auth(),gateway);
 await app.refreshSession();app.readKyc(dto);
 const task=app.reviewVehicle({});
 await app.logout();
 resume({ok:true,status:200});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(app.snapshot().authenticated,false);
 assert.equal(app.snapshot().kyc,null);
});
test('ACK de revisión de otro administrador se rechaza tras cambio de sesión',async()=>{
 let resume;
 const pending=new Promise(resolve=>{resume=resolve;});
 const gateway={isConfigured:()=>true,reviewVehicle:async()=>pending};
 const {app,setUser}=fixture(auth(),gateway);
 await app.refreshSession();
 const task=app.reviewVehicle({});
 setUser(auth('123e4567-e89b-42d3-a456-426614174020'));
 await app.refreshSession();
 resume({ok:true,status:200});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(app.snapshot().account.subject,'123e4567-e89b-42d3-a456-426614174020');
 assert.equal(app.snapshot().kyc,null);
});
