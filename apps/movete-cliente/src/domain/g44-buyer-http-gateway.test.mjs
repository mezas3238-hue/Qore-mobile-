import test from 'node:test';
import assert from 'node:assert/strict';
import {createG44BuyerHttpGateway} from './g44-buyer-http-gateway.mjs';
const time=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const branch=id(1),subject=id(2),cursor='c'.repeat(44);
const actor=()=>({subject,role:'passenger',token:'synthetic-jwt-20-characters-only',
 authRevision:4,sessionRevision:8,expiresAt:time+90000});
const branchPage=()=>({
 municipality:'Asunción',serviceKind:'MOTO_DELIVERY',items:[{
  branchId:branch,branchTag:'CENTRO',merchantKind:'SUPERMARKET',
  municipality:'Asunción',serviceKind:'MOTO_DELIVERY',
  eligibleByPolicy:false,orderEnabled:false
 }],nextCursor:null,orderEnabled:false,productionEnabled:false
});
const catalog=()=>({
 branchId:branch,version:5,expiresAt:time+60000,
 items:[{itemId:id(3),itemTag:'ARROZ_1KG',itemClass:'GENERAL',
  active:true,unitPricePyg:4500,stockUnits:5}],
 nextCursor:null,orderEnabled:false,eligibleByPolicy:false,
 snapshotConsistent:false,productionEnabled:false
});
const response=(data,status=200)=>({status,ok:status===200,redirected:false,
 headers:{get:key=>key==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
const settings={
 enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
 now:()=>time,getSession:async()=>actor(),
 fetchImpl:async()=>response(branchPage())
};
const context={cursor:null,subject,sessionRevision:8};
test('G44 OFF por defecto nunca hace HTTP, aunque haya función fetch',async()=>{
 let hits=0;
 const g=createG44BuyerHttpGateway({...settings,enabled:false,
  fetchImpl:async()=>{hits++;return response(branchPage());}});
 assert.equal(g.isConfigured(),false);
 assert.equal((await g.readBuyerBranches({municipality:'Asunción',
  serviceKind:'MOTO_DELIVERY',...context})).code,'G44_RUNTIME_NOT_CERTIFIED');
 assert.equal(hits,0);
});
test('G44 HTTPS pinned y token Passenger: lista sucursales sin cookies',async()=>{
 let called;
 const g=createG44BuyerHttpGateway({...settings,fetchImpl:async(url,init)=>{
  called={url,init};return response(branchPage());
 }});
 const result=await g.readBuyerBranches({municipality:'Asunción',
  serviceKind:'MOTO_DELIVERY',...context});
 assert.equal(result.ok,true);
 assert.equal(called.url,'https://staging.example.invalid/v1/staging/buyer/branches?municipality=Asunci%C3%B3n&serviceKind=MOTO_DELIVERY');
 assert.equal(called.init.method,'GET');
 assert.equal(called.init.credentials,'omit');
 assert.equal(called.init.redirect,'error');
 assert.equal(called.init.cache,'no-store');
 assert.equal(called.init.headers.Authorization,'Bearer '+actor().token);
 assert.equal(Object.hasOwn(called.init,'body'),false);
 assert.equal(result.data.orderEnabled,false);
 assert.equal(Object.hasOwn(result.data,'token'),false);
});
test('G44 catálogo usa branchId fijo y cursor seguro solo por query',async()=>{
 let seen;
 const g=createG44BuyerHttpGateway({...settings,fetchImpl:async(url,init)=>{
  seen={url,init};return response(catalog());
 }});
 const result=await g.readBuyerCatalog(branch,{...context,cursor});
 assert.equal(result.ok,true);
 assert.equal(seen.url,'https://staging.example.invalid/v1/staging/buyer/branches/'+branch+'/catalog?cursor='+cursor);
 assert.equal(result.data.version,5);
 assert.equal(result.ordersEnabled,false);
});
test('G44 falla cerrado ante origen falso, HTTP, path, credenciales o puerto',()=>{
 for(const origin of ['http://staging.example.invalid','https://evil.invalid',
  'https://user@staging.example.invalid','https://staging.example.invalid:444',
  'https://staging.example.invalid/path','https://staging.example.invalid/?x=1']){
  assert.equal(createG44BuyerHttpGateway({...settings,origin}).isConfigured(),false);
 }
});
test('G44 no llama red con rol Driver, sesión vencida, actor cruzado o cursor inyectado',async()=>{
 let count=0;
 for(const session of [{...actor(),role:'driver'},{...actor(),expiresAt:time-1}]){
  const g=createG44BuyerHttpGateway({...settings,getSession:async()=>session,
   fetchImpl:async()=>{count++;return response(catalog());}});
  assert.equal((await g.readBuyerCatalog(branch,context)).code,'AUTH_REQUIRED');
 }
 const g=createG44BuyerHttpGateway({...settings,fetchImpl:async()=>{
  count++;return response(catalog());
 }});
 assert.equal((await g.readBuyerCatalog(branch,{...context,subject:id(77)})).code,
  'STALE_SESSION_RESPONSE');
 assert.equal((await g.readBuyerCatalog(branch,{...context,cursor:'../admin'})).code,'INVALID_G44_QUERY');
 assert.equal((await g.readBuyerCatalog('evil',context)).code,'INVALID_G44_QUERY');
 assert.equal(count,0);
});
test('G44 401/403 antiguas no revocan token nuevo ni exponen catálogo',async()=>{
 let current=actor(),release,invalidations=0;
 const pending=new Promise(resolve=>release=resolve);
 const g=createG44BuyerHttpGateway({...settings,
  getSession:async()=>current,fetchImpl:async()=>pending,
  onSessionInvalid:()=>invalidations++});
 const task=g.readBuyerCatalog(branch,context);
 await Promise.resolve();await Promise.resolve();
 current={...current,token:'new-synthetic-jwt-for-another-session',authRevision:5};
 release({status:401,ok:false,redirected:false});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(invalidations,0);
});
test('G44 401 estable provoca revocación solo de sesión actual',async()=>{
 let count=0;
 const g=createG44BuyerHttpGateway({...settings,
  fetchImpl:async()=>({status:401,ok:false,redirected:false}),
  onSessionInvalid:()=>count++});
 assert.equal((await g.readBuyerCatalog(branch,context)).code,'AUTH_REQUIRED');
 assert.equal(count,1);
});
test('G44 rechaza PII, flags de producción, precio inválido y contenido extraño',async()=>{
 for(const payload of [
  {...catalog(),customerName:'Privado'},
  {...catalog(),productionEnabled:true},
  {...catalog(),items:[{...catalog().items[0],unitPricePyg:-1}]},
  {...catalog(),version:'5'}
 ]){
  const g=createG44BuyerHttpGateway({...settings,
   fetchImpl:async()=>response(payload)});
  assert.equal((await g.readBuyerCatalog(branch,context)).code,'INVALID_G44_PAGE');
 }
 const wrongType=createG44BuyerHttpGateway({...settings,
  fetchImpl:async()=>({...response(catalog()),headers:{get:()=> 'text/html'}})});
 assert.equal((await wrongType.readBuyerCatalog(branch,context)).code,'BAD_CONTENT_TYPE');
 const broken=createG44BuyerHttpGateway({...settings,
  fetchImpl:async()=>({...response(catalog()),text:async()=>'{broken'})});
 assert.equal((await broken.readBuyerCatalog(branch,context)).code,'BAD_SERVER_RESPONSE');
});
test('G44 rechaza streaming sobre presupuesto de bytes sin fallback text()',async()=>{
 let called=0;
 const g=createG44BuyerHttpGateway({...settings,
  maxBytes:1024,fetchImpl:async()=>({...response(catalog()),
   body:new ReadableStream({start(c){c.enqueue(new Uint8Array(1025));c.close();}}),
   text:async()=>{called++;throw Error('not allowed');}
  })});
 assert.equal((await g.readBuyerCatalog(branch,context)).code,'RESPONSE_TOO_LARGE');
 assert.equal(called,0);
});
test('G44 cancelPending libera nueva sesión aun cuando viejo fetch ignore abort',async()=>{
 let hit=0,release,firstSignal;
 const waiting=new Promise(resolve=>release=resolve);
 const g=createG44BuyerHttpGateway({...settings,fetchImpl:async(_url,init)=>{
  hit++;if(hit===1){firstSignal=init.signal;return waiting;}
  return response(catalog());
 }});
 const previous=g.readBuyerCatalog(branch,context);
 await Promise.resolve();await Promise.resolve();
 assert.equal((await g.readBuyerCatalog(branch,context)).code,'G44_READ_IN_FLIGHT');
 g.cancelPending();
 assert.equal(firstSignal.aborted,true);
 assert.equal((await g.readBuyerCatalog(branch,context)).ok,true);
 release(response(catalog()));
 assert.equal((await previous).code,'STALE_SESSION_RESPONSE');
 assert.equal((await g.readBuyerCatalog(branch,context)).ok,true);
 assert.equal(hit,3);
});
test('G44 solicitudes independientes de directorio y catálogo no se bloquean',async()=>{
 let release;
 const waiting=new Promise(resolve=>release=resolve);
 const g=createG44BuyerHttpGateway({...settings,fetchImpl:async url=>{
  return url.includes('/catalog')?response(catalog()):waiting;
 }});
 const branches=g.readBuyerBranches({municipality:'Asunción',serviceKind:'MOTO_DELIVERY',...context});
 await Promise.resolve();await Promise.resolve();
 assert.equal((await g.readBuyerCatalog(branch,context)).ok,true);
 release(response(branchPage()));
 assert.equal((await branches).ok,true);
});
