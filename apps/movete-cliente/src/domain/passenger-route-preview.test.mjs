import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const picker=source('../PassengerPlaceFields.tsx');
const preview=source('../PassengerRoutePreview.native.tsx');
const web=source('../PassengerRoutePreview.tsx');

test('G327 AUTO/MOTO share in-app map preview for two matching confirmed points',()=>{
 assert.match(picker,/<PassengerRoutePreview enabled=\{nativeMapReady\}/);
 assert.match(picker,/nativePickup\?\.label===origin\?nativePickup:null/);
 assert.match(picker,/nativeDropoff\?\.label===destination\?nativeDropoff:null/);
 assert.match(preview,/<MapView key=\{mapKey\}/);
 assert.match(preview,/title="Origen"/);
 assert.match(preview,/title="Destino"/);
 assert.match(preview,/if\(!enabled\|\|!valid\(pickup\)\)return null/);
 assert.match(web,/return null/);
});

test('G327 roadmap cannot pretend road geometry, fares, drivers or bookings exist',()=>{
 assert.doesNotMatch(preview,/<Polyline/);
 assert.doesNotMatch(preview, /\bfetch\(|\baxios\(|requestMotoQuote\(|reserveQuotedAuto\(/);
 assert.match(preview,/Recorrido por calles, distancia, tiempo y tarifa: pendientes/);
 assert.match(preview,/showsUserLocation=\{false\}/);
 assert.match(preview,/scrollEnabled=\{false\}/);
 assert.match(preview,/zoomEnabled=\{false\}/);
 assert.doesNotMatch(preview,/watchPositionAsync\(|setInterval\(/);
});
