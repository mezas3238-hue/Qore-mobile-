import test from 'node:test';
import assert from 'node:assert/strict';
import {createPassengerMapPreviewLinks} from './client-map-preview.mjs';
test('native Android/Apple Maps links use coordinates only',()=>{
 const point={label:'Domicilio privado',latitude:-25.350532,longitude:-54.631234};
 const android=createPassengerMapPreviewLinks(point,'android');
 const ios=createPassengerMapPreviewLinks(point,'ios');
 assert.match(android.primary,/^geo:-25\.350532,-54\.631234\?q=/);
 assert.match(ios.primary,/^https:\/\/maps\.apple\.com\/\?ll=/);
 assert.match(android.fallback,/google\.com\/maps\/search/);
 for(const url of [android.primary,android.fallback,ios.primary,ios.fallback])
  assert.equal(url.includes('Domicilio'),false);
});
test('invalid location is never passed to external maps',()=>{
 for(const point of [null,{},[],{latitude:NaN,longitude:0},
  {latitude:91,longitude:0},{latitude:0,longitude:Infinity},
  {latitude:'-25.35',longitude:-54.63}])
  assert.equal(createPassengerMapPreviewLinks(point,'android'),null);
});
