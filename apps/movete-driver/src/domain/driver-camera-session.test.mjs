import test from 'node:test';
import assert from 'node:assert/strict';
import {canCommitDriverCameraInspection} from './driver-camera-session.mjs';

const valid={requestEpoch:5,currentEpoch:5,appActive:true,permissionGranted:true};
test('G308 only an active current-session photo may be inspected/accepted',()=>{
 assert.equal(canCommitDriverCameraInspection(valid),true);
});
test('G308 prevent acceptance after background or unmount changed session',()=>{
 assert.equal(canCommitDriverCameraInspection({...valid,currentEpoch:6}),false);
 assert.equal(canCommitDriverCameraInspection({...valid,appActive:false}),false);
 assert.equal(canCommitDriverCameraInspection({...valid,permissionGranted:false}),false);
});
test('G308 fail closed on malformed, missing or fractional epochs',()=>{
 for(const args of [
  undefined,{},null,{...valid,requestEpoch:-1},
  {...valid,requestEpoch:5.5},{...valid,currentEpoch:NaN},
  {...valid,appActive:1},{...valid,permissionGranted:'true'},
  {...valid,currentEpoch:Number.MAX_SAFE_INTEGER+1}
 ]){
  assert.equal(canCommitDriverCameraInspection(args),false);
 }
});
