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

test('re-login de mismo Admin durante revisión invalida respuesta del token anterior',async()=>{
 let done;
 const pending=new Promise(resolve=>done=resolve);
 const gateway={isConfigured:()=>true,reviewVehicle:async()=>pending};
 const {app}=fixture(auth(),gateway);
 await app.refreshSession();
 const first=app.reviewVehicle({});
 await app.logout();
 await app.refreshSession(); // mismo sujeto en cuenta, sesión nueva
 done({ok:true,status:200});
 assert.equal((await first).code,'STALE_SESSION_RESPONSE');
 assert.equal(app.snapshot().kyc,null);
});

test('cambio de rol owner a admin y retorno no recupera finanzas previas',async()=>{
 let current={...auth(owner),role:'owner'};
 const app=createAdminExperience({
  authProvider:{readSession:async()=>current,signOut:async()=>{}},now:()=>now
 });
 await app.refreshSession();
 assert.equal(app.readFinance(financeData),true);
 current={...auth(owner),role:'admin'};
 await app.refreshSession();
 assert.equal(app.snapshot().finance,null);
 current={...auth(owner),role:'owner'};
 await app.refreshSession();
 assert.equal(app.snapshot().finance,null);
});

const zone={scope:'admin.zones.read',revision:3,generatedAt:now-2000,expiresAt:now+30000,
 items:[{zoneId:vehicle,municipality:'Luque',serviceKind:'AUTO_RIDE',
  coverageStatus:'ACTIVE',eligibleByPolicy:true,onDutyVehicles:0,availabilityObservedAt:now-1000}]};
test('Admin ve cobertura sin confundirla con conductores disponibles',async()=>{
 const {app}=fixture();
 await app.refreshSession();
 assert.equal(app.readZones(zone),true);
 assert.equal(app.snapshot().zones.items[0].coverageStatus,'ACTIVE');
 assert.equal(app.snapshot().zones.items[0].onDutyVehicles,0);
 assert.equal(app.snapshot().zones.items[0].availabilityConfirmed,false);
});
test('Owner no hereda lista operativa de zonas de Admin',async()=>{
 const {app}=fixture({...auth(owner),role:'owner'});
 await app.refreshSession();
 assert.equal(app.readZones(zone),false);
 assert.equal(app.snapshot().zones,null);
});
test('cambio de cuenta y logout retiran zonas privadas',async()=>{
 const {app,setUser}=fixture();
 await app.refreshSession();
 app.readZones(zone);
 setUser(auth(another));await app.refreshSession();
 assert.equal(app.snapshot().zones,null);
 app.readZones(zone);
 await app.logout();
 assert.equal(app.snapshot().zones,null);
});

const incidentFeed={scope:'admin.incidents.read',revision:2,generatedAt:now-1000,
 expiresAt:now+30000,items:[{incidentId:vehicle,category:'SAFETY',severity:'HIGH',
 status:'OPEN',createdAt:now-10000,revision:1}]};
test('Admin visualiza exclusivamente la cola agregada de incidentes sin PII',async()=>{
 const {app}=fixture();
 await app.refreshSession();
 assert.equal(app.readIncidents(incidentFeed),true);
 assert.equal(app.snapshot().incidents.items[0].severity,'HIGH');
 assert.equal(Object.hasOwn(app.snapshot().incidents.items[0],'reporterName'),false);
});
test('Owner no hereda derecho a incidentes ni datos del operador',async()=>{
 const {app}=fixture({...auth(owner),role:'owner'});
 await app.refreshSession();
 assert.equal(app.readIncidents(incidentFeed),false);
 assert.equal(app.snapshot().incidents,null);
});
test('cambio de cuenta borra el resumen previo de incidentes',async()=>{
 const {app,setUser}=fixture();
 await app.refreshSession();
 app.readIncidents(incidentFeed);
 setUser(auth(another));await app.refreshSession();
 assert.equal(app.snapshot().incidents,null);
});

