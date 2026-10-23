import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAuditFeed,createAuditFeedStore} from './audit-feed.mjs';
const now=1800000000000;
const row={eventId:'123e4567-e89b-42d3-a456-426614174040',
 actorRole:'admin',operation:'KYC_REVIEW',targetKind:'VEHICLE',
 outcome:'CONFIRMED',occurredAt:now-5000,revision:10};
const feed={scope:'admin.audit.read',revision:15,generatedAt:now-3000,
 expiresAt:now+45000,items:[row]};
test('permite solo lectura mínima de audit feed para admin',()=>{
 const result=projectAuditFeed(feed,{role:'admin',now});
 assert.equal(result.items.length,1);
 assert.deepEqual(Object.keys(result.items[0]).sort(),
  ['eventId','actorRole','operation','targetKind','outcome','occurredAt','revision'].sort());
 for(const role of ['owner','driver','passenger','security_operator'])
  assert.equal(projectAuditFeed(feed,{role,now}),null);
});
test('rechaza filtraciones de PII, URLs, hashes y credenciales en eventos',()=>{
 for(const key of ['actorId','actorName','phone','token','driverLicense','documentUrl','gps','ipAddress','rawPayload','bankAccount']){
  assert.equal(projectAuditFeed({...feed,items:[{...row,[key]:'SECRET'}]},{role:'admin',now}),null,key);
 }
});
test('no admite identidades duplicadas ni eventos no permitidos',()=>{
 assert.equal(projectAuditFeed({...feed,items:[row,row]},{role:'admin',now}),null);
 assert.equal(projectAuditFeed({...feed,items:[{...row,outcome:'APPROVED_BY_BROWSER'}]},{role:'admin',now}),null);
 assert.equal(projectAuditFeed({...feed,items:[{...row,operation:'DELETE_AUDIT_LOG'}]},{role:'admin',now}),null);
 assert.equal(projectAuditFeed({...feed,items:[{...row,revision:-2}]},{role:'admin',now}),null);
});
test('expired y response sin contrato no se proyectan',()=>{
 assert.equal(projectAuditFeed({...feed,expiresAt:now},{role:'admin',now}),null);
 assert.equal(projectAuditFeed({...feed,generatedAt:now-400000},{role:'admin',now}),null);
 assert.equal(projectAuditFeed({...feed,items:[{...row,occurredAt:now+1}]},{role:'admin',now}),null);
});
test('cambio de rol o revisión antigua invalida snapshot',()=>{
 let time=now;
 const store=createAuditFeedStore({now:()=>time});
 assert.equal(store.replace(feed,'admin'),true);
 assert.equal(store.current('owner'),null);
 assert.equal(store.current('admin'),null);
 store.replace(feed,'admin');
 assert.equal(store.replace({...feed,revision:14},'admin'),false);
 assert.equal(store.current('admin'),null);
 store.replace(feed,'admin');time=now+50000;
 assert.equal(store.current('admin'),null);
});

test('A05 limita a 50 la página, no a 50 el total de la plataforma',()=>{
 const createRecord=n=>({...row,eventId:'123e4567-e89b-42d3-a456-'+String(n+50).padStart(12,'0')});
 const rows=Array.from({length:50},(_,i)=>createRecord(i));
 const page={...feed,items:rows,nextCursor:'S'.repeat(44)};
 const data=projectAuditFeed(page,{role:'admin',now});
 assert.equal(data.items.length,50);
 assert.equal(data.nextCursor,'S'.repeat(44));
 assert.equal(projectAuditFeed({...page,items:[...rows,createRecord(51)]},
  {role:'admin',now}),null);
});
