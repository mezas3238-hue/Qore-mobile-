import test from 'node:test';
import assert from 'node:assert/strict';
import { mapsDirectionsUrl, wazeDirectionsUrl, validPoint } from './navigation.ts';
import { validateDriver, validatePassenger } from './registration.ts';
const a = { lat: -25.282, lng: -57.635 };
const b = { lat: -25.284, lng: -57.565 };
test('Google Maps usa API 1 y destino/origen válidos', () => {
  const url = mapsDirectionsUrl(b, a);
  assert.match(url, /^https:\/\/www.google.com\/maps\/dir\/\?api=1/);
  assert.match(url, /destination=-25.284%2C-57.565/);
  assert.match(url, /origin=-25.282%2C-57.635/);
  assert.match(url, /travelmode=driving/);
});
test('Waze usa deep link oficial sin exponer datos personales', () => {
  assert.match(wazeDirectionsUrl(b), /^https:\/\/waze.com\/ul\?ll=/);
  assert.match(wazeDirectionsUrl(b), /navigate=yes/);
});
test('Rechaza coordenadas fuera de rango / NaN', () => {
  assert.equal(validPoint({lat: 100, lng: 5}), false);
  assert.throws(() => mapsDirectionsUrl({ lat: Number.NaN, lng: 2 }));
  assert.throws(() => wazeDirectionsUrl({ lat: -25, lng: 200 }));
});
test('Registro pasajero valida email, teléfono, contraseña y consentimiento', () => {
  const v = {fullName:'Ana Lopez',phone:'+595981123456',email:'ana@example.com',password:'Password12345',consent:true};
  assert.equal(validatePassenger(v), null);
  assert.notEqual(validatePassenger({...v,consent:false}), null);
  assert.notEqual(validatePassenger({...v,password:'short'}), null);
});
test('Alta de conductor valida vehículo y foto de licencia', () => {
  const v = {fullName:'Ana Lopez',phone:'+595981123456',licenseNumber:'A123456',licensePhotoSelected:true,consent:true,
    plate:'AAA123',brand:'Toyota',model:'Vitz',color:'blanco',year:'2019',category:'economico' as const};
  assert.equal(validateDriver(v), null);
  assert.notEqual(validateDriver({...v,licensePhotoSelected:false}), null);
  assert.notEqual(validateDriver({...v,year:'1990'}), null);
});
