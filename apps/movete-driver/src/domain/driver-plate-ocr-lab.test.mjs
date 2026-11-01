import test from 'node:test';
import assert from 'node:assert/strict';
import {extractDriverPlateCandidates,compareDriverUnverifiedOcrSamples,
 addDriverPlateOcrSample} from './driver-plate-ocr-lab.mjs';
const lines=(...texts)=>({blocks:[{lines:texts.map(text=>({text}))}]});
test('ML Kit parser accepts only complete plate-shaped OCR lines',()=>{
 assert.deepEqual(extractDriverPlateCandidates(lines('ABCD-123','  ABCD 123  ')),['ABCD123']);
 assert.deepEqual(extractDriverPlateCandidates(lines('CEDULA VERDE','Nombre Apellido','ABCD123')),['ABCD123']);
 assert.deepEqual(extractDriverPlateCandidates(lines('ABCD123','ABCD124')),['ABCD123','ABCD124']);
 for(const result of [undefined,{blocks:null}, {blocks:[{lines:[{text:42}]}]},
  {blocks:[{lines:[{text:'ABCD123'},{}]}]}]){
  assert.deepEqual(extractDriverPlateCandidates(result),[]);
 }
 assert.deepEqual(extractDriverPlateCandidates(lines('PLACA: ABCD123','888888')),[]);
});
test('Two independent same-source captures are required; discrepancies reset source',()=>{
 let samples={};
 let r=addDriverPlateOcrSample(samples,'registration',['ABCD123']);
 assert.equal(r.accepted,true);samples=r.samples;
 assert.equal(compareDriverUnverifiedOcrSamples(samples).status,'unverified');
 r=addDriverPlateOcrSample(samples,'registration',['ABCD124']);
 assert.equal(r.accepted,false);assert.equal(r.reason,'INCONSISTENT_RECAPTURE');
 samples=r.samples;assert.deepEqual(samples.registration,[]);
 r=addDriverPlateOcrSample(samples,'registration',['ABCD123','ABCD124']);
 assert.equal(r.accepted,false);
});
test('Even perfect equal OCR text cannot authorize real vehicles or trips',()=>{
 const samples={registration:['ABCD123','ABCD123'],vehicle:['ABCD123','ABCD123']};
 const r=compareDriverUnverifiedOcrSamples(samples);
 assert.equal(r.status,'text_equal_pending_review');
 for(const key of ['driverEligible','vehicleApproved','evidenceVerified',
  'confidenceVerified','mayDispatch'])assert.equal(r[key],false);
 assert.equal(JSON.stringify(r).includes('ABCD123'),false);
});
test('Conflicting vehicle or permit reads stay pending independent review',()=>{
 const base={registration:['ABCD123','ABCD123'],vehicle:['ABCD124','ABCD124']};
 assert.equal(compareDriverUnverifiedOcrSamples(base).status,'text_conflict_pending_review');
 assert.equal(compareDriverUnverifiedOcrSamples({...base,
  permit:['ABCD123','ABCD123']}).status,'text_conflict_pending_review');
 assert.equal(compareDriverUnverifiedOcrSamples({...base,
  permit:['ABCD123']}).status,'unverified');
});
test('No coercion, OCR confidence invention, or spoofing admin approvals',()=>{
 for(const invalid of [null,[],{registration:['ABCD123','ABCD123']},
  {registration:['ABCD123','ABCD123'],vehicle:['ABCD123','ABCD123'],approved:true},
  {registration:['ABCD123','ABCD123'],vehicle:['ABCD123','ABC0123']},
  {registration:['ABCD123','ABCD123'],vehicle:['ABCD123','ABCD123'],permit:[]}
 ])assert.equal(compareDriverUnverifiedOcrSamples(invalid).status,'unverified');
});
