import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientHistoryGateway} from './client-history-gateway.mjs';
const owner='123e4567-e89b-42d3-a456-426614174000';
const now=1800000000000;
const valid=()=>({subject:owner,role:'passenger',token:'synthetic-passenger-token-12345',
 expiresAt:now+90000,authRevision:2});
const result=(body={scope:'test'})=>({ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(body)});
const configured={
 enabled:true,contractCertified:true,origin:'https://staging.example.invalid',
 pinnedOrigin:'https://staging.example.invalid',getSession:async()=>valid(),
 fetchImpl:async()=>result(),now:()=>now
};
test('sin contrato certificado no se envía un solo byte de red',async()=>{
 let count=0;
 const g=createClientHistoryGateway({...configured,contractCertified:false,
  fetchImpl:async()=>{count++;return result();}});
 assert.equal((await g.fetchPage()).code,'HISTORY_CONTRACT_PENDING');
 assert.equal(count,0);
 assert.equal(createClientHistoryGateway().isConfigured(),false);
});
test('cursores opacos seguros permiten múltiples páginas sin techo de registros',async()=>{
 const urls=[];
 const g=createClientHistoryGateway({...configured,fetchImpl:async(url,opts)=>{
  urls.push([url,opts]);return result();
 }});
 assert.equal((await g.fetchPage()).ok,true);
 assert.equal((await g.fetchPage(signed('page_10001'))).ok,true);
 assert.equal(urls[1][0],'https://staging.example.invalid/v1/staging/rider/history');
 assert.equal(urls[1][1].headers['X-Qore-History-Cursor'],signed('page_10001'));
 assert.equal(Object.hasOwn(urls[0][1].headers,'X-Qore-History-Cursor'),false);
 assert.equal(urls[0][1].method,'GET');
 assert.equal(urls[0][1].credentials,'omit');
 assert.equal(urls[0][1].cache,'no-store');
 assert.equal(urls[0][1].redirect,'error');
 assert.equal(urls[0][1].referrerPolicy,'no-referrer');
 assert.equal(urls[0][1].headers.Authorization,'Bearer '+valid().token);
});
test('sin endpoint dinámico ni inyección en cursor o origin',async()=>{
 for(const cursor of ['../../driver','x?admin=true','a+b','a@b','', 'x'.repeat(201),'v1.x.bad']){
  const g=createClientHistoryGateway(configured);
  assert.equal((await g.fetchPage(cursor)).code,'INVALID_CURSOR');
 }
 for(const origin of ['http://staging.example.invalid','https://evil.invalid',
  'https://staging.example.invalid/other','https://staging.example.invalid:444',
  'https://me@staging.example.invalid','https://staging.example.invalid/?token=x']){
  const g=createClientHistoryGateway({...configured,origin});
  assert.equal(g.isConfigured(),false);
 }
});
test('requiere identidad Passenger y token no vencido',async()=>{
 for(const bad of [{...valid(),role:'admin'},{...valid(),role:'driver'},
  {...valid(),subject:'not-uuid'},{...valid(),expiresAt:now},
  {...valid(),token:'small'}]){
  const g=createClientHistoryGateway({...configured,getSession:async()=>bad});
  assert.equal((await g.fetchPage()).code,'AUTH_REQUIRED');
 }
});
test('403 de sesión sustituida no revoca sesión nueva',async()=>{
 let current=valid(),resume,invalidations=0;
 const pending=new Promise(r=>resume=r);
 const g=createClientHistoryGateway({...configured,getSession:async()=>current,
  fetchImpl:async()=>pending,onSessionInvalid:()=>invalidations++});
 const task=g.fetchPage();
 await Promise.resolve();await Promise.resolve();
 current={...current,authRevision:3};
 resume({status:403,ok:false,redirected:false});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(invalidations,0);
});
test('resultado 200 de otra cuenta o login posterior no se entrega',async()=>{
 let current=valid(),resume;
 const pending=new Promise(r=>resume=r);
 const g=createClientHistoryGateway({...configured,getSession:async()=>current,
  fetchImpl:async()=>pending});
 const task=g.fetchPage();
 await Promise.resolve();await Promise.resolve();
 current={...current,subject:'123e4567-e89b-42d3-a456-426614174001'};
 resume(result());
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
});
test('doble carga concurrente no duplica página',async()=>{
 let resume,n=0;
 const wait=new Promise(r=>resume=r);
 const g=createClientHistoryGateway({...configured,fetchImpl:async()=>{n++;return wait;}});
 const task=g.fetchPage();
 assert.equal((await g.fetchPage()).code,'HISTORY_READ_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();assert.equal(n,1);
 resume(result());
 assert.equal((await task).ok,true);
});
test('red, 429, 503 y respuestas no JSON cierran sin inventar datos',async()=>{
 for(const response of [
  {status:429,ok:false,redirected:false},{status:503,ok:false,redirected:false},
  {...result(),headers:{get:()=> 'text/html'}},
  {...result(),text:async()=>JSON.stringify([])},
  {...result(),text:async()=>'{error'},
  {...result(),text:async()=> 'x'.repeat(300000)}
 ]){
  const g=createClientHistoryGateway({...configured,fetchImpl:async()=>response});
  assert.equal((await g.fetchPage()).ok,false);
 }
 const dead=createClientHistoryGateway({...configured,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal((await dead.fetchPage()).code,'NETWORK_OR_TIMEOUT');
});
