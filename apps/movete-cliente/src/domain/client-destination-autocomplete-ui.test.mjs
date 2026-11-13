import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('G328 pickup uses native GPS from the field, not a Google Maps redirect',()=>{
 const s=readFileSync(new URL('../../app/transporte.tsx',import.meta.url),'utf8');
 const a=s.indexOf('¿Dónde te buscamos?</Text>');
 const b=s.indexOf('Elegir otro punto de recogida',a);
 const field=s.slice(a,b);
 assert.match(field,/Detectar mi ubicación automáticamente con GPS/);
 assert.match(field,/refreshPickup\(true\)/);
 assert.doesNotMatch(field,/openPersonalGoogleMaps|Linking\.openURL/);
 assert.match(s,/lastPickupFixAt\.current=Date\.now\(\)/);
 assert.match(s,/Punto GPS:/);
});
test('G328 destination offers results after debounced typing without pressing search',()=>{
 const s=readFileSync(new URL('../../app/transporte.tsx',import.meta.url),'utf8');
 const a=s.indexOf('¿A dónde vas?</Text>');
 const b=s.indexOf('Intercambiar origen y destino',a);
 const area=s.slice(a,b);
 assert.match(area,/<TextInput[^]*?onFocus=\{\(\)=>setDestinationFocused\(true\)\}/);
 assert.match(s,/setTimeout\(\(\)=>void findPlace\('destination'\),plan\.delayMs\)/);
 assert.match(s,/const plan=autocompleteGate\.plan\(destination\)/);
 assert.match(area,/\{suggestions\.map\(/);
 assert.equal(area.indexOf('{suggestions.map(')<area.indexOf('Buscar de nuevo (opcional)'),true);
 assert.match(s,/locationBudget\.beginDestination\(query\)/);
 assert.doesNotMatch(area.slice(0,area.indexOf('Buscar de nuevo (opcional)')),
  /onPress=\{\(\)=>\{void openPersonalGoogleMaps\('destination'\)/);
});
test('G328 keeps hardware stability, no per-key geocoding or LIVE booking',()=>{
 const s=readFileSync(new URL('../../app/transporte.tsx',import.meta.url),'utf8');
 assert.match(s,/useClientView\(\{polling:false\}\)/);
 assert.match(s,/locationBudget\.beginGps\(\{manual\}\)/);
 assert.match(s,/return \(\)=>clearTimeout\(handle\)/);
 const dest=s.slice(s.indexOf('¿A dónde vas?</Text>'),s.indexOf('Buscar de nuevo (opcional)'));
 const onchange=dest.slice(dest.indexOf('onChangeText={value=>'),dest.indexOf('}}/>')+4);
 assert.doesNotMatch(onchange,/searchPassengerDestination|findPlace|geocodeAsync/);
 assert.doesNotMatch(s,/reserveQuotedAuto|bookMoto|fetch\(/);
});
