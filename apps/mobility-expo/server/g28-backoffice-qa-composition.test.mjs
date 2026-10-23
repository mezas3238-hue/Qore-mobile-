import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareQoreG28BackofficeQa} from './g28-backoffice-qa-composition.mjs';
import {listenQoreBackofficeLoopback} from './g27-backoffice-loopback-transport.mjs';
const at=Date.parse('2026-10-23T12:00:00Z');
const id='11111111-1111-4111-8111-111111111111';
const key='Synthetic QA backoffice cursor secret with at least 32 bytes';
const token='syntheticJwtBearer12345678901234567890';
const zonePage={revision:1,items:[{
 zoneId:'66666666-6666-4666-8666-666666666666',
 municipality:'Asuncion',serviceKind:'AUTO_RIDE',
 coverageStatus:'ACTIVE',eligibleByPolicy:false,
 onDutyVehicles:0,availabilityObservedAt:0
}],hasMore:false};
const auditPage={revision:1,items:[{
 eventId:'55555555-5555-4555-8555-555555555555',
 actorRole:'admin',operation:'INCIDENT_TRIAGE',targetKind:'INCIDENT',
 outcome:'CONFIRMED',occurredAt:at-1000,revision:2
}],hasMore:false};
const kycPage={revision:1,items:[{
 vehicleId:'44444444-4444-4444-8444-444444444444',
 vehicleKind:'AUTO',applicationStatus:'pending',
 licenseStatus:'pending',insuranceStatus:'missing',inspectionStatus:'missing',reviewRevision:1
}],hasMore:false};
const page={revision:1,items:[{
 incidentId:'22222222-2222-4222-8222-222222222222',
 category:'SAFETY',severity:'HIGH',status:'OPEN',
 createdAt:at-1000,revision:1
}],hasMore:false};
function opts(){
 return {
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  projectRef:'staging1234567890abcd',cursorSecrets:{current:key},
  now:()=>at,
  verifyAccessToken:async()=>({id,sessionId:'synthetic-session-01',
   is_anonymous:false,email_confirmed_at:'2026-10-22T00:00:00Z',
   expiresAtMs:at+600000}),
  verifyBackofficeMfa:async()=>({verifiedByProvider:true,userId:id,
   sessionId:'synthetic-session-01',assuranceLevel:'aal2',
   verifiedAtMs:at-1000,expiresAtMs:at+500000}),
  allowRequest:()=>true,
  rpc:async(name,args)=>{
   if(name==='mobility_stage_g27_backoffice_role_of')
    return {data:args._user===id?'admin':null,error:null};
   if(name==='mobility_stage_g27_backoffice_has_scope')
    return {data:['admin.incidents.read','admin.kyc.read','admin.audit.read','admin.zones.read'].includes(args._scope)&&args._user===id,error:null};
   if(name==='mobility_stage_g28_admin_incident_page')
    return {data:page,error:null};
   if(name==='mobility_stage_g29_admin_kyc_page')
    return {data:kycPage,error:null};
   if(name==='mobility_stage_g30_admin_audit_page')
    return {data:auditPage,error:null};
   if(name==='mobility_stage_g31_admin_zone_page')
    return {data:zonePage,error:null};
   return {error:{code:'unknown'}};
  }
 };
}
test('G28.1 QA composition stays unbound, connects verified session and SQL, denies Owner data',async t=>{
 const runtime=prepareQoreG28BackofficeQa(opts());
 assert.equal(runtime.server.listening,false);
 assert.equal(runtime.remoteListeningEnabled,false);
 assert.equal(runtime.commercialOperationsEnabled,false);
 assert.deepEqual(runtime.allowedQaReadScopes,['admin.incidents.read','admin.kyc.read','admin.audit.read','admin.zones.read']);
 assert.throws(()=>runtime.server.listen(0,'0.0.0.0'),/127\.0\.0\.1/);
 const base=await listenQoreBackofficeLoopback(runtime.server);
 t.after(async()=>new Promise(resolve=>runtime.server.close(resolve)));
 const headers={authorization:'Bearer '+token};
 const ok=await fetch(base+'/v1/staging/admin/incidents/queue',{headers});
 assert.equal(ok.status,200);
 assert.equal((await ok.json()).items.length,1);
 const kyc=await fetch(base+'/v1/staging/admin/vehicle-review-queue',{headers});
 assert.equal(kyc.status,200);
 const kycDto=await kyc.json();
 assert.equal(kycDto.scope,'admin.kyc.read');
 assert.deepEqual(kycDto.items,kycPage.items);
 assert.doesNotMatch(JSON.stringify(kycDto),/object_key|photo|driverName|email/);
 const audit=await fetch(base+'/v1/staging/admin/audit/events',{headers});
 assert.equal(audit.status,200);
 const auditDto=await audit.json();
 assert.equal(auditDto.scope,'admin.audit.read');
 assert.deepEqual(auditDto.items,auditPage.items);
 assert.doesNotMatch(JSON.stringify(auditDto),/reason_code|reporter_id|documentUrl/);
 const zones=await fetch(base+'/v1/staging/admin/zones/overview',{headers});
 assert.equal(zones.status,200);
 const zonesDto=await zones.json();
 assert.equal(zonesDto.scope,'admin.zones.read');
 assert.deepEqual(zonesDto.items,zonePage.items);
 assert.equal(zonesDto.items[0].eligibleByPolicy,false);
 assert.equal(zonesDto.items[0].availabilityObservedAt,0);
 const owner=await fetch(base+'/v1/staging/owner/finance/summary',{headers});
 assert.equal(owner.status,403);
 const noBody=await fetch(base+'/v1/staging/admin/zones/overview',{
  method:'POST',headers
 });
 assert.equal(noBody.status,405);
});
test('G28.1 constructor denies LIVE and missing trusted JWT/MFA/SQL sources',()=>{
 for(const patch of [
  {environment:'production'}, {environment:'staging'},
  {liveEnabled:true}, {liveEnabled:null},
  {localQaOnly:false}, {localQaOnly:undefined},
  {verifyAccessToken:null}, {verifyBackofficeMfa:()=>false,localQaOnly:false},
  {verifyBackofficeMfa:null}, {rpc:null},
  {allowRequest:null}, {cursorSecrets:{current:'short'}}
 ]){
  assert.throws(()=>prepareQoreG28BackofficeQa({...opts(),...patch}));
 }
});
