import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const picker=get('../PassengerPlaceFields.tsx');
const auto=get('../../app/viaje.tsx');
const moto=get('../../app/moto.tsx');
const native=get('../native/client-location.native.ts');

test('G325 AUTO/MOTO use the same deliberate GPS and destination picker, not raw edit boxes',()=>{
 assert.match(auto,/<PassengerPlaceFields origin=\{pickup\} destination=\{destination\}/);
 assert.match(auto,/editable=\{free\} onOriginChange=\{editPickup\}/);
 assert.match(auto,/onDestinationChange=\{editDestination\}/);
 assert.match(moto,/<PassengerPlaceFields origin=\{origin\} destination=\{destination\}/);
 assert.match(moto,/editable=\{canEdit\} onOriginChange=/);
 assert.match(moto,/onDestinationChange=\{value=>edit\(setDestination,value\)\}/);
 assert.doesNotMatch(auto,/accessibilityLabel="Origen del viaje"\/>/);
 assert.doesNotMatch(moto,/accessibilityLabel="Destino del viaje MOTO"\s*\/>/);
});
test('G325 origin on tap is a single foreground GPS request; destination opens search',()=>{
 assert.match(picker,/onPress=\{\(\)=>\{void locatePickup\(\);\}\}/);
 assert.match(picker,/const lease=budget\.beginGps\(\{manual:true\}\)/);
 assert.match(picker,/await getPassengerCurrentPickup\(\)/);
 assert.match(picker,/onPress=\{\(\)=>\{void openDestinationPicker\(\);\}\}/);
 assert.match(picker,/setPickerOpen\(true\)/);
 assert.match(picker,/await requestPassengerGeocoderPermission\(\)/);
 assert.match(native,/requestForegroundPermissionsAsync\(\)/);
 assert.match(picker,/const lease=budget\.beginDestination\(candidate\)/);
 assert.match(picker,/await searchPassengerDestination\(candidate\)/);
 assert.match(picker,/onSubmitEditing=\{\(\)=>\{void searchPlace\(\);\}\}/);
 assert.doesNotMatch(picker,/watchPositionAsync\(|getLastKnownPositionAsync\(|setInterval\(/);
});
test('G325 only user can preview map and explicitly confirm native geocoded point',()=>{
 assert.match(picker,/await Linking\.openURL\(urls\.primary\)/);
 assert.match(picker,/onPress=\{\(\)=>\{void viewSelectedMap\(\);\}\}/);
 assert.match(picker,/onDestinationChange\(selected\.label\)/);
 assert.match(picker,/void viewSelectedMap\(place\)/);
 assert.match(picker,/Preserve the chosen/);
 assert.match(picker,/disabled=\{!editable\|\|gpsBusy\|\|searchBusy\}/);
 assert.match(picker,/epoch\.current\+\+/);
 assert.match(picker,/request!==epoch\.current/);
 assert.doesNotMatch(picker,/\bfetch\(|AsyncStorage|SecureStore|requestAutoQuote\(|bookMoto\(/);
});
