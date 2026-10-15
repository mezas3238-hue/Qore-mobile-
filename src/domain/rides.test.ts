import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoRide, DEMO_FARES, initialRideState, PLACES, quoteDemo, rideReducer } from './rides.ts';

const ride = createDemoRide(PLACES[0], PLACES[1], 'economico');
test('cotización DEMO positiva y reproducible', () => {
  const a = quoteDemo(PLACES[0], PLACES[1], 'economico');
  const b = quoteDemo(PLACES[0], PLACES[1], 'confort');
  assert.equal(a.priceGs > 0, true);
  assert.equal(b.priceGs > a.priceGs, true);
  assert.equal(DEMO_FARES.economico.commissionPercent, 15);
  assert.throws(() => quoteDemo(PLACES[0], PLACES[0], 'xl'));
});
test('no permite viajes activos duplicados ni aceptación sin disponibilidad', () => {
  const pending = rideReducer(initialRideState, { type: 'request', ride });
  assert.equal(pending.rides.length, 1);
  assert.equal(rideReducer(pending, { type: 'request', ride: createDemoRide(PLACES[1], PLACES[2], 'xl') }), pending);
  const offline = rideReducer(pending, { type: 'availability', available: false });
  assert.equal(rideReducer(offline, { type: 'accept', id: ride.id }), offline);
});
test('transiciones ordenadas, cancelación permitida y valoración única', () => {
  let state = rideReducer(initialRideState, { type: 'request', ride });
  assert.equal(rideReducer(state, { type: 'complete', id: ride.id }), state);
  for (const action of ['accept', 'arrive', 'start', 'complete'] as const) state = rideReducer(state, { type: action, id: ride.id });
  assert.equal(state.rides[0].stage, 'completed');
  assert.equal(rideReducer(state, { type: 'cancel', id: ride.id }), state);
  state = rideReducer(state, { type: 'rate', id: ride.id, rating: 5 });
  assert.equal(state.rides[0].rating, 5);
  assert.equal(rideReducer(state, { type: 'rate', id: ride.id, rating: 1 }), state);
});
