import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminReadQaOptions} from './admin-read-qa-options.mjs';
const fetchImpl=async()=>{throw Error('offline test must not send HTTP');};
const valid=()=>({
 origin:'https://qore-mobile-staging.onrender.com',
 pinnedOrigin:'https://qore-mobile-staging.onrender.com',
 ownerApproved:true,externalHttpsVerified:true,contractVerified:true,
 postgresVerified:true,serverMfaVerified:true,serverRbacVerified:true,
 serverRevocationVerified:true,verifiedOperations:'kyc,zones',fetchImpl
});
test('D Admin reads remain disconnected until explicit certification',()=>{
 assert.equal(createAdminReadQaOptions(),null);
 assert.equal(createAdminReadQaOptions({origin:valid().origin}),null);
});
test('D every external assurance is required',()=>{
 for(const key of ['ownerApproved','externalHttpsVerified','contractVerified',
  'postgresVerified','serverMfaVerified','serverRbacVerified',
  'serverRevocationVerified'])
  assert.equal(createAdminReadQaOptions({...valid(),[key]:false}),null,key);
});
test('D allowlist is exact and finance never implicitly included',()=>{
 const result=createAdminReadQaOptions(valid());
 assert.equal(result.enabled,true);
 assert.deepEqual(result.certifiedContracts,['kyc','zones']);
 assert.equal(result.certifiedContracts.includes('finance'),false);
 assert.equal(result.fetchImpl,fetchImpl);
 assert(Object.isFrozen(result)&&Object.isFrozen(result.certifiedContracts));
 for(const raw of ['','all','kyc,root','kyc,kyc','kyc,,zones','kyc;zones'])
  assert.equal(createAdminReadQaOptions({...valid(),verifiedOperations:raw}),null,raw);
 assert.deepEqual(createAdminReadQaOptions({...valid(),
  verifiedOperations:'finance'}).certifiedContracts,['finance']);
});
test('D origin pin refuses credentials, mismatches, localhost, paths and query',()=>{
 for(const origin of ['http://qore-mobile-staging.onrender.com',
 'https://localhost','https://other.example.com',
 'https://qore-mobile-staging.onrender.com/path',
 'https://qore-mobile-staging.onrender.com/?token=x',
 'https://user:password@qore-mobile-staging.onrender.com',
 'https://qore-mobile-staging.onrender.com:8443'])
  assert.equal(createAdminReadQaOptions({...valid(),origin}),null,origin);
 assert.equal(createAdminReadQaOptions({...valid(),
  pinnedOrigin:'https://other-staging.onrender.com'}),null);
});
