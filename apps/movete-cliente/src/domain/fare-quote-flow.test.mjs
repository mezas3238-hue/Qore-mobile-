import test from 'node:test';
import assert from 'node:assert/strict';
import {createFareQuoteFlow} from './fare-quote-flow.mjs';
const user='123e4567-e89b-42d3-a456-426614174000',
 trip='123e4567-e89b-42d3-a456-426614174001',
 key='123e4567-e89b-42d3-a456-426614174003',
 other='123e4567-e89b-42d3-a456-426614174004';
const actor=async()=>({subject:user,role:'passenger'});
test('un solo intento en vuelo, timeout conserva requestKey sin crear nuevos',async()=>{
 let n=0;const sent=[];
 const flow=createFareQuoteFlow({gateway:{isConfigured:()=>true,fetchQuote:async(id,k)=>{
  sent.push([id,k]);return ++n===1?{ok:false,code:'NETWORK_OR_TIMEOUT'}:{ok:true,data:{server:true}};
 }},getActor:actor,onAccept:()=>true});
 assert.equal(flow.prepare({subject:user,tripId:trip,requestKey:key}).ok,true);
 const first=flow.submit(),second=flow.submit();
 assert.equal((await second).code,'NO_READY_QUOTE');
 assert.equal((await first).code,'NETWORK_OR_TIMEOUT');
 assert.equal(flow.prepare({subject:user,tripId:trip,requestKey:other}).code,'EXPLICIT_RETRY_REQUIRED');
 assert.equal((await flow.retry()).ok,true);
 assert.deepEqual(sent,[[trip,key],[trip,key]]);
 assert.equal(flow.snapshot().phase,'acknowledged');
});
test('una sesión cerrada no recibe cotización tardía',async()=>{
 let resume,accepted=0;
 const pending=new Promise(r=>resume=r);
 const flow=createFareQuoteFlow({gateway:{isConfigured:()=>true,fetchQuote:async()=>pending},
  getActor:actor,onAccept:()=>{accepted++;return true;}});
 flow.prepare({subject:user,tripId:trip,requestKey:key});
 const task=flow.submit();
 await Promise.resolve();await Promise.resolve();
 flow.clear();resume({ok:true,data:{}});
 assert.equal((await task).code,'STALE_RESPONSE');
 assert.equal(accepted,0);assert.equal(flow.snapshot().phase,'idle');
});
test('sin gateway certificado no puede ejecutar cotización',async()=>{
 const flow=createFareQuoteFlow({gateway:null,getActor:actor});
 flow.prepare({subject:user,tripId:trip,requestKey:key});
 assert.equal((await flow.submit()).code,'FARE_CONTRACT_PENDING');
});
test('409 no admite un reintento ciego con nuevo requestKey',async()=>{
 const flow=createFareQuoteFlow({gateway:{isConfigured:()=>true,
  fetchQuote:async()=>({ok:false,code:'QUOTE_CONFLICT'})},getActor:actor});
 flow.prepare({subject:user,tripId:trip,requestKey:key});
 assert.equal((await flow.submit()).code,'QUOTE_CONFLICT');
 assert.equal(flow.prepare({subject:user,tripId:trip,requestKey:other}).code,'RESET_FARE_FIRST');
});
