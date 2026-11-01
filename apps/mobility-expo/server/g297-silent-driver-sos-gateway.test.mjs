/** G297 disposable Node QA. No real identity, GPS, SOS or emergency outbound. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createG297SilentDriverSosGateway} from './g297-silent-driver-sos-gateway.mjs';
const PROJECT='mrjzxftsdxzepzbcuids';
const DRIVER='00000000-0000-4000-8000-000000000011';
const PASSENGER='00000000-0000-4000-8000-000000000022';
const SESSION='00000000-0000-4000-8000-000000000033';
const TRIP='00000000-0000-4000-8000-000000000044';
const REQUEST='00000000-0000-4000-8000-000000000055';
const INCIDENT='00000000-0000-4000-8000-000000000066';
const RECEIPT='00000000-0000-4000-8000-000000000077';
const token='Bearer '+'S'.repeat(80);
const input=(body={requestKey:REQUEST})=>({
 method:'POST',path:'/v1/staging/driver/sos',headers:{authorization:token},body
});
const setup=(patch={})=>{
 const calls={trip:[],identity:[],store:[]};
 const deps={
  projectRef:PROJECT,environment:'isolated_staging',liveEnabled:false,qaApproved:true,
  verifyDriverSession:async()=>({
   userId:DRIVER,sessionId:SESSION,tokenIatMs:1760000000000,role:'driver',providerVerified:true,sessionActive:true
  }),
  lookupAssignedTrip:async request=>{
   calls.trip.push(request);
   return {tripId:TRIP,passengerId:PASSENGER,driverId:DRIVER,status:'in_progress',
    vehicleKind:'AUTO'};
  },
  lookupIdentityReceipt:async request=>{
   calls.identity.push(request);return {status:'VERIFIED',receiptId:RECEIPT};
  },
  persistAtomicIncident:async request=>{
   calls.store.push(request);return {
    incidentId:INCIDENT,atomicCommitted:true,liveEnabled:false,idempotent:false
   };
  },
  allowRequest:()=>true,...patch
 };
 return {gateway:createG297SilentDriverSosGateway(deps),calls};
};
test('G297 cannot be constructed without STAGING approval and every provider',()=>{
 const {gateway}=setup();
 assert.equal(typeof gateway,'function');
 for(const edit of [{qaApproved:false},{liveEnabled:true},{environment:'production'},
    {verifyDriverSession:null},{persistAtomicIncident:undefined},
    {lookupAssignedTrip:null},{lookupIdentityReceipt:null}])
  assert.throws(()=>setup(edit),/G297 requires approved STAGING/);
});
test('G297 valid driver SOS atomically stores verified receipt but returns no PII',async()=>{
 const {gateway,calls}=setup();
 const result=await gateway(input());
 assert.equal(result.status,201);
 assert.deepEqual(result.body,{
  mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
  externalResponseDispatched:false,operatorAcknowledged:false,
  incidentId:INCIDENT,serverPersisted:true,idempotent:false,journeyContinues:true
 });
 assert.deepEqual(calls.trip,[{driverId:DRIVER,sessionId:SESSION}]);
 assert.deepEqual(calls.identity,[{passengerId:PASSENGER,tripId:TRIP}]);
 assert.deepEqual(calls.store,[{
  actorId:DRIVER,sessionId:SESSION,tokenIatMs:1760000000000,requestKey:REQUEST,tripId:TRIP,
  passengerId:PASSENGER,vehicleKind:'AUTO',verificationStatus:'VERIFIED',
  identityReceiptId:RECEIPT
 }]);
 const rendered=JSON.stringify(result);
 for(const secret of [PASSENGER,RECEIPT,TRIP,'document','phone','gps','address'])
  assert.equal(rendered.includes(secret),false,'Do not expose '+secret);
});
test('G297 does not allow client to inject trip, passenger, identity, GPS or free-text',async()=>{
 const {gateway,calls}=setup();
 for(const body of [
  {requestKey:REQUEST,passengerId:PASSENGER},
  {requestKey:REQUEST,tripId:TRIP},
  {requestKey:REQUEST,latitude:1},
  {requestKey:REQUEST,identityReceiptId:RECEIPT},
  {requestKey:REQUEST,message:'urgent'},
  {requestKey:REQUEST,longitude:1},
  {},[],null
 ]){
  assert.equal((await gateway(input(body))).status,400);
 }
 assert.deepEqual(calls.store,[]);
});
test('G297 rejects forged/missing bearer and non-driver or unverified session',async()=>{
 const {gateway}=setup();
 assert.equal((await gateway({...input(),headers:{}})).status,401);
 for(const data of [
  {role:'passenger'},
  {providerVerified:false},
  {sessionActive:false},
  {sessionId:null},
  {tokenIatMs:null}
 ]){
  const {gateway:forged}=setup({
   verifyDriverSession:async()=>({
    userId:DRIVER,sessionId:SESSION,role:'driver',
    providerVerified:true,sessionActive:true,...data
   })
  });
  assert.equal((await forged(input())).status,403);
 }
 const {gateway:otherUser}=setup({verifyDriverSession:async()=>({
  userId:PASSENGER,sessionId:SESSION,tokenIatMs:1760000000000,role:'driver',providerVerified:true,sessionActive:true
 })});
 // A valid but different Driver cannot own the requested active ride.
 assert.equal((await otherUser(input())).status,409);
 const {gateway:revoked}=setup({verifyDriverSession:async()=>{throw Error('revoked')}});
 assert.equal((await revoked(input())).status,401);
});
test('G297 denies missing, mismatched, completed or unassigned trip',async()=>{
 for(const result of [null,
   {tripId:TRIP,passengerId:PASSENGER,driverId:PASSENGER,status:'in_progress',vehicleKind:'AUTO'},
   {tripId:TRIP,passengerId:PASSENGER,driverId:DRIVER,status:'completed',vehicleKind:'AUTO'},
   {tripId:TRIP,passengerId:PASSENGER,driverId:DRIVER,status:'in_progress',vehicleKind:'CAR'}
 ]){
  const {gateway,calls}=setup({lookupAssignedTrip:async()=>result});
  assert.equal((await gateway(input())).status,409);
  assert.deepEqual(calls.store,[]);
 }
});
test('G297 records SOS even when independent passenger KYC is absent or offline',async()=>{
 for(const lookupIdentityReceipt of [
  async()=>{throw Error('provider unavailable')},
  async()=>({status:'NOT_VERIFIED',receiptId:null}),
  async()=>({status:'VERIFIED',receiptId:null}),
  async()=>({status:'VERIFIED',receiptId:RECEIPT,rawDocument:'SECRET'})
 ]){
  const {gateway,calls}=setup({lookupIdentityReceipt});
  const res=await gateway(input());
  assert.equal(res.status,201);
  assert.equal(calls.store[0].verificationStatus,'NOT_VERIFIED');
  assert.equal(calls.store[0].identityReceiptId,null);
 }
});
test('G297 never acknowledges an incident without atomic persisted commit',async()=>{
 const {gateway}=setup({persistAtomicIncident:async()=>({
  incidentId:INCIDENT,atomicCommitted:false,liveEnabled:false
 })});
 const res=await gateway(input());
 assert.equal(res.status,503);
 assert.equal('incidentId' in res.body,false);
});
test('G297 honors rate limits and exposes idempotent replay only as same incident',async()=>{
 const memory=new Map();
 const persistAtomicIncident=async payload=>{
  const key=payload.actorId+':'+payload.requestKey;
  const seen=memory.has(key);
  if(!seen)memory.set(key,INCIDENT);
  return {incidentId:memory.get(key),atomicCommitted:true,liveEnabled:false,
   idempotent:seen};
 };
 const {gateway}=setup({persistAtomicIncident});
 const once=await gateway(input()),twice=await gateway(input());
 assert.equal(once.status,201);
 assert.equal(twice.status,200);
 assert.equal(once.body.incidentId,twice.body.incidentId);
 assert.equal(twice.body.idempotent,true);
 const blocked=setup({allowRequest:()=>false});
 assert.equal((await blocked.gateway(input())).status,429);
});
test('G297 no handler for another path/method (no authenticated data disclosure)',async()=>{
 const {gateway}=setup();
 assert.equal((await gateway({...input(),method:'GET'})).status,404);
 assert.equal((await gateway({...input(),path:'/v1/staging/admin/safety'})).status,404);
});
