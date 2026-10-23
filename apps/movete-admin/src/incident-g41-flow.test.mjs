import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlobalTriageFlow} from './incident-g41-flow.mjs';
const t=1800000000000,id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const actor=()=>({subject:id(99),role:'admin',mfaVerified:true,authRevision:3});
const page=(cursor=null,filters={severityFilter:null,statusFilter:null})=>({
 scope:'SERVER_FILTERED_PAGE_ONLY',expiresAt:t+20000,
 severityFilter:filters.severityFilter,statusFilter:filters.statusFilter,
 hasGlobalTotal:false,emergencyDispatchEnabled:false,snapshotConsistent:false,
 nextCursor:cursor,items:[{incidentId:id(1),category:'SAFETY',severity:'CRITICAL',
  status:'OPEN',createdAt:t-1000,revision:1}]
});
const config=(getPage)=>createGlobalTriageFlow({now:()=>t,
 getActor:async()=>actor(),gateway:{isConfigured:()=>true,fetchPage:getPage}});
test('G41 no llama red si contrato no está montado',async()=>{
 let calls=0;
 const flow=createGlobalTriageFlow({gateway:{isConfigured:()=>false,fetchPage:()=>calls++}});
 assert.equal((await flow.load()).code,'G41_RUNTIME_NOT_CERTIFIED');
 assert.equal(calls,0);assert.equal(flow.snapshot().page,null);
});
test('la siguiente página usa mismos filtros de servidor y no existe máximo global',async()=>{
 const calls=[];
 const flow=config(async args=>{
  calls.push(args);
  return {ok:true,page:page(calls.length===1?'X'.repeat(44):null,
   {severityFilter:'CRITICAL',statusFilter:'OPEN'})};
 });
 assert.equal((await flow.load({severityFilter:'CRITICAL',statusFilter:'OPEN'})).ok,true);
 assert.equal(flow.snapshot().pageNumber,1);
 assert.equal((await flow.load({severityFilter:'CRITICAL',statusFilter:'OPEN',next:true})).ok,true);
 assert.equal(flow.snapshot().pageNumber,2);
 assert.deepEqual(calls,[{severityFilter:'CRITICAL',statusFilter:'OPEN',cursor:null},
  {severityFilter:'CRITICAL',statusFilter:'OPEN',cursor:'X'.repeat(44)}]);
 assert.equal(flow.snapshot().globalTotalKnown,false);
 assert.equal(flow.snapshot().emergencyDispatchEnabled,false);
});
test('nunca reutiliza un cursor con otro filtro',async()=>{
 let calls=0;
 const flow=config(async ()=>{
  calls++;return {ok:true,page:page('X'.repeat(44))};
 });
 await flow.load();
 assert.equal((await flow.load({severityFilter:'HIGH',next:true})).code,'NO_NEXT_PAGE_FOR_FILTER');
 assert.equal(calls,1);
});
test('cambio de filtro invalida página anterior y reinicia desde cursor vacío',async()=>{
 let n=0;
 const flow=config(async ({severityFilter})=>{
  n++;return {ok:true,page:page(null,{severityFilter,statusFilter:null})};
 });
 await flow.load();
 await flow.load({severityFilter:'HIGH'});
 assert.equal(flow.snapshot().pageNumber,1);
 assert.equal(flow.snapshot().severityFilter,'HIGH');
 assert.equal(n,2);
});
test('cierra cola al recibir cursor repetido o contenido extraño',async()=>{
 const flow=config(async()=>({ok:true,page:page('Z'.repeat(44))}));
 await flow.load();
 assert.equal((await flow.load({next:true})).code,'INVALID_G41_PAGE');
 assert.equal(flow.snapshot().page,null);
});
test('rechaza total global inventado y datos del servidor fuera del contrato',async()=>{
 const flow=config(async()=>({ok:true,page:{...page(),hasGlobalTotal:true}}));
 assert.equal((await flow.load()).code,'INVALID_G41_PAGE');
 assert.equal(flow.snapshot().page,null);
});
test('logout durante GET destruye cola y evita respuesta privada tardía',async()=>{
 let release;const pending=new Promise(done=>release=done);
 const flow=config(async()=>pending);
 const task=flow.load();
 await Promise.resolve();await Promise.resolve();
 flow.clear();release({ok:true,page:page()});
 assert.equal((await task).code,'STALE_RESPONSE_IGNORED');
 assert.equal(flow.snapshot().page,null);
});
test('cambio de MFA/JWT rechaza respuesta de sesión anterior',async()=>{
 let current=actor(),release;const pending=new Promise(done=>release=done);
 const flow=createGlobalTriageFlow({now:()=>t,getActor:async()=>current,
  gateway:{isConfigured:()=>true,fetchPage:async()=>pending}});
 const task=flow.load();await Promise.resolve();await Promise.resolve();
 current={...current,authRevision:4};release({ok:true,page:page()});
 assert.equal((await task).code,'STALE_SESSION_RESPONSE');
 assert.equal(flow.snapshot().page,null);
});
test('un error de red no hace pasar cola vacía por cero incidentes',async()=>{
 const flow=config(async()=>({ok:false,code:'NETWORK_OR_TIMEOUT'}));
 assert.equal((await flow.load()).code,'NETWORK_OR_TIMEOUT');
 assert.equal(flow.snapshot().page,null);
 assert.equal(flow.snapshot().globalTotalKnown,false);
});

