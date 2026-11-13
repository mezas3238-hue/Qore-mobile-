import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const screen=readFileSync(new URL('../../app/transporte.tsx',import.meta.url),'utf8');

test('G334 tapping Origen must attempt a current foreground GPS fix before Maps',()=>{
 assert.match(screen,/async function openPersonalGoogleMaps\(kind:'pickup'\|'destination'\)/);
 assert.match(screen,/if\(kind==='pickup'\)\{/);
 assert.match(screen,/await refreshPickup\(true\)\?\?null/);
 assert.match(screen,/const url=createGoogleMapsLaunchUrl\(kind,mapsPickup\)/);
 assert.match(screen,/if\(!mapsPickup\)\{/);
 assert.match(screen,/lastGpsFixPlace\.current=result\.place/);
 assert.match(screen,/mapsPickup\.latitude!==lastGpsFixPlace\.current\.latitude/);
 assert.match(screen,/mapsPickup\.longitude!==lastGpsFixPlace\.current\.longitude/);
 assert.match(screen,/Date\.now\(\)-lastGpsFixAt\.current>30000/);
 assert.match(screen,/onPress=\{\(\)=>\{void openPersonalGoogleMaps\('pickup'\);\}\}/);
});
test('G334 GPS busy or denied cannot open Maps with fake or stale marker',()=>{
 assert.match(screen,/if\(gpsBusy\|\|searchBusy\|\|locationBudget\.busy\(\)\)\{/);
 assert.match(screen,/Todavía no tenemos tu ubicación GPS precisa/);
 assert.match(screen,/accessibilityState=\{\{disabled:gpsBusy\|\|searchBusy\}\}/);
 assert.match(screen,/getPassengerCurrentPickup\(\)/);
 assert.match(screen,/GPS_NOT_PRECISE/);
 assert.doesNotMatch(screen,/watchPositionAsync\(|setInterval\(/);
});
