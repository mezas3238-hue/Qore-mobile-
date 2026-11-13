import test from 'node:test';
import assert from 'node:assert/strict';
import {readGoogleMapsShare,stageGoogleMapsShare,consumeGoogleMapsShare,clearGoogleMapsShare} from './client-google-maps-share.mjs';
test('Google Maps share with place name proposes search, never auto-confirms',()=>{
 const r=readGoogleMapsShare([{shareType:'text',value:'Parque Guasu Metropolitano\nhttps://maps.app.goo.gl/abc123'}]);
 assert.deepEqual(r,{ok:true,query:'Parque Guasu Metropolitano',requiresVerification:true});
 assert.equal(Object.hasOwn(r,'latitude'),false);
});
test('Supported Google Maps URL query becomes address proposal',()=>{
 const r=readGoogleMapsShare([{shareType:'url',value:'https://www.google.com/maps/search/?api=1&query=Hernandarias%2C+Alto+Paran%C3%A1'}]);
 assert.equal(r.ok,true);assert.equal(r.query,'Hernandarias, Alto Paraná');
});
test('Short link alone cannot imply unknown destination; reject untrusted URLs',()=>{
 assert.equal(readGoogleMapsShare([{shareType:'url',value:'https://maps.app.goo.gl/x'}]).code,'PLACE_NAME_REQUIRED');
 assert.equal(readGoogleMapsShare([{shareType:'url',value:'https://evil.example/?query=Asuncion'}]).code,'NOT_GOOGLE_MAPS');
 assert.equal(readGoogleMapsShare([{shareType:'text',value:'Centro\nhttps://google.evil.com/maps/search/?query=Centro'}]).code,'NOT_GOOGLE_MAPS');
 assert.equal(readGoogleMapsShare([{shareType:'url',value:'http://www.google.com/maps/search/?query=Asuncion'}]).code,'NOT_GOOGLE_MAPS');
 assert.equal(readGoogleMapsShare([{shareType:'file',value:'https://maps.app.goo.gl/xyz'}]).code,'UNSUPPORTED_PAYLOAD');
 assert.equal(readGoogleMapsShare([{shareType:'text',value:'GPS\nhttps://maps.app.goo.gl/x'},{}]).code,'SINGLE_SHARE_REQUIRED');
});
test('Coordinates are not blindly accepted as a verified destination',()=>{
 assert.equal(readGoogleMapsShare([{shareType:'url',value:'https://www.google.com/maps/search/?api=1&query=-25.1234%2C-54.1234'}]).code,'PLACE_NAME_REQUIRED');
});
test('User-approved query in RAM is single use and expires',()=>{
 clearGoogleMapsShare();
 assert.equal(stageGoogleMapsShare('Ciudad del Este',1000),true);
 assert.deepEqual(consumeGoogleMapsShare(1010),{query:'Ciudad del Este',requiresVerification:true});
 assert.equal(consumeGoogleMapsShare(1010),null);
 assert.equal(stageGoogleMapsShare('Asunción',1000),true);
 assert.equal(consumeGoogleMapsShare(121001),null);
 assert.equal(stageGoogleMapsShare('https://bad.test',5000),false);
});

test('G330 canonical Google Maps named place URL yields a query for independent verification',()=>{
 const value='https://www.google.com/maps/place/Parque+Guas%C3%BA+Metropolitano/@-25.2542,-57.5435,16z';
 assert.deepEqual(readGoogleMapsShare([{shareType:'url',value}]),{
  ok:true,query:'Parque Guasú Metropolitano',requiresVerification:true
 });
});
test('G330 short Google Maps share may use only a verified resolved Google Maps place URL',()=>{
 const raw=[{shareType:'url',value:'https://maps.app.goo.gl/AbCdE123'}];
 assert.equal(readGoogleMapsShare(raw).code,'PLACE_NAME_REQUIRED');
 assert.deepEqual(readGoogleMapsShare(raw,[{
  contentType:'website',
  contentUri:'https://www.google.com/maps/place/Shopping+Paris/@-25.515,-54.612,17z'
 }]),{ok:true,query:'Shopping Paris',requiresVerification:true});
 assert.deepEqual(readGoogleMapsShare(raw,[{
  contentType:'website',
  contentUri:'https://www.google.com/maps/search/?api=1&query=Hernandarias%2C+Alto+Paran%C3%A1'
 }]),{ok:true,query:'Hernandarias, Alto Paraná',requiresVerification:true});
});
test('G330 cannot smuggle remote destinations, short coordinates, or attacker redirects',()=>{
 const short=[{shareType:'url',value:'https://maps.app.goo.gl/AbCdE123'}];
 const malicious=[
  'https://google.evil.example/maps/place/Ciudad+del+Este',
  'https://evil.example/?query=Asuncion',
  'http://www.google.com/maps/place/Asuncion',
  'https://www.google.com.evil.org/maps/place/Asuncion',
  'file:///secret/maps/place/Asuncion',
  'https://www.google.com/maps/search/?api=1&query=-25.345%2C-54.62',
  'https://www.google.com/maps/@-25.345,-54.62,16z'
 ];
 for(const contentUri of malicious){
  assert.equal(readGoogleMapsShare(short,[{contentUri}]).code,'PLACE_NAME_REQUIRED');
 }
 assert.equal(readGoogleMapsShare([{shareType:'url',value:'https://evil.example'}],
  [{contentUri:'https://www.google.com/maps/place/Hernandarias'}]).code,'NOT_GOOGLE_MAPS');
 assert.equal(readGoogleMapsShare(short,[{contentUri:'https://www.google.com/maps/place/P1'},
  {contentUri:'https://www.google.com/maps/place/P2'}]).code,'PLACE_NAME_REQUIRED');
});
test('G330 prefers original shared place name over resolved redirect for user confirmation',()=>{
 const value='Plaza de Armas, Encarnación\nhttps://maps.app.goo.gl/abc123';
 const out=readGoogleMapsShare([{shareType:'text',value}],
  [{contentUri:'https://www.google.com/maps/place/Otro+lugar'}]);
 assert.deepEqual(out,{ok:true,query:'Plaza de Armas, Encarnación',requiresVerification:true});
});
