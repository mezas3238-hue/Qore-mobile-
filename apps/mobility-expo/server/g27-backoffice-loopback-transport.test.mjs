import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreBackofficeReadGateway} from './g27-backoffice-read-gateway.mjs';
import {createQoreBackofficeLoopbackTransport,listenQoreBackofficeLoopback}
 from './g27-backoffice-loopback-transport.mjs';

const at=Date.parse('2026-10-23T12:00:00Z');
const actor='11111111-1111-4111-8111-111111111111';
const token='syntheticBearerOnlyLocal12345678901234567890';
const basePath='/v1/staging/admin/vehicle-review-queue';
const requestKey='aaa-qa-not-a-token';
const cert={id:actor,sessionId:'qa-session-001',is_anonymous:false,
 email_confirmed_at:'2026-10-22T10:00:00Z',expiresAtMs:at+600000};
const mfa={verifiedByProvider:true,userId:actor,sessionId:cert.sessionId,
 assuranceLevel:'aal2',verifiedAtMs:at-1000,expiresAtMs:at+500000};
const uuid=n=>n.toString(16).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const records=Array.from({length:58},(_,i)=>({
 vehicleId:uuid(58-i),vehicleKind:'AUTO',applicationStatus:'pending',
 licenseStatus:'pending',insuranceStatus:'missing',
 inspectionStatus:'missing',reviewRevision:1
}));
function gateway(){
 let queries=0;
 const handler=createQoreBackofficeReadGateway({
  projectRef:'staging1234567890abcd',
  cursorSecrets:{current:'synthetic-private-A05-HTTP-key-32-bytes-plus-entropy-placeholder'},
  now:()=>at,
  verifyAccessToken:async t=>t===token?cert:Promise.reject(Error('invalid')),
  loadExclusiveBackofficeRole:async()=> 'admin',
  verifyBackofficeMfa:async()=>mfa,
  authorizePermission:async()=>true,
  allowRequest:()=>true,
  loadPage:async({scope,actorId,limit,after})=>{
   assert.equal(scope,'admin.kyc.read');assert.equal(actorId,actor);
   assert.equal(limit,50);queries++;
   const candidates=records.filter(x=>after===null||
    x.vehicleId.replaceAll('-','')<after);
   return {revision:1,items:candidates.slice(0,50),hasMore:candidates.length>50};
  }
 });
 return {handler,queries:()=>queries};
}
test('A05 real HTTP localhost: private Admin read and next-page cursor 58/58 without global cap',async t=>{
 const g=gateway();
 const server=createQoreBackofficeLoopbackTransport({readHandler:g.handler});
 assert.throws(()=>server.listen(0,'0.0.0.0'),/127\.0\.0\.1/);
 assert.throws(()=>server.listen(0,'::'),/127\.0\.0\.1/);
 const origin=await listenQoreBackofficeLoopback(server);
 t.after(async()=>new Promise(resolve=>server.close(resolve)));
 const headers={authorization:'Bearer '+token,accept:'application/json'};
 const page1=await fetch(origin+basePath,{headers});
 assert.equal(page1.status,200);
 assert.equal(page1.headers.get('access-control-allow-origin'),null);
 assert.equal(page1.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(page1.headers.get('x-content-type-options'),'nosniff');
 const a=await page1.json();assert.equal(a.items.length,50);
 assert.match(a.nextCursor,/^[A-Za-z0-9_-]{44,256}$/);
 const page2=await fetch(origin+basePath+'?cursor='+a.nextCursor,{headers});
 assert.equal(page2.status,200);
 const b=await page2.json();assert.equal(b.items.length,8);
 assert.equal(b.nextCursor,null);assert.equal(g.queries(),2);
 assert.equal(new Set([...a.items,...b.items].map(x=>x.vehicleId)).size,58);
});
test('A05 localhost HTTP hard denies missing JWT, cookies, CORS and GET payloads',async t=>{
 const g=gateway(),server=createQoreBackofficeLoopbackTransport({readHandler:g.handler});
 const origin=await listenQoreBackofficeLoopback(server);
 t.after(async()=>new Promise(resolve=>server.close(resolve)));
 const get=async(path,headers={})=>fetch(origin+path,{headers});
 assert.equal((await get(basePath)).status,401);
 assert.equal((await get(basePath,{origin:'https://attacker.example',
  authorization:'Bearer '+token})).status,403);
 assert.equal((await get(basePath,{cookie:'session=forged',
  authorization:'Bearer '+token})).status,403);
 assert.equal((await get(basePath+'?ownerId='+actor,
  {authorization:'Bearer '+token})).status,400);
 assert.equal((await get(basePath+'?cursor='+requestKey,
  {authorization:'Bearer '+token})).status,400);
 assert.equal((await fetch(origin+basePath,{method:'POST',headers:{
  authorization:'Bearer '+token}})).status,405);
});
