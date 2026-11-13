import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
const receiver=file('../../app/recibir-ubicacion.tsx');
const transport=file('../../app/transporte.tsx');
const native=file('../native/client-location.native.ts');
const web=file('../native/client-location.ts');

test('G331 native geocoder is invoked once per explicit user acceptance, not per key press or lifecycle refresh',()=>{
 assert.match(receiver,/async function locateSharedPlace\(\)/);
 assert.match(receiver,/if\(!candidate\.ok\|\|requestBusy\.current/);
 assert.match(receiver,/requestPassengerDestinationGeocoderPermission\(\)/);
 assert.match(receiver,/await searchPassengerDestination\(query\)/);
 assert.match(receiver,/onPress=\{\(\)=>\{void locateSharedPlace\(\);\}\}/);
 assert.match(receiver,/requestEpoch\.current\+\+/);
 assert.match(receiver,/if\(state==='background'\)/);
 assert.doesNotMatch(receiver,/setInterval\(|watchPositionAsync\(|onChangeText=|fetch\(/);
 assert.match(native,/requestForegroundPermissionsAsync\(\)/);
 assert.match(web,/requestPassengerDestinationGeocoderPermission\(\):Promise<boolean>/);
});
test('G331 native result needs explicit place choice and later confirmation; no booking or price',()=>{
 assert.match(receiver,/places\.map\(\(place,i\)=>/);
 assert.match(receiver,/onPress=\{\(\)=>selectVerifiedPlace\(place\)\}/);
 assert.match(receiver,/stageGoogleMapsGeocodedCandidate\(candidate\.query,place\)/);
 assert.match(receiver,/Contin[uú]ar con b[uú]squeda manual/);
 assert.match(transport,/setDropoff\(shared\.place\?\?null\)/);
 assert.match(transport,/setDestinationConfirmed\(false\)/);
 assert.match(transport,/const pointsSelected=pickup!==null&&dropoff!==null&&/);
 assert.match(transport,/pickupConfirmed&&destinationConfirmed/);
 assert.doesNotMatch(receiver,/requestMotoQuote|reserveQuotedAuto|bookMoto|fetch\(|AsyncStorage|SecureStore/);
});