const auditFeed={scope:'admin.audit.read',revision:10,generatedAt:now-2000,
 expiresAt:now+30000,items:[{eventId:vehicle,actorRole:'admin',
 operation:'KYC_REVIEW',targetKind:'VEHICLE',outcome:'CONFIRMED',
 occurredAt:now-5000,revision:8}]};
test('Admin recibe metadatos de auditoría únicamente tras MFA',async()=>{
 const {app}=fixture();
 await app.refreshSession();
 assert.equal(app.readAudit(auditFeed),true);
 assert.equal(app.snapshot().audit.items[0].outcome,'CONFIRMED');
 assert.equal(Object.hasOwn(app.snapshot().audit.items[0],'actorName'),false);
});
test('Owner no hereda auditoría del operador y no puede cargarla',async()=>{
 const {app}=fixture({...auth(owner),role:'owner'});
 await app.refreshSession();
 assert.equal(app.readAudit(auditFeed),false);
 assert.equal(app.snapshot().audit,null);
});
test('nuevo inicio de sesión vacía eventos de auditoría del anterior admin',async()=>{
 const {app,setUser}=fixture();
 await app.refreshSession();
 app.readAudit(auditFeed);
 setUser(auth(another));
 await app.refreshSession();
 assert.equal(app.snapshot().audit,null);
});

