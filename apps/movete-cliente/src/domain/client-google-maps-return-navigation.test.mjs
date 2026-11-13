import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stageGoogleMapsGeocodedCandidate,consumeGoogleMapsShare,
 clearGoogleMapsShare} from './client-google-maps-share.mjs';

const screen=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const transport=screen('../../app/transporte.tsx');
const receiver=screen('../../app/recibir-ubicacion.tsx');

test('G333 share return targets an existing Transporte screen when one is open',()=>{
 assert.match(transport,/import \{router,useFocusEffect\} from 'expo-router'/);
 assert.match(transport,/useFocusEffect\(useCallback\(\(\)=>\{/);
 assert.match(transport,/const shared=consumeGoogleMapsShare\(\)/);
 assert.match(transport,/setDestinationConfirmed\(false\)/);
 assert.equal((receiver.match(/router\.dismissTo\('\/transporte'\)/g)??[]).length,3);
 assert.doesNotMatch(receiver,/router\.replace\('\/transporte'\)/);
});
test('G333 focus callback preserves single-use and expiry even on repeated screen focus',()=>{
 clearGoogleMapsShare();
 const point={label:'Shopping Paris',latitude:-25.516,longitude:-54.615};
 assert.equal(stageGoogleMapsGeocodedCandidate('Shopping Paris',point,5000),true);
 const first=consumeGoogleMapsShare(5010);
 assert.equal(first.place.label,'Shopping Paris');
 assert.equal(consumeGoogleMapsShare(5011),null);
 assert.equal(stageGoogleMapsGeocodedCandidate('Shopping Paris',point,5000),true);
 assert.equal(consumeGoogleMapsShare(125001),null);
});
test('G333 focus-based share consumption does not restart GPS or create trip',()=>{
 const match=transport.match(/useFocusEffect\(useCallback\(\(\)=>\{([\s\S]*?)\},\[\]\)\);/);
 assert.ok(match,'share focus callback must exist');
 const flow=match[1];
 assert.doesNotMatch(flow,/refreshPickup|searchPassengerDestination|getPassengerCurrentPickup|requestForegroundPermissions|router\.push|fetch\(/);
 assert.match(flow,/setDropoff\(shared\.place\?\?null\)/);
 assert.match(flow,/setDestinationConfirmed\(false\)/);
});
