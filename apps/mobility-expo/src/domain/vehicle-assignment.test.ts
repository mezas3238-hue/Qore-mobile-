import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareVehicleAssignment,type AssignmentProposalInput} from './vehicle-assignment.ts';
const now=Date.parse('2026-10-16T12:00:00.000Z');
const driverId='22222222-2222-4222-8222-222222222222';
const passengerId='11111111-1111-4111-8111-111111111111';
const vehicleId='33333333-3333-4333-8333-333333333333';
const rideId='44444444-4444-4444-8444-444444444444';
const otherDriver='55555555-5555-4555-8555-555555555555';
const base:AssignmentProposalInput={
 rideId,passengerId,rideStatus:'searching',existingDriverId:null,requestedService:'economico',
 rideVersion:5,actorId:driverId,driverId,vehicleId,vehicleOwnerId:driverId,vehicleRevision:9,
 candidate:{
  driverStatus:'approved',vehicleStatus:'approved',vehicleKind:'AUTO',service:'economico',
  driverLicenseVerified:true,vehicleRegistrationVerified:true,
  insuranceVerified:true,insuranceCoversPaidPassengers:true,insuranceExpiryDate:'2026-12-31',
  inspectionVerified:true,inspectionExpiryDate:'2026-12-31',municipalAuthorizationVerified:true,
  motoHelmetsVerified:0,motoReflectiveVestsVerified:0,
 motoPassengerAgeVerified12Plus:false,motoRouteSafetyAllowed:false,locationOptIn:true,locationUpdatedAtMs:now-2000,
 }
};
test('propuesta auto enlaza vehículo concreto, conductor, versiones y TTL',()=>{
 const r=prepareVehicleAssignment(base,now);
 assert.equal(r.ok,true);
 if(!r.ok)return;
 assert.deepEqual(r.proposal,{
  rideId,passengerId,driverId,vehicleId,vehicleKind:'AUTO',service:'economico',
  expectedRideVersion:5,expectedVehicleRevision:9,proposedAtMs:now,expiresAtMs:now+5000,
 });
 assert.equal(Object.isFrozen(r.proposal),true);
});
test('rechaza suplantación del conductor o vehículo ajeno',()=>{
 assert.deepEqual(prepareVehicleAssignment({...base,actorId:otherDriver},now),{ok:false,code:'VEHICLE_OWNERSHIP'});
 assert.deepEqual(prepareVehicleAssignment({...base,actorId:passengerId},now),{ok:false,code:'INVALID_CONTEXT'});
 assert.deepEqual(prepareVehicleAssignment({...base,vehicleOwnerId:passengerId},now),{ok:false,code:'VEHICLE_OWNERSHIP'});
});
test('rechaza viaje ya tomado y asignación doble',()=>{
 for(const change of [{rideStatus:'accepted' as const},{existingDriverId:driverId}]){
  assert.deepEqual(prepareVehicleAssignment({...base,...change},now),{ok:false,code:'RIDE_NOT_SEARCHING'});
 }
});
test('no acepta moto para pedido auto ni auto para pedido moto',()=>{
 assert.equal(prepareVehicleAssignment({...base,candidate:{...base.candidate,vehicleKind:'MOTO'}},now).ok,false);
 assert.deepEqual(prepareVehicleAssignment({...base,requestedService:'moto_pasajero'},now),{ok:false,code:'SERVICE_MISMATCH'});
});
test('moto habilitada solo con dos cascos, zona y cobertura acreditadas',()=>{
 const moto={...base,requestedService:'moto_pasajero' as const,
  candidate:{...base.candidate,vehicleKind:'MOTO' as const,service:'moto_pasajero' as const,motoHelmetsVerified:2,motoReflectiveVestsVerified:2,
   motoPassengerAgeVerified12Plus:true,motoRouteSafetyAllowed:true}};
 assert.equal(prepareVehicleAssignment(moto,now).ok,true);
 assert.deepEqual(prepareVehicleAssignment({...moto,candidate:{...moto.candidate,motoHelmetsVerified:1}},now),{ok:false,code:'COMPLIANCE_DENIED'});
 assert.deepEqual(prepareVehicleAssignment({...moto,candidate:{...moto.candidate,motoRouteSafetyAllowed:false}},now),{ok:false,code:'COMPLIANCE_DENIED'});
 assert.deepEqual(prepareVehicleAssignment({...moto,candidate:{...moto.candidate,motoPassengerAgeVerified12Plus:false}},now),{ok:false,code:'COMPLIANCE_DENIED'});
});
test('vencimientos, seguro, estado, revocación GPS niegan propuesta',()=>{
 const changes=[
  {insuranceExpiryDate:'2026-10-15'},
  {insuranceCoversPaidPassengers:false},
  {inspectionExpiryDate:'2026-10-15'},
  {municipalAuthorizationVerified:false},
  {driverStatus:'suspended' as const},
  {vehicleStatus:'pending' as const},
  {locationOptIn:false},
  {locationUpdatedAtMs:now-121_000},
 ];
 for(const ch of changes){
  assert.deepEqual(prepareVehicleAssignment({...base,candidate:{...base.candidate,...ch}},now),{ok:false,code:'COMPLIANCE_DENIED'},JSON.stringify(ch));
 }
});
test('IDs inválidos, versiones inconsistentes y tiempo no confiable niegan',()=>{
 const changes=[
  {rideId:'invalid'}, {vehicleId:'fake'}, {driverId:passengerId,vehicleOwnerId:passengerId,actorId:passengerId},
  {rideVersion:-1}, {vehicleRevision:0},
 ];
 for(const ch of changes)assert.deepEqual(prepareVehicleAssignment({...base,...ch},now),{ok:false,code:'INVALID_CONTEXT'},JSON.stringify(ch));
 assert.deepEqual(prepareVehicleAssignment(base,NaN),{ok:false,code:'INVALID_CONTEXT'});
});
