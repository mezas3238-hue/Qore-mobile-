import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareLocalRideRequest,prepareLocalDeliveryRequest} from './client-request-preparation.mjs';
import {validateClientOperation} from './client-gateway.mjs';
const key='123e4567-e89b-42d3-a456-426614174000';
const ride={pickup:'  Centro Asunción  ',destination:'Villa Morra',service:'economico'};
const delivery={pickup:' Centro Asunción ',destination:' Villa Morra ',vehicleKind:'MOTO',
 category:'PARCEL',weight:'3500',length:'30',width:'15',height:'12',restricted:false};
test('AUTO: construye body exacto del contrato A G11 sin atribuir despacho',()=>{
 const r=prepareLocalRideRequest(ride,()=>key);
 assert.equal(r.ok,true);
 assert.deepEqual(r.body,{requestKey:key,originTag:'Centro Asunción',
  destinationTag:'Villa Morra',service:'economico'});
 assert.equal(validateClientOperation('rideRequest',r.body),true);
 assert.equal(r.sent,false);assert.equal(r.serverPriced,false);
 assert.equal(r.driverAssigned,false);assert.equal(Object.isFrozen(r.body),true);
});
test('AUTO: opción inválida, misma ruta y moto pasajero nunca generan clave',()=>{
 let calls=0;const random=()=>{calls++;return key;};
 assert.equal(prepareLocalRideRequest({...ride,service:'premium'},random).ok,false);
 assert.equal(prepareLocalRideRequest({...ride,destination:'centro asunción'},random).ok,false);
 assert.equal(calls,0);
});
test('AUTO: ningún fallback Math.random para UUID inválido o crypto ausente',()=>{
 assert.equal(prepareLocalRideRequest(ride,undefined).ok,false);
 assert.equal(prepareLocalRideRequest(ride,()=>key.replace('-42d3','-12d3')).ok,false);
});
test('MOTO carga: traduce exactamente 10 campos del backend sin GPS/precio',()=>{
 const r=prepareLocalDeliveryRequest(delivery,()=>key);
 assert.equal(r.ok,true);
 assert.deepEqual(r.body,{requestKey:key,vehicleKind:'MOTO',
  category:'PARCEL',grams:3500,lengthCm:30,widthCm:15,heightCm:12,
  pickupTag:'Centro Asunción',deliveryTag:'Villa Morra',
  restrictedItemDeclared:false});
 assert.equal(validateClientOperation('deliveryRequest',r.body),true);
 assert.equal(r.sent,false);assert.equal(r.courierAssigned,false);
 assert.equal(Object.hasOwn(r.body,'fare'),false);
});
test('envíos de comercios: cinco categorías en AUTO/MOTO carga bajo reglas',()=>{
 for(const category of ['DOCUMENTS','PARCEL','GROCERIES','RESTAURANT','PHARMACY_OTC']){
  for(const vehicleKind of ['MOTO','AUTO']){
   const r=prepareLocalDeliveryRequest({...delivery,category,vehicleKind},()=>key);
   assert.equal(r.ok,true,category+'/'+vehicleKind);
  }
 }
});
test('MOTO envío de más de 10 kg prohibido, AUTO permite hasta 100 kg',()=>{
 assert.equal(prepareLocalDeliveryRequest({...delivery,weight:'10001'},()=>key).ok,false);
 assert.equal(prepareLocalDeliveryRequest({...delivery,weight:'100000',vehicleKind:'AUTO'},()=>key).ok,true);
 assert.equal(prepareLocalDeliveryRequest({...delivery,weight:'100001',vehicleKind:'AUTO'},()=>key).ok,false);
});
test('prohíbe productos restringidos, fármacos con receta y categorías falsas',()=>{
 assert.equal(prepareLocalDeliveryRequest({...delivery,restricted:true},()=>key).ok,false);
 assert.equal(prepareLocalDeliveryRequest({...delivery,category:'PRESCRIPTION'},()=>key).ok,false);
 assert.equal(prepareLocalDeliveryRequest({...delivery,category:'MOTO_PASSENGER'},()=>key).ok,false);
});
test('no acepta exponentes, decimales, vacío ni negativos como medidas',()=>{
 for(const bad of ['', ' ', '1e3','12.3','-1','0','0010000','NaN','Infinity']){
  for(const field of ['weight','length','width','height']){
   assert.equal(prepareLocalDeliveryRequest({...delivery,[field]:bad},()=>key).ok,false,field+':'+bad);
  }
 }
});
test('no se genera requestKey cuando la validación no es correcta',()=>{
 let calls=0;
 const broken={...delivery,length:'201'};
 assert.equal(prepareLocalDeliveryRequest(broken,()=>{calls++;return key;}).ok,false);
 assert.equal(calls,0);
});
test('mismo origen destino no permite pedido; validación no filtra datos privados',()=>{
 assert.equal(prepareLocalDeliveryRequest({...delivery,destination:'Centro Asunción'},()=>key).ok,false);
 const r=prepareLocalDeliveryRequest(delivery,()=>key);
 assert.deepEqual(Object.keys(r.review).sort(),
  ['pickup','destination','vehicleKind','category','grams','lengthCm','widthCm','heightCm'].sort());
 assert.equal(Object.hasOwn(r.body,'passengerId'),false);
 assert.equal(Object.hasOwn(r.body,'price'),false);
});
