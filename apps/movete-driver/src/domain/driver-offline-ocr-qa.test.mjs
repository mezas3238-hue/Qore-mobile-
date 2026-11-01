import assert from 'node:assert/strict';
import test from 'node:test';
import {canRunOfflineDriverOcrQa} from './driver-offline-ocr-qa.mjs';
const qa={
 EXPO_PUBLIC_QORE_G299_OFFLINE_OCR_QA_APPROVED:'true',
 EXPO_PUBLIC_LIVE_OPERATIONS_ENABLED:'false',
 EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED:'false',
 EXPO_PUBLIC_QORE_G290_CAMERA_LAB_APPROVED:'false',
 EXPO_PUBLIC_QORE_G291_OCR_LAB_APPROVED:'false'
};
test('offline QA requires explicit independent consent and no network endpoints',()=>{
 assert.equal(canRunOfflineDriverOcrQa(qa),true);
 for(const [key,value] of Object.entries({
  EXPO_PUBLIC_LIVE_OPERATIONS_ENABLED:'true',
  EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED:'true',
  EXPO_PUBLIC_QORE_G290_CAMERA_LAB_APPROVED:'true',
  EXPO_PUBLIC_QORE_G291_OCR_LAB_APPROVED:'true',
  EXPO_PUBLIC_SUPABASE_URL:'https://db.invalid',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'pk-not-allowed',
  EXPO_PUBLIC_QORE_STAGING_API_ORIGIN:'https://api.invalid',
  EXPO_PUBLIC_QORE_STAGING_API_HOST:'api.invalid',
  EXPO_PUBLIC_QORE_G299_OFFLINE_OCR_QA_APPROVED:'false'
 }))assert.equal(canRunOfflineDriverOcrQa({...qa,[key]:value}),false,key);
});
test('offline QA refuses ambiguous/default configurations',()=>{
 for(const x of [null,undefined,[],{}, {EXPO_PUBLIC_QORE_G299_OFFLINE_OCR_QA_APPROVED:'true'},
  {...qa,EXPO_PUBLIC_LIVE_OPERATIONS_ENABLED:undefined},
  {...qa,EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED:undefined}])
  assert.equal(canRunOfflineDriverOcrQa(x),false);
});
