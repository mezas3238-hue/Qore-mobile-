import test from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_TRIPS_ENABLED, requestProductionRide } from '../services/production-api.ts';
test('viajes reales permanecen apagados',()=>assert.equal(LIVE_TRIPS_ENABLED,false));
test('API productiva rechaza cualquier solicitud sin side effects',async()=>{
 await assert.rejects(requestProductionRide(),/todavía no están habilitados/);
});
