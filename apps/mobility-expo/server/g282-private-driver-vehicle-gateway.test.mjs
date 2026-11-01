import test from 'node:test';
import assert from 'node:assert/strict';
import {createG282PendingVehicleGateway} from './g282-private-driver-vehicle-gateway.mjs';

const driver='00000000-0000-4000-8000-000000000101';
const passenger='00000000-0000-4000-8000-000000000102';
const session='00000000-0000-4000-8000-000000000201';
const application='00000000-0000-4000-8000-000000000301';
const request='00000000-0000-4000-8000-000000000401';
const vehicle={
 requestKey:request,kind:'AUTO',service:'economico',municipalityCode:'ASUNCION',
 plate:'QAONLY123',brand:'CI ONLY',model:'Contract',year:2024,passengerCapacity:4
};
const bearer='Bearer '+ 'a'.repeat(25)+'.'+'b'.repeat(25)+'.'+'c'.repeat(25);
function setup({authorized=true,revoked=false,dbFail=false}={}){
 const calls=[];
 const gateway=createG282PendingVehicleGateway({
  projectRef:'mrjzxftsdxzepzbcuids',
  verifyDriverSession:async()=>{if(revoked)throw Error('revoked');return {
   id:authorized?driver:passenger,sessionId:session,tokenIatMs:1793400000000,
   is_anonymous:false
  }},
  authorizeDriver:async id=>id===driver,
  allowRequest:()=>true,
  submitPending:async x=>{calls.push(x);if(dbFail)throw Error('SQL refused');return application;}
 });
 const send=(body=vehicle,headers={authorization:bearer})=>gateway({
  method:'POST',path:'/v1/staging/vehicle-applications',body,headers
 });
 return {send,calls};
}
test('G282: only verified Driver original session reaches pending SQL',async()=>{
 const {send,calls}=setup();
 const r=await send();
 assert.equal(r.status,202);
 assert.deepEqual(r.body,{mode:'STAGING_DEMO_ONLY',
  applicationId:application,status:'pending',evidenceVerified:false,
  driverEligible:false,commercialEnabled:false});
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],{
  _driver:driver,_session:session,_iat_ms:1793400000000,
  _request:request,_kind:'AUTO',_service:'economico',
  _municipality:'ASUNCION',_plate:'QAONLY123',_brand:'CI ONLY',
  _model:'Contract',_year:2024,_capacity:4
 });
 assert.equal('approved' in calls[0],false);
});
test('G282: no anonymous, revoked, or Passenger application reaches SQL',async()=>{
 const a=setup();
 assert.equal((await a.send(vehicle,{})).status,401);
 assert.equal(a.calls.length,0);
 const b=setup({revoked:true});
 assert.equal((await b.send()).status,401);
 assert.equal(b.calls.length,0);
 const c=setup({authorized:false});
 assert.equal((await c.send()).status,403);
 assert.equal(c.calls.length,0);
});
test('G282: rejects forged Owner, Driver, KYC and idempotency fields',async()=>{
 const t=setup();
 const bad=[
  {...vehicle,driverId:driver},{...vehicle,approved:true},
  {...vehicle,kycApproved:true},{...vehicle,sessionId:session},
  {...vehicle,kind:'MOTO',service:'economico'},
  {...vehicle,year:1980},{...vehicle,passengerCapacity:0},
  {...vehicle,plate:'VALID;DROP'},
  {...vehicle,requestKey:'not-uuid'}
 ];
 for(const b of bad)assert.equal((await t.send(b)).status,400);
 assert.equal(t.calls.length,0);
});
test('G282: rejects SQL G42 failure, no false acceptance',async()=>{
 const x=setup({dbFail:true});
 const r=await x.send();
 assert.equal(r.status,409);
 assert.equal(r.body.applicationId,undefined);
});
test('G282: idempotency request identity supplied to SQL, never changed',async()=>{
 const x=setup();
 const a=await x.send(),b=await x.send();
 assert.equal(a.body.applicationId,b.body.applicationId);
 assert.equal(x.calls[0]._request,x.calls[1]._request);
});
test('G282: scope and transport method route remain explicit',async()=>{
 const {send,calls}=setup();
 assert.equal((await send(null)).status,400);
 const g=createG282PendingVehicleGateway({
  projectRef:'mrjzxftsdxzepzbcuids',
  verifyDriverSession:async()=>{throw Error('no')},
  authorizeDriver:async()=>true,allowRequest:()=>true,submitPending:async()=>application
 });
 assert.equal((await g({method:'GET',path:'/v1/staging/vehicle-applications'})).status,404);
 assert.equal((await g({method:'POST',path:'/v1/staging/admin/vehicle-reviews'})).status,404);
 assert.equal(calls.length,0);
});
