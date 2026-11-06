import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPassengerGpsFix,makePassengerAddressLabel,inspectDestinationCandidates,
 isCurrentPassengerLocationResult,scopePassengerDestinationQuery,
 makePassengerDestinationCandidate} from './client-geolocation.mjs';
test('G309 uses only precise, non-mocked foreground GPS coordinates',()=>{
 const fix={latitude:-25.283,longitude:-57.633,accuracyMeters:22,mocked:false};
 const a=inspectPassengerGpsFix(fix);
 assert.equal(a.ok,true);assert.equal(a.commercialVerified,false);
 for(const p of [{...fix,accuracyMeters:210},{...fix,accuracyMeters:null},
  {...fix,mocked:true},{...fix,latitude:NaN},{...fix,longitude:181}]){
  assert.equal(inspectPassengerGpsFix(p).ok,false);
 }
});
test('G309 labels are bounded, sanitize invalid and missing reverse geocoding',()=>{
 assert.equal(makePassengerAddressLabel({streetNumber:'123',street:'Av España',
  city:'Asunción'},'Ubicación GPS'), '123, Av España, Asunción');
 assert.equal(makePassengerAddressLabel(null,'GPS'),'GPS');
 assert.equal(makePassengerAddressLabel({street:'\nInsegura'},'Ubicación GPS'),
  'Ubicación GPS');
});
test('G309 rejects invalid destination candidates and duplicates',()=>{
 const point={label:'Calle Palma, Asunción',latitude:-25.28,longitude:-57.64};
 const candidates=inspectDestinationCandidates([point,point,
  {...point,latitude:100},{...point,label:''},
  {...point,longitude:-57.61,label:'Otra calle'}]);
 assert.equal(candidates.length,2);assert(Object.isFrozen(candidates));
});
test('G309 stale GPS/geocoding must not update after auth epoch or background change',()=>{
 const good={requestEpoch:2,currentEpoch:2,privateRevision:8,activeRevision:8,appActive:true};
 assert.equal(isCurrentPassengerLocationResult(good),true);
 assert.equal(isCurrentPassengerLocationResult({...good,currentEpoch:3}),false);
 assert.equal(isCurrentPassengerLocationResult({...good,activeRevision:9}),false);
 assert.equal(isCurrentPassengerLocationResult({...good,appActive:false}),false);
});


test('G312 narrows user place search to Paraguay but does not double-append',()=>{
 assert.equal(scopePassengerDestinationQuery('Calle Palma, Asunción'),'Calle Palma, Asunción, Paraguay');
 assert.equal(scopePassengerDestinationQuery('Av España, Paraguay'),'Av España, Paraguay');
 assert.equal(scopePassengerDestinationQuery('Calle Palma\n'),null);
 assert.equal(scopePassengerDestinationQuery(''),null);
 assert.equal(scopePassengerDestinationQuery('Evil\u202ePlace'),null);
});
test('G312 destination suggestions must be real readable Paraguay addresses',()=>{
 const point={latitude:-25.29,longitude:-57.6};
 const verified={isoCountryCode:'PY',country:'Paraguay',street:'Av España',
  city:'Asunción',name:'Farmacia Centro'};
 const good=makePassengerDestinationCandidate(point,verified);
 assert.equal(good.label,'Farmacia Centro, Av España, Asunción');
 assert.equal(good.latitude,point.latitude);
 assert.equal(makePassengerDestinationCandidate(point,{...verified,isoCountryCode:'AR',country:'Argentina'}),null);
 assert.equal(makePassengerDestinationCandidate(point,{isoCountryCode:'PY',country:'Paraguay',city:'Asunción'}),null);
 assert.equal(makePassengerDestinationCandidate(point,{...verified,street:'\nInsegura'}),null);
 assert.equal(makePassengerDestinationCandidate({...point,latitude:NaN},verified),null);
 assert.equal(makePassengerDestinationCandidate(point,null),null);
});
