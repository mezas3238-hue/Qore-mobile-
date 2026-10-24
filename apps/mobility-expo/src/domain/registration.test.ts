import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDriver, validatePassenger } from './registration.ts';
const passenger={fullName:'María López',phone:'+595 981 123456',email:'cliente@example.test',password:'claveSeguro2026',consent:true};
const driver={fullName:'Juan López',phone:'+595 981 123456',licenseNumber:'LIC-123456',plate:'ABC123',brand:'Toyota',model:'Etios',color:'Blanco',year:'2020',category:'economico' as const,licensePhotoSelected:true,consent:true};
test('pasajero: datos base válidos para solicitud de cuenta',()=>assert.equal(validatePassenger(passenger),null));
test('pasajero: consentimiento obligatorio',()=>assert.match(validatePassenger({...passenger,consent:false})??'',/aceptar/));
test('pasajero: contraseña fuerte y correo válidos',()=>{
 assert.ok(validatePassenger({...passenger,password:'1234567890'}));
 assert.ok(validatePassenger({...passenger,email:'incorrecto'}));
});
test('conductor auto: solicitud válida NO significa aprobación',()=>assert.equal(validateDriver(driver),null));
test('conductor: documento seleccionado y consentimiento obligatorios',()=>{
 assert.ok(validateDriver({...driver,licensePhotoSelected:false}));
 assert.ok(validateDriver({...driver,consent:false}));
});
test('conductor: no aceptar años imposibles ni placas vacías',()=>{
 assert.ok(validateDriver({...driver,year:'1980'}));
 assert.ok(validateDriver({...driver,year:'no'}));
 assert.ok(validateDriver({...driver,plate:'ABC'}));
});
test('backend actual solo soporta categorías auto; moto no se falsea como económico',()=>{
 assert.ok(validateDriver({...driver,category:'moto_pasajero' as typeof driver.category}));
});
test('conductor: licencia y teléfono requeridos',()=>{
 assert.ok(validateDriver({...driver,licenseNumber:'abc'}));
 assert.ok(validateDriver({...driver,phone:'x'}));
});
