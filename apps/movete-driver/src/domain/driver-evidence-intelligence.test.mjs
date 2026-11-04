import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDriverPlate,compareDriverPlateEvidence,
 assessDriverCaptureFrame,nextDriverAutoCaptureGate}
 from './driver-evidence-intelligence.mjs';
const read=(text,confidence=0.99)=>({text,confidence});
const compare=(registration,vehicle,permit)=>compareDriverPlateEvidence({
 registration:read(registration),vehicle:read(vehicle),
 ...(permit===undefined?{}:{permit:read(permit)})
});
test('Plate formatting preserves digits and does not guess OCR lookalikes',()=>{
 assert.equal(normalizeDriverPlate(' ABCD-123 '),'ABCD123');
 assert.equal(normalizeDriverPlate('ABCD 123'),'ABCD123');
 assert.equal(normalizeDriverPlate('ABC123'),'ABC123');
 for(const value of ['','O0','ABCD123<script>','ABCD/123','1234567','ABCDEFGHI',
  'ABCD١٢٣','ABCD_123',null])assert.equal(normalizeDriverPlate(value),null);
 assert.notEqual(normalizeDriverPlate('ABCO123'),normalizeDriverPlate('ABC0123'));
});
test('Two or three matching OCR results remain pending human review',()=>{
 const a=compare('ABCD123','ABCD-123','ABCD 123');
 assert.equal(a.state,'match_pending_review');
 assert.equal(a.reviewRequired,true);
 assert.equal(a.driverEligible,false);
 assert.equal(a.vehicleApproved,false);
 assert.equal(JSON.stringify(a).includes('ABCD123'),false);
});
test('Conflicting permit and vehicle plate never pass',()=>{
 assert.equal(compare('ABCD123','ABCD124').state,'mismatch');
 assert.equal(compare('ABCD123','ABCD123','ABCD124').state,'mismatch');
});
test('Uncertain OCR and missing evidence must fail closed',()=>{
 for(const x of [
  {registration:read('ABCD123')},
  {registration:read('ABCD123',0.85),vehicle:read('ABCD123')},
  {registration:read('ABCD123'),vehicle:read('ABCD123',NaN)},
  {registration:read('ABCD123'),vehicle:read('000000')},
  {registration:read('ABCD123'),vehicle:read('ABCD123'),ownerApproval:true},
  null
 ])assert.equal(compareDriverPlateEvidence(x).state,'uncertain');
});
function photo(kind='sharp'){
 const width=64,height=64,luma=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)
  luma[y*width+x]=kind==='sharp'?(70+((x*73+y*131+x*y*17)%120)):
   kind==='dark'?15:120;
 return {width,height,luma,motionRms:0.015,
  subjectBox:{x:0.1,y:0.1,width:0.8,height:0.8,confidence:0.99}};
}
test('Real pixel metrics plus sensor stability and detector box are required',()=>{
 assert.equal(assessDriverCaptureFrame(photo()).ready,true);
 const blurred=assessDriverCaptureFrame(photo('blurred'));
 assert.equal(blurred.ready,false);
 assert(blurred.reasons.includes('OUT_OF_FOCUS'));
 assert(assessDriverCaptureFrame(photo('dark')).reasons.includes('TOO_DARK'));
 assert(assessDriverCaptureFrame({...photo(),subjectBox:null}).reasons.includes('SUBJECT_NOT_VERIFIED_IN_FRAME'));
 assert(assessDriverCaptureFrame({...photo(),motionRms:0.5}).reasons.includes('CAMERA_MOVING'));
});
test('Three separate valid frames needed, any failure resets gate',()=>{
 const good={ready:true},bad={ready:false};
 let gate=nextDriverAutoCaptureGate({quality:good,elapsedMs:600});
 assert.deepEqual(gate,{takePhoto:false,nextCount:1});
 gate=nextDriverAutoCaptureGate({quality:good,elapsedMs:650,previousCount:gate.nextCount});
 assert.equal(gate.takePhoto,false);
 gate=nextDriverAutoCaptureGate({quality:good,elapsedMs:650,previousCount:gate.nextCount});
 assert.equal(gate.takePhoto,true);
 assert.equal(nextDriverAutoCaptureGate({quality:bad,elapsedMs:650,previousCount:2}).nextCount,0);
 assert.equal(nextDriverAutoCaptureGate({quality:good,elapsedMs:100,previousCount:2}).takePhoto,false);
});

test('G302 blurred interior is rejected even if document border remains sharp',()=>{
 const f=photo(),{luma,width,height}=f;
 // Preserve high-frequency image outside centre, but erase all glyph
 // detail in the subject interior to simulate missed autofocus.
 for(let y=Math.floor(height*.22);y<height*.78;y++)
  for(let x=Math.floor(width*.22);x<width*.78;x++)
   luma[y*width+x]=120;
 const result=assessDriverCaptureFrame(f);
 assert.equal(result.ready,false);
 assert(result.reasons.includes('OUT_OF_FOCUS'));
 assert(result.metrics.interiorSharpness<420);
 assert.equal(result.mayApprove,false);
});
test('G302 three frames with any blurred interior cannot trigger shutter',()=>{
 let prev=0;
 for(const frame of [photo(),photo('blurred'),photo(),photo()]){
  const gate=nextDriverAutoCaptureGate({
   previousCount:prev,quality:assessDriverCaptureFrame(frame),
   elapsedMs:1200,minimumGapMs:450
  });
  assert.equal(gate.takePhoto,false);
  prev=gate.nextCount;
 }
 assert.equal(prev,2);
});

test('G310 ML Kit scan may be checked by pixels without claiming motion or hardware AF lock',()=>{
 const frame=photo(),scan=assessDriverCaptureFrame({
  ...frame,motionRms:null,captureSource:'mlkit-document-scanner'
 });
 assert.equal(scan.ready,true);
 assert.equal(scan.motionMeasured,false);
 assert.equal(scan.hardwareFocusCertified,false);
 assert.equal(assessDriverCaptureFrame({...frame,motionRms:null}).ready,false);
 assert.equal(assessDriverCaptureFrame({
  ...frame,motionRms:null,captureSource:'unknown-scanner'
 }).ready,false);
});
