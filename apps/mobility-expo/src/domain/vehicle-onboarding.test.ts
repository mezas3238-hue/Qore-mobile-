import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareVehicleApplication,type VehicleApplicationDraft} from './vehicle-onboarding.ts';

const base:VehicleApplicationDraft={
 driverName:'Nombre Test',contactPhone:'+595981234567',driverLicenseNumber:'LIC1234',
 driverLicensePhotoSelected:true,kind:'AUTO',service:'economico',
 countryCode:'PY',municipalityCode:'ASUNCION',plate:'abc 123',brand:'Toyota',
 model:'Corolla',year:'2021',passengerCapacity:4,vehicleRegistrationSelected:true,
 commercialPassengerInsuranceSelected:true,inspectionEvidenceSelected:true,
 municipalPermitSelected:true,motorcycleHelmetEvidenceSelected:false,
 motorcycleHelmetCount:0,motorcycleReflectiveVestCount:0,
 motorcycleReflectiveVestEvidenceSelected:false,personalDataConsent:true,
};
test('AUTO prepara solicitud pendiente y normaliza la chapa sin certificar documentos',()=>{
 const result=prepareVehicleApplication(base);
 assert.equal(result.ok,true);
 if(!result.ok)return;
 assert.equal(result.draft.reviewStatus,'pending');
 assert.equal(result.draft.plateNormalized,'ABC123');
 assert.equal(result.draft.vehicleKind,'AUTO');
 assert.equal(result.draft.evidencePendingHumanReview,true);
 assert.equal(Object.isFrozen(result.draft),true);
 assert.equal('insuranceVerified' in result.draft,false);
 assert.equal('driverApproved' in result.draft,false);
});
test('MOTO solicita un pasajero y prueba de dos cascos, sin activar transporte',()=>{
 const moto:VehicleApplicationDraft={...base,kind:'MOTO',service:'moto_pasajero',
  passengerCapacity:1,motorcycleHelmetCount:2,motorcycleHelmetEvidenceSelected:true,
  motorcycleReflectiveVestCount:2,motorcycleReflectiveVestEvidenceSelected:true};
 const r=prepareVehicleApplication(moto);
 assert.equal(r.ok,true);
 if(r.ok)assert.equal(r.draft.service,'moto_pasajero');
 for(const c of [
  {...moto,motorcycleHelmetCount:1},
  {...moto,motorcycleHelmetEvidenceSelected:false},
  {...moto,motorcycleReflectiveVestCount:1},
  {...moto,motorcycleReflectiveVestEvidenceSelected:false},
  {...moto,passengerCapacity:2}
 ])assert.equal(prepareVehicleApplication(c).ok,false);
});
test('no deja elegir servicio moto en AUTO ni servicio AUTO en MOTO',()=>{
 assert.equal(prepareVehicleApplication({...base,service:'moto_pasajero'}).ok,false);
 assert.equal(prepareVehicleApplication({...base,kind:'MOTO'}).ok,false);
});
test('XL exige capacidad declarada suficiente; no certifica plazas',()=>{
 assert.equal(prepareVehicleApplication({...base,service:'xl',passengerCapacity:4}).ok,false);
 assert.equal(prepareVehicleApplication({...base,service:'xl',passengerCapacity:6}).ok,true);
});
test('no se puede omitir evidencia de seguro para pasajeros remunerados ni permiso municipal',()=>{
 for(const change of [
  {driverLicensePhotoSelected:false},{vehicleRegistrationSelected:false},
  {commercialPassengerInsuranceSelected:false},{inspectionEvidenceSelected:false},
  {municipalPermitSelected:false},{personalDataConsent:false}
 ])assert.equal(prepareVehicleApplication({...base,...change}).ok,false,JSON.stringify(change));
});
test('no acepta chapa/código de país/municipio mal formados ni año fuera de rango',()=>{
 for(const change of [
  {plate:'?'},{countryCode:'PY '},{municipalityCode:' '},
  {year:'1900'},{year:'9999'},{year:'2020abc'},{passengerCapacity:NaN}
 ])assert.equal(prepareVehicleApplication({...base,...change}).ok,false,JSON.stringify(change));
});
test('datos de contacto y licencia deben estar completos',()=>{
 for(const change of [
  {driverName:'A'}, {contactPhone:'abc'}, {driverLicenseNumber:'-'}
 ])assert.equal(prepareVehicleApplication({...base,...change}).ok,false);
});
test('aun si JS inyecta nombre de prototipo, no se admite servicio desconocido',()=>{
 assert.equal(prepareVehicleApplication({...base,service:'__proto__' as VehicleApplicationDraft['service']}).ok,false);
});
