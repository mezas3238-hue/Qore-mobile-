import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminExperience} from './admin-experience.mjs';
const t=1900000000000;
const id=n=>'f1000000-0000-4100-8100-'+String(n).padStart(12,'0');
const admin=id(1),owner=id(2),trip=id(3),route=id(4),quote=id(5),passenger=id(6);
const receipt=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 viewerId:admin,tripId:trip,routeId:route,quoteId:quote,
 passengerId:passenger,bookingRequestKey:id(7),service:'economico',
 currency:'PYG',amountGs:16900,fareVersion:'g73-v1',revision:1,
 status:'searching',assignmentPersisted:false,driverId:null,
 observedAt:t-1000,expiresAt:t+20000,serverPersisted:true});
const reply=(dto,status=200)=>({ok:status>=200&&status<300,status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(dto)});
function build({role='admin',configured=true,readImpl=null}={}){
 let actor={role,mfaVerified:true,subject:role==='admin'?admin:owner,
  token:'admin-mfa-token-abcdefghijklmnopqrst',expiresAt:t+300000};
 let calls=0;
 const app=createAdminExperience({
  now:()=>t,
  authProvider:{readSession:async()=>actor,signOut:async()=>{}},
  f1RideAuditOptions:{
   enabled:configured,contractCertified:true,stagingRuntimeVerified:true,
   origin:'https://qa.example.invalid',pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async()=>{calls++;return readImpl?readImpl():reply(receipt());}
  }
 });
 return {app,calls:()=>calls,rotate:s=>actor=s,actor:()=>actor};
}
test('Admin F1 is OFF without HTTPS contract or Admin MFA',async()=>{
 const f=build({configured:false});await f.app.refreshSession();
 assert.equal(f.app.snapshot().f1RideAudit.contractReady,false);
 assert.equal((await f.app.loadF1RideAudit(trip)).code,'F1_ADMIN_CONTRACT_PENDING');
 assert.equal(f.calls(),0);
 const o=build({role:'owner'});await o.app.refreshSession();
 assert.equal(o.app.snapshot().f1RideAudit.item,null);
 assert.equal((await o.app.loadF1RideAudit(trip)).code,'ADMIN_AUTH_REQUIRED');
 assert.equal(o.calls(),0);
});
test('Admin F1 reads one server trip; screen receives only non-PII operational fields',async()=>{
 const f=build();await f.app.refreshSession();
 assert.equal(f.app.snapshot().f1RideAudit.contractReady,true);
 assert.equal((await f.app.loadF1RideAudit(trip)).ok,true);
 const data=f.app.snapshot().f1RideAudit;
 assert.equal(data.item.tripId,trip);assert.equal(data.item.amountGs,16900);
 assert.equal(data.item.revision,1);assert.equal(data.item.productionEnabled,false);
 assert.equal(JSON.stringify(data).includes(passenger),false);
 assert.equal(JSON.stringify(data).includes(f.actor().token),false);
 assert.equal(f.calls(),1);
 f.app.clearF1RideAudit();
 assert.equal(f.app.snapshot().f1RideAudit.item,null);
});
test('Admin F1 invalid result clears older proof and remains NO_GO',async()=>{
 let bad=false;
 const f=build({readImpl:()=>reply(bad?{...receipt(),amountGs:0}:receipt())});
 await f.app.refreshSession();
 assert.equal((await f.app.loadF1RideAudit(trip)).ok,true);
 bad=true;
 assert.equal((await f.app.loadF1RideAudit(trip)).ok,false);
 assert.equal(f.app.snapshot().f1RideAudit.item,null);
 assert.equal(f.app.snapshot().f1RideAudit.productionEnabled,false);
});
test('Admin F1 session rotation removes old trip before rendering new user',async()=>{
 const f=build();await f.app.refreshSession();
 await f.app.loadF1RideAudit(trip);
 f.rotate({...f.actor(),token:'new-admin-mfa-token-abcdefghijklmnopqrst'});
 assert.equal((await f.app.refreshSession()).ok,true);
 assert.equal(f.app.snapshot().f1RideAudit.item,null);
});
test('Admin F1 existing trip stays invisible after logout, no automatically repeated GET',async()=>{
 const f=build();await f.app.refreshSession();
 await f.app.loadF1RideAudit(trip);
 await f.app.logout();
 assert.equal(f.app.snapshot().f1RideAudit.item,null);
 assert.equal(f.app.snapshot().authenticated,false);
 assert.equal(f.calls(),1);
});
