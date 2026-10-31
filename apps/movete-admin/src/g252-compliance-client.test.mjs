import test from 'node:test';
import assert from 'node:assert/strict';
import {createG252ComplianceClient,projectG252ComplianceAlerts}
 from './g252-compliance-client.mjs';
const id=n=>'25200000-0000-4252-8252-'+String(n).padStart(12,'0');
const at=Date.parse('2026-10-31T14:00:00Z');
const who=id(1),driver=id(2);
const session={subject:who,role:'admin',mfaVerified:true,
 token:'qore-already-verified-private-admin-bearer-252',
 expiresAt:at+120000};
const body={mode:'STAGING_DEMO_ONLY',
 scope:'admin.compliance.document_alerts.read',viewerId:who,
 items:[{driverId:driver,kind:'licencia',band:'EXPIRED',
  validUntilMs:at-3600000}],hasMore:false,observedAt:at-1000,
 expiresAt:at+20000,serverPersisted:true,documentFilesExposed:false,
 automaticApproval:false,adminDispatchControl:false,
 qaOnly:true,productionEnabled:false};
const options={
 enabled:true,ownerApproved:true,contractVerified:true,
 externalRuntimeVerified:true,serverMfaVerified:true,
 serverRbacVerified:true,serverRevocationVerified:true,
 origin:'https://qore-test.up.railway.app',
 pinnedOrigin:'https://qore-test.up.railway.app',
 getSession:async()=>session,now:()=>at,
 fetchImpl:async()=>new Response(JSON.stringify(body),{
  status:200,headers:{'content-type':'application/json'}})
};
test('G252 client parses only authorized, server persisted Driver expiry rows',async()=>{
 const p=projectG252ComplianceAlerts(body,{subject:who,at});
 assert.deepEqual(p.items,body.items);
 assert.equal(p.hasMore,false);
 const calls=[];
 const client=createG252ComplianceClient({...options,fetchImpl:async(url,opt)=>{
  calls.push({url,opt});
  return options.fetchImpl(url,opt);
 }});
 assert.equal(client.isConfigured(),true);
 const res=await client.fetchAlerts();
 assert.equal(res.ok,true);
 assert.deepEqual(res.page.items,body.items);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,
  'https://qore-test.up.railway.app/v1/staging/admin/compliance/document-alerts');
 assert.equal(calls[0].opt.credentials,'omit');
 assert.equal(calls[0].opt.method,'GET');
});
test('G252 projection rejects forged admin dispatch and extra sensitive fields',()=>{
 for(const bad of [
  {...body,automaticApproval:true},
  {...body,adminDispatchControl:true},
  {...body,productionEnabled:true},
  {...body,documentFilesExposed:true},
  {...body,viewerId:driver},
  {...body,items:[{...body.items[0],photo:'private'}]},
  {...body,items:[...body.items,body.items[0]]},
  {...body,expiresAt:at-1},
  {...body,accessToken:'leak'}
 ]){
  assert.equal(projectG252ComplianceAlerts(bad,{subject:who,at}),null);
 }
});
test('G252 client defaults fail closed and rejects unpinned/non-HTTPS domains',()=>{
 assert.equal(createG252ComplianceClient().isConfigured(),false);
 for(const changed of [
  {enabled:false},{serverMfaVerified:false},
  {origin:'http://qore-test.up.railway.app'},
  {pinnedOrigin:'https://evil.up.railway.app'},
  {origin:'https://qore-test.up.railway.app.evil.com'},
  {origin:'https://qore-test.up.railway.app:4444'}
 ])assert.equal(createG252ComplianceClient({...options,...changed}).isConfigured(),false);
});
test('G252 client fails if role, MFA or identity session is replaced',async()=>{
 for(const changed of [
  {role:'owner'},{mfaVerified:false},{subject:driver},{expiresAt:at+500}
 ]){
  const result=await createG252ComplianceClient({
   ...options,getSession:async()=>({...session,...changed})
  }).fetchAlerts();
  assert.equal(result.ok,false);
 }
});
test('G252 refuses 403, redirects, fake content type, and raw body corruption',async()=>{
 const responses=[
  new Response('Forbidden',{status:403}),
  new Response('{}',{status:200,headers:{'content-type':'text/html'}}),
  new Response('{corrupt',{status:200,headers:{'content-type':'application/json'}}),
  new Response(JSON.stringify({...body,extra:'sensitive'}),
   {status:200,headers:{'content-type':'application/json'}})
 ];
 for(const response of responses){
  const result=await createG252ComplianceClient({
   ...options,fetchImpl:async()=>response
  }).fetchAlerts();
  assert.equal(result.ok,false);
 }
});
