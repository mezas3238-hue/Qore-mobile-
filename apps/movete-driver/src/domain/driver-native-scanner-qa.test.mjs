import test from 'node:test';
import assert from 'node:assert/strict';
import {isAcceptedNativeDriverScan} from './driver-native-scanner-qa.mjs';
test('G310 must use 1 real page and successful native postscan pixels',()=>{
 const good={source:'mlkit-document-scanner',pageCount:1,ready:true,reasons:[]};
 assert.equal(isAcceptedNativeDriverScan(good),true);
 for(const p of [null,{},[],{...good,source:'camera-preview'},
  {...good,pageCount:2},{...good,ready:false},
  {...good,reasons:['OUT_OF_FOCUS']},{...good,reasons:['LOW_CONTRAST']}])
  assert.equal(isAcceptedNativeDriverScan(p),false);
});
