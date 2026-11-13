import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../../app/transporte.tsx',import.meta.url),'utf8');

test('G328 route preview is available only for confirmed pickup and destination',()=>{
 assert.match(screen,/const pointsSelected=pickup!==null&&dropoff!==null/);
 assert.match(screen,/pickupConfirmed&&destinationConfirmed/);
 assert.match(screen,/\{pointsSelected&&<Action secondary label="Ver recorrido en mi Google Maps"/);
 assert.match(screen,/if\(!pointsSelected\|\|!pickup\|\|!dropoff\)return/);
 assert.match(screen,/createGoogleMapsDirectionsUrl\(pickup,dropoff\)/);
 assert.match(screen,/await Linking\.openURL\(url\)/);
});
test('G328 external route view does not create local prices, booking or background GPS',()=>{
 assert.match(screen,/La tarifa y la cobertura de Movete Fácil deben verificarse en el servidor/);
 assert.match(screen,/No local price or trip claim is derived from its navigation screen/);
 assert.doesNotMatch(screen,/watchPositionAsync\(|requestAutoQuote\(|reserveQuotedAuto\(/);
});
