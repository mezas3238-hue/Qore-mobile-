import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPassengerRideIntent} from './passenger-ride-intent.mjs';
const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('Una sola ruta privada precarga AUTO o MOTO, nunca el servicio opuesto',()=>{
 let timestamp=1000;
 const intent=createPassengerRideIntent({now:()=>timestamp});
 assert.deepEqual(intent.save({ownerRevision:2,kind:'AUTO',
  origin:'  Centro de Asunción ',destination:' Villa Morra '}),{ok:true});
 assert.equal(intent.read(2,'AUTO').origin,'Centro de Asunción');
 assert.equal(intent.read(2,'AUTO').destination,'Villa Morra');
 assert.equal(intent.read(2,'MOTO'),null);
 assert.equal(intent.read(3,'AUTO'),null);
 assert.equal(intent.read(2,'AUTO'),null);
 assert.deepEqual(intent.save({ownerRevision:3,kind:'MOTO',
  origin:'Centro',destination:'Aeropuerto'}),{ok:true});
 assert.equal(intent.read(3,'MOTO').kind,'MOTO');
 timestamp+=600001;
 assert.equal(intent.read(3,'MOTO'),null);
});
test('Rechaza rutas idénticas, control bidi, sesiones inválidas y no acepta tarifas',()=>{
 const intent=createPassengerRideIntent();
 for(const input of [
  {ownerRevision:-1,kind:'AUTO',origin:'Centro',destination:'Villa Morra'},
  {ownerRevision:1,kind:'AUTO_DELIVERY',origin:'Centro',destination:'Villa Morra'},
  {ownerRevision:1,kind:'AUTO',origin:'Centro',destination:' centro '},
  {ownerRevision:1,kind:'MOTO',origin:'Abc\u202E',destination:'Terminal'},
  {ownerRevision:1,kind:'AUTO',origin:'Centro',destination:'x'},
 ])assert.equal(intent.save(input).ok,false);
 assert.equal(intent.read(1,'AUTO'),null);
 assert.equal(intent.save({ownerRevision:1,kind:'AUTO',
  origin:'Centro',destination:'Terminal'}).ok,true);
 assert.equal(Object.hasOwn(intent.read(1,'AUTO'),'priceGs'),false);
 intent.clear();
 assert.equal(intent.read(1,'AUTO'),null);
});
test('El selector precarga ambos formularios sin exponer ubicaciones en la URL',()=>{
 const ui=src('../../app/transporte.tsx');
 const auto=src('../../app/viaje.tsx');
 const moto=src('../../app/moto.tsx');
 const root=src('../ClientRuntime.tsx');
 assert.match(ui,/intent.save\(/);
 assert.match(ui,/routeReview.ok/);
 assert.match(ui,/router.push\('\/viaje'\)/);
 assert.match(ui,/router.push\('\/moto'\)/);
 assert.match(auto,/rideIntent.read\(view.privateViewRevision,'AUTO'\)/);
 assert.match(moto,/rideIntent.read\(revision,'MOTO'\)/);
 assert.match(root,/PassengerRideIntentContext.Provider/);
 assert.match(root,/passengerRideIntent.clear\(\)/);
 assert.doesNotMatch(ui,/router.push\(\{pathname|params:|requestMotoQuote|reserveQuotedAuto/);
});