const mockReply=data=>({
 ok:true,status:200,redirected:false,
 headers:{get:key=>key==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)
});
const readConfig=fetchImpl=>({
 enabled:true,certifiedContracts:['zones','kyc','finance','incidents','audit'],
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 fetchImpl
});
test('sin contrato certificado el runtime no hace solicitudes de red',async()=>{
 const app=createAdminExperience({authProvider:{readSession:async()=>auth()},
  now:()=>now});
 await app.refreshSession();
 assert.equal((await app.syncFromServer('zones')).code,'READ_CONTRACT_NOT_CERTIFIED');
 assert.equal(app.snapshot().zones,null);
});
test('consulta STAGING de zonas acepta solo DTO validado después de Auth y MFA',async()=>{
 const url=[];
 const app=createAdminExperience({
  now:()=>now,
  authProvider:{readSession:async()=>auth()},
  readGatewayOptions:readConfig(async (path,options)=>{
   url.push([path,options.method,options.credentials]);
   return mockReply(zone);
  })
 });
 await app.refreshSession();
 assert.equal((await app.syncFromServer('zones')).ok,true);
 assert.equal(app.snapshot().zones.items[0].municipality,'Luque');
 assert.deepEqual(url,[['https://staging.example.invalid/v1/staging/admin/zones/overview','GET','omit']]);
});
test('frontend rechaza DTO no certificado aunque HTTP devuelva 200',async()=>{
 const app=createAdminExperience({
  now:()=>now,authProvider:{readSession:async()=>auth()},
  readGatewayOptions:readConfig(async()=>mockReply({scope:'admin.zones.read',items:[{driverName:'PII'}]}))
 });
 await app.refreshSession();
 assert.equal((await app.syncFromServer('zones')).code,'INVALID_READ_DTO');
 assert.equal(app.snapshot().zones,null);
});
test('logout durante GET evita restaurar información privada antigua',async()=>{
 let unblock;
 const waiting=new Promise(resolve=>unblock=resolve);
 const app=createAdminExperience({
  now:()=>now,authProvider:{readSession:async()=>auth(),signOut:async()=>{}},
  readGatewayOptions:readConfig(async()=>waiting)
 });
 await app.refreshSession();
 const task=app.syncFromServer('zones');
 await Promise.resolve();await Promise.resolve();
 await app.logout();
 unblock(mockReply(zone));
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(app.snapshot().zones,null);
});
test('Owner no puede consultar endpoint zonas de Admin ni usar su rol para audit',async()=>{
 let hits=0;
 const app=createAdminExperience({
  now:()=>now,authProvider:{readSession:async()=>({...auth(owner),role:'owner'})},
  readGatewayOptions:readConfig(async()=>{hits++;return mockReply(zone)})
 });
 await app.refreshSession();
 assert.equal((await app.syncFromServer('zones')).code,'FORBIDDEN');
 assert.equal((await app.syncFromServer('audit')).code,'FORBIDDEN');
 assert.equal(hits,0);
});
test('dos consultas simultáneas al mismo endpoint no crean doble llamada',async()=>{
 let unblock,hits=0;
 const waiting=new Promise(resolve=>unblock=resolve);
 const app=createAdminExperience({
  now:()=>now,authProvider:{readSession:async()=>auth()},
  readGatewayOptions:readConfig(async()=>{hits++;return waiting;})
 });
 await app.refreshSession();
 const first=app.syncFromServer('zones');
 assert.equal((await app.syncFromServer('zones')).code,'READ_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();
 assert.equal(hits,1);
 unblock(mockReply(zone));
 assert.equal((await first).ok,true);
});

test('403 tardío de request previo no mata sesión Admin nueva',async()=>{
 let current=auth(),release;
 const pending=new Promise(resolve=>release=resolve);
 const app=createAdminExperience({
  now:()=>now,authProvider:{readSession:async()=>current,signOut:async()=>{}},
  readGatewayOptions:readConfig(async()=>pending)
 });
 await app.refreshSession();
 const old=app.syncFromServer('zones');
 await Promise.resolve();await Promise.resolve();
 await app.logout();
 current=auth();
 await app.refreshSession();
 release({status:403,ok:false,redirected:false});
 assert.equal((await old).code,'STALE_SESSION_RESPONSE');
 assert.equal(app.snapshot().authenticated,true);
});

test('paginación KYC 151 páginas: cada página se reemplaza, el universo no se limita a 100 registros',async()=>{
 const ids=(n)=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
 let hits=0;
 const app=createAdminExperience({
  now:()=>now,authProvider:{readSession:async()=>auth()},
  readGatewayOptions:readConfig(async(url)=>{
   hits++;
   const match=url.match(/cursor=page_(\d+)/);
   const p=match?Number(match[1]):1;
   const payload={...dto,items:[{...dto.items[0],vehicleId:ids(p)}],
    nextCursor:p>=151?null:'page_'+(p+1)};
   return mockReply(payload);
  })
 });
 await app.refreshSession();
 assert.equal((await app.syncFromServer('kyc','reset')).ok,true);
 for(let i=2;i<=151;i++)assert.equal((await app.syncFromServer('kyc','next')).ok,true);
 const snap=app.snapshot();
 assert.equal(hits,151);
 assert.equal(snap.pagination.kyc.pageNumber,151);
 assert.equal(snap.pagination.kyc.hasNext,false);
 assert.equal(snap.kyc.items.length,1);
 assert.equal(snap.kyc.items[0].vehicleId,ids(151));
 assert.equal((await app.syncFromServer('kyc','next')).code,'NO_ADDITIONAL_PAGE');
 assert.equal((await app.syncFromServer('kyc','previous')).ok,true);
 assert.equal(app.snapshot().pagination.kyc.pageNumber,150);
});
test('no se acepta cursor circular que podría reiterar la misma página',async()=>{
 const app=createAdminExperience({now:()=>now,
  authProvider:{readSession:async()=>auth()},
  readGatewayOptions:readConfig(async()=>mockReply({...dto,nextCursor:'same'}))
 });
 await app.refreshSession();
 assert.equal((await app.syncFromServer('kyc','reset')).ok,true);
 assert.equal((await app.syncFromServer('kyc','next')).code,'INVALID_READ_DTO');
 assert.equal(app.snapshot().kyc,null);
 assert.equal(app.snapshot().pagination.kyc.hasNext,false);
});
test('logout borra cursores de distintas bandejas sin filtrar páginas previas',async()=>{
 const app=createAdminExperience({
  now:()=>now,authProvider:{readSession:async()=>auth(),signOut:async()=>{}},
  readGatewayOptions:readConfig(async()=>mockReply({...dto,nextCursor:'next_cursor'}))
 });
 await app.refreshSession();
 await app.syncFromServer('kyc','reset');
 assert.equal(app.snapshot().pagination.kyc.hasNext,true);
 await app.logout();
 assert.equal(app.snapshot().pagination.kyc.hasNext,false);
});
