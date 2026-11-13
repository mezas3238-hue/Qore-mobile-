import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {isParaguayMapCoordinate,parseMapPointMessage,sameMapCoordinate}
 from './client-map-point.mjs';
test('accepts a bounded PY map point without user-supplied labels or roles',()=>{
 const p=parseMapPointMessage(JSON.stringify({kind:'map-point',latitude:-25.39,longitude:-54.65}));
 assert.deepEqual(p,{latitude:-25.39,longitude:-54.65});
 assert.equal(Object.isFrozen(p),true);
});
test('rejects tampered payloads, fake country, extreme coordinates and injections',()=>{
 for(const payload of [
  '', '{', 'null','[]','{"kind":"map-point","latitude":-25}',
  '{"kind":"map-point","latitude":"-25","longitude":-55}',
  '{"kind":"map-point","latitude":0,"longitude":0}',
  '{"kind":"map-point","latitude":-25,"longitude":-55,"role":"owner"}',
  '{"kind":"map-point","latitude":-25,"longitude":-55,"origin":"fake"}',
  '{"kind":"map-point","latitude":-25,"longitude":-55,"extra":1}',
  '{"kind":"map-point","latitude":-28.5,"longitude":-55}',
  'x'.repeat(300)
 ])assert.equal(parseMapPointMessage(payload),null,payload);
 assert.equal(isParaguayMapCoordinate({latitude:NaN,longitude:-55}),false);
});
test('compares geocoder and GPS coordinates without triggering extra GPS reads',()=>{
 const a={latitude:-25.4,longitude:-54.6};
 assert.equal(sameMapCoordinate(a,{latitude:-25.40000005,longitude:-54.6}),true);
 assert.equal(sameMapCoordinate(a,{latitude:-25.40002,longitude:-54.6}),false);
 assert.equal(sameMapCoordinate(a,null),false);
});
