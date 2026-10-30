import test from 'node:test';
import assert from 'node:assert/strict';
import {createF1AuthorizedQaHttpOptions} from './f1-authorized-qa-http-options.mjs';

const origin='https://movete-facil-staging.onrender.com';
const fetchImpl=async()=>{throw Error('No service called in wiring constructor');};
const approved=Object.freeze({origin,pinnedOrigin:origin,
 ownerApproved:true,backendContractVerified:true,
 persistedRuntimeVerified:true,routeProviderVerified:true,
 subsidyContractVerified:true,fetchImpl});

test('G73 Cliente real HTTP remains OFF by default and under partial attestations',()=>{
 assert.equal(createF1AuthorizedQaHttpOptions(),null);
 for(const key of ['ownerApproved','backendContractVerified',
  'persistedRuntimeVerified','routeProviderVerified',
  'subsidyContractVerified']){
  assert.equal(createF1AuthorizedQaHttpOptions({...approved,[key]:false}),null,
   'Missing independent authority '+key);
 }
 assert.equal(createF1AuthorizedQaHttpOptions({...approved,fetchImpl:null}),null);
});

test('G73 Cliente operator-approved QA uses the same exact pinned Render HTTPS endpoint for all operations',()=>{
 const opt=createF1AuthorizedQaHttpOptions(approved);
 assert(opt);
 assert.deepEqual(Object.keys(opt).sort(),[
  'enabled','contractCertified','stagingRuntimeVerified',
  'routeProviderCertified','subsidyContractCertified',
  'financialContractCertified','cancellationContractCertified',
  'origin','pinnedOrigin','fetchImpl'
 ].sort());
 assert.equal(opt.origin,origin);
 assert.equal(opt.pinnedOrigin,origin);
 assert.equal(opt.fetchImpl,fetchImpl);
 assert.equal(opt.enabled,true);
 assert.equal(Object.isFrozen(opt),true);
 assert(!Object.hasOwn(opt,'liveEnabled'));
 assert(!Object.hasOwn(opt,'commercialEnabled'));
});

test('G73 Cliente never trusts arbitrary domain, different pin, HTTP, query, credentials or port',()=>{
 for(const url of [
  'http://movete-facil-staging.onrender.com',
  'https://evil.example',
  'https://evil.onrender.com/',
  'https://user:pass@movete-facil-staging.onrender.com',
  'https://movete-facil-staging.onrender.com:444',
  'https://movete-facil-staging.onrender.com/path',
  'https://movete-facil-staging.onrender.com?qa=1',
  'https://movete-facil-staging.onrender.com#f1'
 ]){
  const o=createF1AuthorizedQaHttpOptions({
   ...approved,origin:url,pinnedOrigin:url
  });
  assert.equal(o,null,url);
 }
 assert.equal(createF1AuthorizedQaHttpOptions({
  ...approved,pinnedOrigin:'https://another-staging.onrender.com'
 }),null);
});

test('G229 Cliente permits only independently pinned Railway STAGING HTTPS after all gates',()=>{
 const railway='https://qore-mobile-staging.up.railway.app';
 const valid=createF1AuthorizedQaHttpOptions({...approved,
  origin:railway,pinnedOrigin:railway});
 assert(valid);assert.equal(valid.origin,railway);
 assert.equal(createF1AuthorizedQaHttpOptions({...approved,
  origin:railway,pinnedOrigin:origin}),null);
 assert.equal(createF1AuthorizedQaHttpOptions({...approved,
  origin:'https://evil.up.railway.app.evil.org',
  pinnedOrigin:'https://evil.up.railway.app.evil.org'}),null);
});
