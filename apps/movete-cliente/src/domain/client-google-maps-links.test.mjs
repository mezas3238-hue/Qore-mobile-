import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleMapsLaunchUrl,createGoogleMapsDirectionsUrl} from './client-google-maps-links.mjs';
test('Personal Google Maps opens valid GPS point without API key or personal labels',()=>{
 const p={latitude:-25.350532,longitude:-54.631234,label:'Casa particular'};
 const url=createGoogleMapsLaunchUrl('pickup',p);
 assert.equal(url,'https://www.google.com/maps/search/?api=1&query=-25.350532%2C-54.631234');
 assert.doesNotMatch(url,/Casa|AIza|key=/);
});
test('Destination opens Google Maps near pickup, to search within Maps app',()=>{
 assert.equal(createGoogleMapsLaunchUrl('destination',{latitude:-25.35,longitude:-54.63}),
  'https://www.google.com/maps/@?api=1&map_action=map&center=-25.350000%2C-54.630000&zoom=16');
 assert.equal(createGoogleMapsLaunchUrl('destination'),
  'https://www.google.com/maps/@?api=1&map_action=map');
});
test('No invalid GPS or unsupported action leaks into Google Maps URL',()=>{
 assert.equal(createGoogleMapsLaunchUrl('pickup',{latitude:NaN,longitude:0}),
  'https://www.google.com/maps/@?api=1&map_action=map');
 assert.equal(createGoogleMapsLaunchUrl('pickup',{latitude:91,longitude:0}),
  'https://www.google.com/maps/@?api=1&map_action=map');
 assert.equal(createGoogleMapsLaunchUrl('other'),null);
});

test('G328 opens a user-confirmed Google Maps road directions link, no API key',()=>{
 const pickup={label:'Private pickup',latitude:-25.350532,longitude:-54.631234};
 const destination={label:'Private destination',latitude:-25.409211,longitude:-54.611997};
 const url=createGoogleMapsDirectionsUrl(pickup,destination);
 assert.equal(url,
  'https://www.google.com/maps/dir/?api=1&origin=-25.350532%2C-54.631234&destination=-25.409211%2C-54.611997&travelmode=driving');
 assert.doesNotMatch(url,/Private|AIza|api_key|key=|userId|session/i);
});
test('G328 refuses incomplete, simulated and identical coordinates for route opening',()=>{
 const gps={latitude:-25.35,longitude:-54.63};
 for(const bad of [null,{},[],{latitude:NaN,longitude:-54},
  {latitude:91,longitude:0},{latitude:0,longitude:Infinity}]){
  assert.equal(createGoogleMapsDirectionsUrl(gps,bad),null);
  assert.equal(createGoogleMapsDirectionsUrl(bad,gps),null);
 }
 assert.equal(createGoogleMapsDirectionsUrl(gps,{...gps}),null);
});
