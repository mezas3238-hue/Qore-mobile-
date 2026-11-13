import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleMapsLaunchUrl} from './client-google-maps-links.mjs';
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
