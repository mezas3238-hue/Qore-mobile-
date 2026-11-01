import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');

test('G284 preserves G260 MFA/Admin and G272 launch protections when adding G279 and G113',()=>{
 const startup=read('run-g4-railway-staging.mjs');
 const runtime=read('g4-staging-runtime.mjs');
 for(const required of [
  'QORE_G260_ADMIN_AAL2_APPROVED',
  'QORE_G282_VEHICLE_DRAFT_APPROVED',
  'verifyG256RailwayLaunch',
  'QORE_RAILWAY_NO_COMMERCIAL_TRIPS',
  'QORE_ADMIN_BROWSER_ORIGIN'
 ])assert.ok(startup.includes(required),'G284 missing Railway legacy gate '+required);
 for(const required of [
  'g260AdminAal2Approved',
  'g282VehicleDraftApproved',
  'createG279RiderHistorySessionVerifier',
  'verifyAccessToken:verifiedHistorySession',
  "mobility_stage_g42_session_active",
  'qaAutoDispatchRetry'
 ])assert.ok(runtime.includes(required),'G284 missing G4 original adapter '+required);
 const check=(needle)=>{const i=startup.indexOf(needle);assert.ok(i>=0,needle);return i;};
 assert.ok(check('verifyG256RailwayLaunch')<
  check('await assertG282PrivateBatchInstalled'));
 assert.ok(check('await assertG282PrivateBatchInstalled')<
  check('await assertG283VerifiedDatabaseReadiness'));
 assert.ok(check('await assertG283VerifiedDatabaseReadiness')<
  check('autoDispatchRetryQa:g113RetryApproved'));
 assert.ok(check("await once(ingress,'listening')")<
  check('retryController=startG282RailwayRetryWorker'));
 assert.ok(check('retryController?.stop()')<
  check('ingress.close()'));
});
test('G284 no public administrative endpoint is created for G113 dispatch',()=>{
 const runtime=read('g4-staging-runtime.mjs');
 const run=read('run-g4-railway-staging.mjs');
 const transport=read('g4-loopback-http-transport.mjs');
 assert.doesNotMatch(transport,/\/v1\/staging\/admin\/dispatch\/run/);
 assert.doesNotMatch(run,/app\.(?:get|post)\s*\(/);
 assert.match(runtime,/autoDispatchRetryQa=false/);
 assert.match(run,/enabled:g113RetryApproved/);
});
