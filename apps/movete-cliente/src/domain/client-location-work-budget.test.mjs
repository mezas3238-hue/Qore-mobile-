import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientLocationWorkBudget} from './client-location-work-budget.mjs';
test('G319 never starts duplicate GPS when permission dialog toggles foreground',()=>{
 let clock=100000;const q=createClientLocationWorkBudget({now:()=>clock});
 assert.equal(q.beginGps().ok,true);
 assert.equal(q.beginGps().code,'LOCATION_BUSY');
 assert.equal(q.beginDestination('Palma Asuncion').code,'LOCATION_BUSY');
 assert.equal(q.end('gps'),true);
 assert.equal(q.beginGps().code,'GPS_AUTO_ALREADY_USED');
 assert.equal(q.beginGps({manual:true}).code,'GPS_COOLDOWN');
 clock+=30001;
 assert.equal(q.beginGps({manual:true}).ok,true);
 assert.equal(q.end('gps'),true);
 assert.equal(q.beginGps().code,'GPS_AUTO_ALREADY_USED');
});
test('G319 destination performs only one query at a time, with retry cooldown',()=>{
 let clock=100000;
 const q=createClientLocationWorkBudget({now:()=>clock});
 assert.equal(q.beginDestination('Av España').ok,true);
 assert.equal(q.beginDestination('Palma').code,'LOCATION_BUSY');
 assert.equal(q.end('gps'),false);
 assert.equal(q.end('destination'),true);
 assert.equal(q.beginDestination('Palma').code,'SEARCH_COOLDOWN');
 clock+=3001;
 assert.equal(q.beginDestination('Palma').ok,true);
 assert.equal(q.end('destination'),true);
});
test('G319 refuses invalid operations without throwing or storing private places',()=>{
 const q=createClientLocationWorkBudget({now:()=>200});
 for(const v of ['', 'abc', ' '.repeat(130), null, 32])
  assert.equal(q.beginDestination(v).ok,false);
 assert.equal(q.end('invalid'),false);
 assert.equal(q.busy(),false);
 assert.equal(JSON.stringify(q).includes('gpsLatitude'),false);
});
