import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseG285OwnerAutoFareInput} from './g285-owner-auto-fare-input.mjs';
import {createOwnerAutoFareGateway} from './owner-auto-fare-gateway.mjs';

const at=Date.parse('2026-11-01T02:00:00Z');
const subject='00000000-0000-4000-8000-000000000901';
const requestKey='00000000-0000-4000-8000-000000000903';
const zone='ASUNCION_QA';
const raw={basePyg:'8000',perKmPyg:'1500',perMinutePyg:'200',
 minimumPyg:'10000',commissionPercent:'17.50'};
const draft={requestKey,basePyg:8000,perKmPyg:1500,
 perMinutePyg:200,minimumPyg:10000,commissionBps:1750};
const receipt={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ruleKey:'G265_'+requestKey.replace(/-/g,''),zoneTag:zone,
 commissionBps:1750,commissionPercent:17.5,active:true,idempotent:false};
const owner={subject,token:'AAA.'+'B'.repeat(65)+'.CCCCC',
 role:'owner',mfaVerified:true,expiresAt:at+600000};
function gateway(changes={}){
 const calls=[];
 const cfg={enabled:true,contractCertified:true,
  origin:'https://qore-mobile-backend-staging-staging.up.railway.app',
  pinnedOrigin:'https://qore-mobile-backend-staging-staging.up.railway.app',
  now:()=>at,
  getSession:async()=>owner,
  fetchImpl:async(url,opts)=>{
   calls.push({url,opts});
   return new Response(JSON.stringify(receipt),
    {status:200,headers:{'content-type':'application/json'}});
  },...changes};
 return {g:createOwnerAutoFareGateway(cfg),calls};
}
test('G285 parses only explicitly entered Gs and exact percentage basis points',()=>{
 assert.deepEqual(parseG285OwnerAutoFareInput(raw),{
  basePyg:8000,perKmPyg:1500,perMinutePyg:200,minimumPyg:10000,
  commissionBps:1750});
 for(const bad of [
  {...raw,basePyg:'8,000'}, {...raw,basePyg:'8000.0'},
  {...raw,minimumPyg:''}, {...raw,perKmPyg:'-1'},
  {...raw,perMinutePyg:'20001'}, {...raw,commissionPercent:'17.555'},
  {...raw,commissionPercent:'30.01'}, {...raw,commissionPercent:' 15'},
  {...raw,commissionPercent:'1e1'}, {...raw,additionalPrice:'100'},
  {...raw,basePyg:8000}, null
 ])assert.equal(parseG285OwnerAutoFareInput(bad),null);
});
test('G285 is OFF by default and refuses unpinned, browser-untrusted URLs',async()=>{
 for(const change of [
  {enabled:false},{contractCertified:false},
  {origin:'http://qore-mobile-backend-staging-staging.up.railway.app'},
  {origin:'https://evil.invalid'},
  {origin:'https://user:pass@qore-mobile-backend-staging-staging.up.railway.app'},
  {origin:'https://qore-mobile-backend-staging-staging.up.railway.app/steal'},
  {origin:'https://qore-mobile-backend-staging-staging.up.railway.app/?run=true'},
 ]){
  const {g,calls}=gateway(change);
  assert.equal(g.isConfigured(),false);
  assert.equal((await g.publish(zone,draft)).ok,false);
  assert.equal(calls.length,0);
 }
});
test('G285 signs exactly one POST from AAL2 Owner memory session, no supplied actor IDs',async()=>{
 const {g,calls}=gateway();
 const result=await g.publish(zone,draft);
 assert.equal(result.ok,true);
 assert.equal(result.independentlyReadBack,false);
 assert.equal(result.externalJourneysCertified,0);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://qore-mobile-backend-staging-staging.up.railway.app/v1/staging/owner/auto-fares/'+zone);
 const req=calls[0].opts;
 assert.equal(req.method,'POST');
 assert.equal(req.credentials,'omit');
 assert.equal(req.redirect,'error');
 assert.equal(req.cache,'no-store');
 assert.equal(req.referrerPolicy,'no-referrer');
 assert.equal(req.headers.Authorization,'Bearer '+owner.token);
 assert.deepEqual(JSON.parse(req.body),draft);
 assert.equal(req.body.includes('owner'),false);
 assert.equal(req.body.includes('sessionId'),false);
});
test('G285 rejects role/MFA/expiry and bad zone or payload before any request',async()=>{
 for(const session of [
  {...owner,role:'admin'}, {...owner,role:'passenger'},
  {...owner,mfaVerified:false},{...owner,expiresAt:at-1},
  {...owner,token:''},null
 ]){
  const {g,calls}=gateway({getSession:async()=>session});
  assert.equal((await g.publish(zone,draft)).ok,false);
  assert.equal(calls.length,0);
 }
 const {g,calls}=gateway();
 for(const [z,d] of [[zone.toLowerCase(),draft],
  ['ASUNCION_QA?role=owner',draft],[zone,{...draft,ownerId:subject}],
  [zone,{...draft,basePyg:0}],[zone,{...draft,commissionBps:3001}],
  [zone,{...draft,requestKey:'reused'}]]){
  assert.equal((await g.publish(z,d)).ok,false);
 }
 assert.equal(calls.length,0);
});
test('G285 rejects false 200 receipts, wrong commission, unknown fields and LIVE',async()=>{
 for(const data of [
  {...receipt,commercialEnabled:true},{...receipt,zoneTag:'OTHER'},
  {...receipt,commissionBps:1800},{...receipt,idempotent:'false'},
  {...receipt,ruleKey:'G265_foreign'},{...receipt,secret:'fake'},
  {...receipt,mode:'LIVE'}
 ]){
  const {g,calls}=gateway({fetchImpl:async(url,opts)=>{
   calls.push({url,opts});
   return new Response(JSON.stringify(data),{status:200,
    headers:{'content-type':'application/json'}});
  }});
  assert.equal((await g.publish(zone,draft)).ok,false);
  assert.equal(calls.length,1);
 }
});
test('G285 treats non-200, invalid media and changed auth token as uncertain',async()=>{
 for(const response of [
  new Response('{}',{status:503,headers:{'content-type':'application/json'}}),
  new Response(JSON.stringify(receipt),{status:200,headers:{'content-type':'text/plain'}})
 ]){
  const {g}=gateway({fetchImpl:async()=>response.clone()});
  assert.equal((await g.publish(zone,draft)).ok,false);
 }
 let n=0;
 const {g}=gateway({getSession:async()=>({...owner,token:n++===0?owner.token:'stale-token'})});
 assert.equal((await g.publish(zone,draft)).code,'G285_STALE_OWNER_SESSION');
});
test('G285 does not retry after network error, and Admin defaults OFF',async()=>{
 let n=0;
 const {g}=gateway({fetchImpl:async()=>{n++;throw Error('network after commit unknown');}});
 assert.equal((await g.publish(zone,draft)).ok,false);
 assert.equal(n,1);
 const ui=await readFile(new URL('./OwnerAutoFareEditor.tsx',import.meta.url),'utf8');
 const main=await readFile(new URL('./main.tsx',import.meta.url),'utf8');
 const env=await readFile(new URL('../.env.example',import.meta.url),'utf8');
 assert.match(ui,/attemptedScopes.current.add\(zone\)/);
 assert.match(ui,/No repitas el POST/);
 assert.match(main,/<OwnerAutoFareEditor/);
 assert.match(env,/VITE_G285_OWNER_AUTO_FARE_ENABLED=false/);
 assert.match(env,/VITE_G285_OWNER_AUTO_FARE_CERTIFIED=false/);
});
