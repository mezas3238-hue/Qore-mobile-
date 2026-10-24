import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverStagingAuthAdapter} from './driver-staging-auth.mjs';
import {createDriverWorkspaceController} from './driver-workspace.mjs';

const TIME=Date.parse('2026-10-22T12:00:00Z');
const driver='11111111-1111-4111-8111-111111111111';
const alternate='22222222-2222-4222-8222-222222222222';
const offerId='33333333-3333-4333-8333-333333333333';
const tripId='44444444-4444-4444-8444-444444444444';
const TOKEN='a'.repeat(60),OTHER='b'.repeat(60);
const origin='http://127.0.0.1:4141';
const inbox={mode:'STAGING_DEMO_ONLY',liveTripsEnabled:false,
 liveDeliveriesEnabled:false,pushDelivered:false,deviceReceived:false,
 suggestedPollIntervalMs:5000,
 offers:[{kind:'AUTO_RIDE',offerId,serviceId:tripId,expiresAtMs:TIME+25000}]};
const docs={mode:'STAGING_DEMO_ONLY',liveOperationsEnabled:false,
 documents:[{kind:'licencia',status:'approved',submittedAtMs:TIME-20000,
  reviewedAtMs:TIME-10000}]};
const readiness={mode:'STAGING_DEMO_ONLY',currentLicenseApproved:true,
 driverEligible:false,liveOperationsEnabled:false,
 verificationScope:'CURRENT_LICENSE_REVIEW_ONLY'};
function fixture(){
 const calls=[];
 let actor=driver,token=TOKEN,active=true,change;
 let roleAllowed=true,offline=false;
 const auth={
  getSession:async()=>({data:{session:active?{
   user:{id:actor},access_token:token,expires_at:Math.floor(TIME/1000)+600
  }:null},error:null}),
  getUser:async bearer=>({
   data:{user:bearer===token?{
    id:actor,email_confirmed_at:'2026-10-21T00:00:00Z',is_anonymous:false
   }:null},
   error:bearer===token?null:{message:'rejected'}
  }),
  onAuthStateChange:fn=>{
   change=fn;
   return {data:{subscription:{unsubscribe:()=>{change=undefined;}}}};
  }
 };
 const request=async(url,opts)=>{
  calls.push([url,opts.headers.authorization]);
  if(offline)throw Error('Network unavailable');
  if(url.endsWith('/license-readiness'))
   return {status:roleAllowed?200:403,json:async()=>readiness};
  if(url.endsWith('/inbox'))return {status:200,json:async()=>inbox};
  if(url.endsWith('/documents'))return {status:200,json:async()=>docs};
  throw Error('Unexpected endpoint');
 };
 const adapter=createDriverStagingAuthAdapter({
  auth,apiOrigin:origin,request,now:()=>TIME
 });
 const controller=createDriverWorkspaceController({
  authAdapter:adapter,apiOrigin:origin,request,now:()=>TIME
 });
 let latestRefresh;
 const unsub=adapter.subscribe(()=>{
  controller.invalidate();
  latestRefresh=controller.refresh();
 });
 return {controller,calls,unsub,
  logout:async()=>{active=false;change?.('SIGNED_OUT',{access_token:token});return latestRefresh;},
  swap:async()=>{actor=alternate;token=OTHER;roleAllowed=false;
   change?.('SIGNED_IN',{access_token:token});return latestRefresh;},
  offline:()=>{offline=true;}
 };
}
test('G22 -> G21 end-to-end with only public Auth and private STAGING mock APIs',async()=>{
 const f=fixture();
 const state=await f.controller.refresh();
 assert.equal(state.phase,'connected');
 assert.deepEqual(state.offers,[{kind:'AUTO_RIDE',offerId,
  serviceId:tripId,expiresAtMs:TIME+25000}]);
 assert.deepEqual(state.documents,[{kind:'licencia',status:'approved',
  submittedAtMs:TIME-20000,reviewedAtMs:TIME-10000}]);
 assert.equal(state.currentLicenseApproved,true);
 assert.equal(state.driverEligible,false);
 assert.equal(state.liveEnabled,false);
 assert.equal(f.calls.length,4,'role proof, inbox, documents, and readiness read');
 assert.ok(f.calls.every(x=>x[1]==='Bearer '+TOKEN));
 assert.doesNotMatch(JSON.stringify(state),/Bearer|11111111|token|private-licencia/i);
 f.unsub();
});
test('G22 Auth SIGNED_OUT revokes both offers and documents before refreshing',async()=>{
 const f=fixture();
 assert.equal((await f.controller.refresh()).phase,'connected');
 const pending=f.logout();
 assert.deepEqual(f.controller.current().offers,[]);
 assert.deepEqual(f.controller.current().documents,[]);
 const state=await pending;
 assert.equal(state.phase,'signed-out');
 assert.equal(state.currentLicenseApproved,false);
 assert.equal(state.driverEligible,false);
 f.unsub();
});
test('G22 swapping to unapproved role cannot reuse previous Driver offer',async()=>{
 const f=fixture();
 await f.controller.refresh();
 const pending=f.swap();
 assert.deepEqual(f.controller.current().offers,[]);
 const state=await pending;
 assert.equal(state.phase,'authorization-required');
 assert.deepEqual(state.documents,[]);
 assert.deepEqual(state.offers,[]);
 assert.equal(state.currentLicenseApproved,false);
 f.unsub();
});
test('G22 SDK/server network failure does not expose a stale last-known-good snapshot',async()=>{
 const f=fixture();
 assert.equal((await f.controller.refresh()).phase,'connected');
 f.offline();
 const state=await f.controller.refresh();
 assert.equal(state.phase,'offline');
 assert.deepEqual(state.offers,[]);
 assert.deepEqual(state.documents,[]);
 assert.equal(state.currentLicenseApproved,false);
 f.unsub();
});
