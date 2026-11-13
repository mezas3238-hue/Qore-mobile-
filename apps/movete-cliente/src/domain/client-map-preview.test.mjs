import test from 'node:test';
import assert from 'node:assert/strict';
import {createPassengerMapPreviewLinks} from './client-map-preview.mjs';
test('Existing origin and verified destination open personal Google Maps without key',()=>{
 const point={label:'Dirección privada',latitude:-25.350532,longitude:-54.631234};
 const android=createPassengerMapPreviewLinks(point,'android');
 const ios=createPassengerMapPreviewLinks(point,'ios');
 const expected='https://www.google.com/maps/search/?api=1&query=-25.350532%2C-54.631234';
 assert.equal(android.primary,expected);
 assert.equal(ios.primary,expected);
 assert.match(android.fallback,/^geo:/);
 assert.match(ios.fallback,/google.com\/maps/);
 for(const url of [android.primary,android.fallback,ios.primary,ios.fallback]){
  assert.equal(url.includes('Dirección'),false);
  assert.equal(url.includes('key='),false);
 }
});
test('Never open a malformed coordinate preview',()=>{
 for(const p of [null,{},[],{latitude:NaN,longitude:0},{latitude:91,longitude:0},
  {latitude:0,longitude:Infinity},{latitude:'-25.35',longitude:-54.63}])
  assert.equal(createPassengerMapPreviewLinks(p,'android'),null);
});
