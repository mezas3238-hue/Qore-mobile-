import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMerchantStagingApiOrigin as verify}
 from './merchant-staging-origin.mjs';

const render='https://qore-staging.onrender.com';
const railway='https://qore-mobile-staging.up.railway.app';
test('G230 Comercio keeps the original Render exact HTTPS pin',()=>{
 assert.equal(verify({origin:render,pinnedOrigin:render}),render);
});
test('G230 Comercio connects to precisely the same Railway HTTPS G4 origin as the other applications',()=>{
 assert.equal(verify({origin:railway,pinnedOrigin:railway}),railway);
 assert.equal(verify({origin:railway,pinnedOrigin:render}),null);
 assert.equal(verify({origin:render,pinnedOrigin:railway}),null);
});
test('G230 no unapproved host, userinfo, redirects, HTTP, path, port, or query can connect Merchant',()=>{
 for(const origin of [
  undefined,'http://qore-mobile-staging.up.railway.app',
  'https://localhost','https://192.168.0.1',
  'https://example.org','https://evil.up.railway.app.attacker.com',
  'https://sub.qore-mobile-staging.up.railway.app',
  'https://foo.railway.app',
  'https://user:password@qore-mobile-staging.up.railway.app',
  'https://qore-mobile-staging.up.railway.app:8443',
  'https://qore-mobile-staging.up.railway.app/api',
  'https://qore-mobile-staging.up.railway.app?a=1',
  'https://qore-mobile-staging.up.railway.app#secret',
  'https://qore-mobile-staging.up.railway.app/',
  'https://qore-mobile-staging.up.railway.app\\@attacker.com'
 ]){
  assert.equal(verify({origin,pinnedOrigin:origin}),null,String(origin));
 }
});
test('G230 never infers the Merchant origin from a supplied hostname or only one environment value',()=>{
 assert.equal(verify({origin:railway}),null);
 assert.equal(verify({pinnedOrigin:railway}),null);
 assert.equal(verify({origin:railway,pinnedOrigin:railway.toUpperCase()}),null);
 assert.equal(verify(),null);
});
