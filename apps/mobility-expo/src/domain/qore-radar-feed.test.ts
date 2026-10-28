import test from 'node:test';
import assert from 'node:assert/strict';
import {initialRiderRadar,receiveRiderRadar,presentRiderRadar,type TrustedRiderEvent} from './qore-radar-feed.ts';
const trip='11111111-1111-4111-8111-111111111111';
const passenger='22222222-2222-4222-8222-222222222222';
const base:TrustedRiderEvent={
 source:'server',tripId:trip,passengerId:passenger,
 serverRevision:1,trackingSequence:0,status:'searching'
};
const profile={name:'QORE Prueba',vehicleKind:'AUTO' as const,model:'Toyota Vitz',
 color:'blanco',plate:'TEST999',rating:4.9};
const gps={
 lat:-25.290,lng:-57.580,roadMeters:2580,etaSeconds:420,
 locationUpdatedAtMs:5000,routeUpdatedAtMs:5000,
 trafficAware:true as const,fallbackUsed:false as const
};
test('no network or server events: rider sees no phantom driver, marker or countdown',()=>{
 const state=initialRiderRadar(trip,passenger);
 const view=presentRiderRadar(state,10000);
 assert.equal(view.status,'not_connected');
 assert.equal(view.driver,null);
 assert.equal(view.etaMinutes,null);
 assert.equal(view.driverPosition,null);
 assert.equal(view.isCommercialRideEnabled,false);
});
test('search -> offer -> accepted: details/road minutes appear ONLY after verified server acceptance',()=>{
 let state=initialRiderRadar(trip,passenger);
 state=receiveRiderRadar(state,base);
 assert.equal(presentRiderRadar(state,10000).driver,null);
 state=receiveRiderRadar(state,{...base,status:'offer_pending',serverRevision:2});
 assert.equal(presentRiderRadar(state,10000).driver,null);
 state=receiveRiderRadar(state,{...base,status:'accepted',serverRevision:3,
  acceptedDriver:profile,tracking:gps});
 const view=presentRiderRadar(state,10000);
 assert.equal(view.status,'accepted');
 assert.equal(view.title,'Conductor de camino');
 assert.equal(view.driver?.plate,'TEST999');
 assert.equal(view.etaMinutes,7);
 assert.equal(view.roadMeters,2580);
 assert.deepEqual(view.driverPosition,{lat:gps.lat,lng:gps.lng});
 assert.equal(view.freshness,'live_estimate');
 assert.equal(view.isCommercialRideEnabled,false);
});
test('stale GPS or route removes position/ETA despite last known accepted driver',()=>{
 let state=initialRiderRadar(trip,passenger);
 state=receiveRiderRadar(state,{...base,status:'accepted',serverRevision:2,
  acceptedDriver:profile,tracking:gps});
 for(const now of [26000,35001,90000]){
  const view=presentRiderRadar(state,now);
  assert.equal(view.freshness,'stale');
  assert.equal(view.etaMinutes,null);
  assert.equal(view.driverPosition,null);
  assert.ok(view.driver);
 }
});
test('duplicate/out-of-order web socket messages and other passenger trip are ignored',()=>{
 let state=receiveRiderRadar(initialRiderRadar(trip,passenger),{...base,status:'accepted',
  serverRevision:4,trackingSequence:3,acceptedDriver:profile,tracking:gps});
 for(const evt of [
  {...base,serverRevision:3,status:'searching' as const},
  {...base,serverRevision:4,trackingSequence:3},
  {...base,serverRevision:5,status:'searching' as const},
  {...base,serverRevision:5,tripId:'33333333-3333-4333-8333-333333333333'},
  {...base,serverRevision:5,passengerId:'33333333-3333-4333-8333-333333333333'},
  {...base,serverRevision:5,source:'phone' as 'server'},
 ]){
  assert.equal(receiveRiderRadar(state,evt),state);
 }
 const updated=receiveRiderRadar(state,{...base,serverRevision:4,trackingSequence:4,
  status:'accepted',acceptedDriver:profile,tracking:{...gps,etaSeconds:300}});
 assert.equal(presentRiderRadar(updated,10000).etaMinutes,5);
 assert.equal(updated.serverRevision,4);
 state=updated;
});
test('at pickup and trip finished forbid pre-pickup tracking and replay',()=>{
 let state=receiveRiderRadar(initialRiderRadar(trip,passenger),{...base,
  status:'accepted',serverRevision:2,acceptedDriver:profile,tracking:gps});
 state=receiveRiderRadar(state,{...base,status:'at_pickup',
  serverRevision:3,acceptedDriver:profile,tracking:gps});
 assert.equal(presentRiderRadar(state,10000).etaMinutes,null);
 assert.equal(presentRiderRadar(state,10000).driverPosition,null);
 state=receiveRiderRadar(state,{...base,status:'completed',serverRevision:4});
 assert.equal(presentRiderRadar(state,10000).driver,null);
 assert.equal(presentRiderRadar(state,10000).etaMinutes,null);
 assert.equal(receiveRiderRadar(state,{...base,status:'accepted',serverRevision:5,
  acceptedDriver:profile,tracking:gps}),state);
});
test('unverified or malformed driver description never becomes passenger card',()=>{
 const state=receiveRiderRadar(initialRiderRadar(trip,passenger),{...base,
  status:'accepted',serverRevision:2,acceptedDriver:{...profile,plate:'bad plate'},tracking:gps});
 assert.equal(presentRiderRadar(state,10000).driver,null);
});

test('G4 AUTO-only feed rejects MOTO until separate regulatory and insurance approval',()=>{
 const incoming={...base,serverRevision:4,status:'accepted' as const,
  acceptedDriver:{...profile,vehicleKind:'MOTO' as const},tracking:gps};
 const state=receiveRiderRadar(initialRiderRadar(trip,passenger),incoming);
 const view=presentRiderRadar(state,10000);
 assert.equal(view.driver,null);
 assert.equal(view.etaMinutes,null);
 assert.equal(view.driverPosition,null);
 assert.equal(view.isCommercialRideEnabled,false);
});