test('atrás reconsulta al servidor con las anclas y no guarda filas de página antigua',async()=>{
 const c1='C'.repeat(44),c2='D'.repeat(44),visited=[];
 const flow=config(async ({cursor,...filters})=>{
  visited.push(cursor);
  return {ok:true,page:page(cursor===null?c1:cursor===c1?c2:null,filters)};
 });
 await flow.load();await flow.load({next:true});await flow.load({next:true});
 assert.equal(flow.snapshot().pageNumber,3);
 assert.equal((await flow.load({previous:true})).ok,true);
 assert.equal(flow.snapshot().pageNumber,2);
 assert.equal((await flow.load({previous:true})).ok,true);
 assert.equal(flow.snapshot().pageNumber,1);
 assert.equal(flow.snapshot().hasPrevious,false);
 assert.deepEqual(visited,[null,c1,c2,c1,null]);
});
test('retroceder y avanzar rehace GET del cursor en vez de recuperar cache antigua',async()=>{
 const c1='a'.repeat(44),c2='b'.repeat(44),requests=[];
 const flow=config(async ({cursor,...filters})=>{
  requests.push(cursor);return {ok:true,page:page(cursor===null?c1:cursor===c1?c2:null,filters)};
 });
 await flow.load();await flow.load({next:true});await flow.load({next:true});
 await flow.load({previous:true});
 assert.equal((await flow.load({next:true})).ok,true);
 assert.deepEqual(requests,[null,c1,c2,c1,c2]);
 assert.equal(flow.snapshot().pageNumber,3);
});
test('ancla anterior no es reutilizable con filtro ajeno ni en página 1',async()=>{
 const c1='e'.repeat(44),visited=[];
 const flow=config(async ({cursor,...filters})=>{
  visited.push(cursor);return {ok:true,page:page(cursor===null?c1:null,filters)};
 });
 await flow.load();await flow.load({next:true});
 assert.equal((await flow.load({severityFilter:'HIGH',previous:true})).code,
  'NO_PREVIOUS_PAGE_FOR_FILTER');
 assert.equal(visited.length,2);
 assert.equal((await flow.load({next:true,previous:true})).code,'INVALID_FILTER');
 await flow.load();
 assert.equal((await flow.load({previous:true})).code,'NO_PREVIOUS_PAGE_FOR_FILTER');
});
test('sin límite global artificial: 120 páginas navegables con backend paginado',async()=>{
 const cursor=n=>'P'+String(n).padStart(43,'0');
 const flow=config(async ({cursor:anchor,...filters})=>{
  const current=anchor===null?1:Number(anchor.slice(1))+1;
  return {ok:true,page:page(current<120?cursor(current):null,filters)};
 });
 assert.equal((await flow.load()).ok,true);
 for(let i=1;i<120;i++)assert.equal((await flow.load({next:true})).ok,true);
 assert.equal(flow.snapshot().pageNumber,120);
 assert.equal(flow.snapshot().hasNext,false);
 assert.equal(flow.snapshot().globalTotalKnown,false);
 assert.equal((await flow.load({previous:true})).ok,true);
 assert.equal(flow.snapshot().pageNumber,119);
});
test('MFA revocada mientras lee bloquea respuesta anterior',async()=>{
 let active=actor(),release;
 const pending=new Promise(done=>release=done);
 const flow=createGlobalTriageFlow({now:()=>t,getActor:async()=>active,
  gateway:{isConfigured:()=>true,fetchPage:()=>pending}});
 const request=flow.load();await Promise.resolve();await Promise.resolve();
 active={...active,mfaVerified:false};release({ok:true,page:page()});
 assert.equal((await request).code,'STALE_SESSION_RESPONSE');
 assert.equal(flow.snapshot().page,null);
});
