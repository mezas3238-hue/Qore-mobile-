import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PASSENGER_VEHICLE_KINDS,selectPassengerVehicle} from './passenger-vehicle-choice.mjs';

test('AUTO y MOTO pasajeros requieren selección expresa y cada uno usa su propio formulario',()=>{
 assert.deepEqual(PASSENGER_VEHICLE_KINDS,['AUTO','MOTO']);
 const auto=selectPassengerVehicle('AUTO'),moto=selectPassengerVehicle('MOTO');
 assert.equal(auto.ok,true);assert.equal(moto.ok,true);
 assert.equal(auto.route,'/viaje');assert.equal(moto.route,'/moto');
 assert.equal(auto.serviceKind,'AUTO_RIDE');assert.equal(moto.serviceKind,'MOTO_RIDE');
 assert.equal(auto.commissionBps,1500);assert.equal(moto.commissionBps,1200);
 assert.equal(auto.customerSubsidyBps,1000);assert.equal(moto.customerSubsidyBps,1000);
 assert.equal(auto.platformRetainsBps,500);assert.equal(moto.platformRetainsBps,200);
 assert.equal(Object.isFrozen(auto),true);assert.equal(Object.isFrozen(moto),true);
 assert.equal(Object.hasOwn(auto,'amountGs'),false);
 assert.equal(Object.hasOwn(moto,'driverId'),false);
});

test('no hay conversión silenciosa a envío MOTO, AUTO por defecto ni precio local',()=>{
 for(const mode of [null,undefined,'','MOTO_DELIVERY','delivery','COMMERCE','auto','AUTO ']){
  const x=selectPassengerVehicle(mode);
  assert.deepEqual(x,{ok:false,reason:'VEHICLE_SELECTION_REQUIRED'});
  assert.equal(Object.hasOwn(x,'route'),false);
 }
});

test('Inicio lleva al selector en ambos modos, y selector usa los formularios reales sin POST',()=>{
 const home=readFileSync(new URL('../../app/index.tsx',import.meta.url),'utf8');
 const screen=readFileSync(new URL('../../app/transporte.tsx',import.meta.url),'utf8');
 const nav=readFileSync(new URL('../../app/_layout.tsx',import.meta.url),'utf8');
 assert.equal((home.match(/router.push\('\/transporte'\)/g)??[]).length,2);
 assert.doesNotMatch(home,/router.push\('\/(?:viaje|moto)'\)/);
 assert.match(nav,/Stack.Screen name="transporte"/);
 assert.match(screen,/router.push\('\/viaje'\)/);
 assert.match(screen,/router.push\('\/moto'\)/);
 assert.match(screen,/disabled=\{!canContinue\}/);
 assert.match(screen,/const pointsSelected=pickup!==null&&dropoff!==null/);
 assert.match(screen,/getPassengerCurrentPickup/);
 assert.match(screen,/searchPassengerDestination/);
 assert.doesNotMatch(screen,/requestMotoQuote|bookMoto|reserveQuotedAuto|fetch\(/);
});

test('R80 MOTO route fields lock with a server quote and discard never books',()=>{
 const screen=readFileSync(new URL('../../app/moto.tsx',import.meta.url),'utf8');
 const flow=readFileSync(new URL('./g100-moto-passenger-flow.mjs',import.meta.url),'utf8');
 assert.match(screen,/const canEdit=moto\.phase==='idle'&&!sending/);
 assert.equal((screen.match(/editable=\{canEdit\}/g)??[]).length,2);
 assert.match(screen,/disabled=\{!canEdit\}/);
 assert.match(screen,/client\.discardMotoQuote\(\)/);
 assert.match(screen,/quoteExpired/);
 assert.match(flow,/\['quoted','accepted'\]\.includes\(state\.phase\)/);
 assert.doesNotMatch(screen,/resetMoto\(\)/);
});

test('G319 Android Client GPS must never loop on permission foreground or search per keystroke',()=>{
 const screen=readFileSync(new URL('../../app/transporte.tsx',import.meta.url),'utf8');
 const runtime=readFileSync(new URL('../ClientRuntime.tsx',import.meta.url),'utf8');
 const native=readFileSync(new URL('../native/client-location.native.ts',import.meta.url),'utf8');
 assert.match(screen,/locationBudget\.beginGps\(\{manual\}\)/);
 // Origin and destination now share one serialized geocoder budget.
 // Keep the no-per-keystroke rule without requiring the obsolete variable name.
 assert.match(screen,/const query=\(kind==='pickup'\?origin:destination\)\.trim\(\)/);
 assert.match(screen,/locationBudget\.beginDestination\(query\)/);
 assert.match(screen,/onPress=\{\(\)=>\{void findPlace\('pickup'\);\}\}/);
 assert.match(screen,/onPress=\{\(\)=>\{void findPlace\('destination'\);\}\}/);
 assert.match(screen,/useClientView\(\{polling:false\}\)/);
 assert.match(screen,/NO automatic re-entry into GPS or geocoder/);
 assert.doesNotMatch(screen,/setTimeout\(\(\)=>\{/);
 assert.match(runtime,/if\(!polling\)return;/);
 assert.match(native,/getForegroundPermissionsAsync/);
 assert.match(native,/mayShowUserSettingsDialog:false/);
});
