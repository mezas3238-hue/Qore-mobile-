import test from 'node:test';
import assert from 'node:assert/strict';
import {checkOfferCandidate, type OfferCandidate} from './vehicle-eligibility.ts';
const now=Date.parse('2026-10-16T12:00:00Z');
const base:OfferCandidate={
 driverStatus:'approved',vehicleStatus:'approved',vehicleKind:'AUTO',service:'economico',
 driverLicenseVerified:true,vehicleRegistrationVerified:true,insuranceVerified:true,
 insuranceCoversPaidPassengers:true,insuranceExpiryDate:'2026-12-31',
 inspectionVerified:true,inspectionExpiryDate:'2026-12-31',municipalAuthorizationVerified:true,
 motoHelmetsVerified:0,motoReflectiveVestsVerified:0,
 motoPassengerAgeVerified12Plus:false,motoRouteSafetyAllowed:false,locationOptIn:true,locationUpdatedAtMs:now-5000,
};
test('auto elegible bajo evidencias hipotéticas verificadas',()=>assert.deepEqual(checkOfferCandidate(base,now),{eligible:true}));
test('no se puede ofrecer moto bajo categoría auto ni auto bajo moto',()=>{
 assert.equal(checkOfferCandidate({...base,vehicleKind:'MOTO'},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,service:'moto_pasajero'},now).eligible,false);
});
test('moto requiere dos cascos, permiso de ruta y evidencias diferenciadas',()=>{
 const moto={...base,vehicleKind:'MOTO' as const,service:'moto_pasajero' as const};
 assert.equal(checkOfferCandidate(moto,now).eligible,false);
 assert.equal(checkOfferCandidate({...moto,motoHelmetsVerified:2},now).eligible,false);
 assert.equal(checkOfferCandidate({...moto,motoHelmetsVerified:2,motoReflectiveVestsVerified:2,motoPassengerAgeVerified12Plus:true,motoRouteSafetyAllowed:true},now).eligible,true);
});
test('no conductor o vehículo pendiente, rechazado o suspendido',()=>{
 for(const status of ['pending','rejected','suspended'] as const){
  assert.equal(checkOfferCandidate({...base,driverStatus:status},now).eligible,false);
  assert.equal(checkOfferCandidate({...base,vehicleStatus:status},now).eligible,false);
 }
});
test('seguro debe cubrir pasajeros remunerados y no estar vencido',()=>{
 assert.equal(checkOfferCandidate({...base,insuranceVerified:false},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,insuranceCoversPaidPassengers:false},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,insuranceExpiryDate:'2026-10-15'},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,insuranceExpiryDate:'2026-02-31'},now).eligible,false);
});
test('inspección y habilitación legal obligatorias',()=>{
 assert.equal(checkOfferCandidate({...base,inspectionVerified:false},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,inspectionExpiryDate:'2025-01-01'},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,municipalAuthorizationVerified:false},now).eligible,false);
});
test('GPS requiere consentimiento y timestamp vigente',()=>{
 assert.equal(checkOfferCandidate({...base,locationOptIn:false},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,locationUpdatedAtMs:null},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,locationUpdatedAtMs:now-180000},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,locationUpdatedAtMs:now+16000},now).eligible,false);
});
test('evidencia insuficiente o reloj inválido nunca resulta elegible',()=>{
 assert.equal(checkOfferCandidate({...base,driverLicenseVerified:false},now).eligible,false);
 assert.equal(checkOfferCandidate({...base,vehicleRegistrationVerified:false},now).eligible,false);
 assert.equal(checkOfferCandidate(base,NaN).eligible,false);
});

test('moto exige chalecos reflectivos en ambos y pasajero >=12 verificado en servidor',()=>{
 const moto={...base,vehicleKind:'MOTO' as const,service:'moto_pasajero' as const,
  motoHelmetsVerified:2,motoReflectiveVestsVerified:2,motoPassengerAgeVerified12Plus:true,motoRouteSafetyAllowed:true};
 assert.equal(checkOfferCandidate(moto,now).eligible,true);
 assert.equal(checkOfferCandidate({...moto,motoReflectiveVestsVerified:1},now).eligible,false);
 assert.equal(checkOfferCandidate({...moto,motoPassengerAgeVerified12Plus:false},now).eligible,false);
});
