import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrivateDriverDocumentDossier,DOCUMENT_KINDS}
 from './driver-document-dossier.mjs';
test('no verified session shows no cached private statuses',()=>{
 const d=buildPrivateDriverDocumentDossier({
  connected:false,documents:[{kind:'licencia',status:'approved'}]
 });
 assert.equal(d.session,'unverified');
 assert.equal(d.entries.length,8);
 assert.equal(d.entries[0].state,'unknown');
 assert.equal(d.driverEligible,false);
});
test('all eight documents mapped with missing/rejected/approved from server',()=>{
 const d=buildPrivateDriverDocumentDossier({
  connected:true,documents:[{kind:'licencia',status:'approved'},
   {kind:'identidad_frente',status:'rejected'}]
 });
 assert.equal(d.entries.find(x=>x.kind==='licencia').state,'approved');
 assert.equal(d.entries.find(x=>x.kind==='identidad_frente').state,'rejected');
 assert.equal(d.entries.find(x=>x.kind==='seguro').state,'missing');
 assert.equal(d.entries.length,DOCUMENT_KINDS.length);
 assert.equal(JSON.stringify(d).includes('objectKey'),false);
});
test('invalid data rejects entire checklist without displaying incorrect approvals',()=>{
 const datasets=[
  [{kind:'licencia',status:'approved'},{kind:'licencia',status:'approved'}],
  [{kind:'evil',status:'approved'}],
  [{kind:'licencia',status:'autoapproved'}],
  new Array(9).fill({kind:'licencia',status:'approved'})
 ];
 for(const documents of datasets)assert.equal(
  buildPrivateDriverDocumentDossier({connected:true,documents}).session,'invalid'
 );
});
test('even server-reported 8/8 approved does not activate KYC or commercial eligibility',()=>{
 const d=buildPrivateDriverDocumentDossier({
  connected:true,documents:DOCUMENT_KINDS.map(kind=>({kind,status:'approved'}))
 });
 assert.equal(d.entries.every(x=>x.state==='approved'),true);
 for(const key of ['driverEligible','vehicleApproved','mayDispatch',
  'identityVerified','readyForCommercialUse'])assert.equal(d[key],false);
});
