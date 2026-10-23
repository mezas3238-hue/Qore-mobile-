import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedResponseText,countUtf8Bytes} from './bounded-json-response.mjs';
const enc=new TextEncoder();
const stream=(parts,onCancel=()=>{})=>({
 body:new ReadableStream({start(controller){for(const item of parts)controller.enqueue(item);
 controller.close();},cancel:onCancel}),
 text:async()=>{throw Error('no debe llamar text en streaming');}
});
test('UTF-8 exacto, acentos y emoji cortados entre chunks',async()=>{
 const payload='{"name":"Asunción 🚕"}';
 const bytes=enc.encode(payload);
 const parts=[bytes.slice(0,19),bytes.slice(19,22),bytes.slice(22)];
 const r=await readBoundedResponseText(stream(parts),{limit:bytes.length});
 assert.equal(r.ok,true);
 assert.equal(r.text,payload);
 assert.equal(countUtf8Bytes(payload),bytes.length);
});
test('streaming corta respuesta antes de acumular datos mayores al límite',async()=>{
 let cancelCount=0;
 const response={body:{getReader:()=>{
  let count=0;
  return {read:async()=>({done:false,value:new Uint8Array(++count===1?600:600)}),
    cancel:()=>{cancelCount++;},releaseLock:()=>{}};
 }}};
 const result=await readBoundedResponseText(response,{limit:1024});
 assert.equal(result.code,'RESPONSE_TOO_LARGE');
 assert.equal(cancelCount,1);
});
test('rechaza secuencias UTF-8 inválidas y truncadas sin decode permisivo',async()=>{
 for(const bytes of [[0xff],[0xe0,0x80,0x80],[0xf0,0x90,0x80],
  [0xed,0xa0,0x80],[0xc0,0x80]]){
  assert.equal((await readBoundedResponseText(stream([new Uint8Array(bytes)]),{limit:30})).code,
   'BAD_SERVER_RESPONSE');
 }
});
test('body sin ReadableStream sigue aplicando límite de bytes, no caracteres',async()=>{
 const r=await readBoundedResponseText({text:async()=>JSON.stringify({msg:'á'.repeat(600)})},{limit:1024});
 assert.equal(r.code,'RESPONSE_TOO_LARGE');
});
test('AbortSignal cancela lector que ignora deadline antes de producir bytes',async()=>{
 const controller=new AbortController();let cancelled=0;
 const response={body:{getReader:()=>({
  read:()=>new Promise(()=>{}),
  cancel:()=>{cancelled++;},releaseLock:()=>{}
 })}};
 const pending=readBoundedResponseText(response,{limit:1024,signal:controller.signal});
 controller.abort();
 const r=await pending;
 assert.equal(r.code,'NETWORK_OR_TIMEOUT');
 assert.equal(cancelled,1);
});
test('respuesta sin lector ni text y límite inválido fallan cerrados',async()=>{
 assert.equal((await readBoundedResponseText({},{limit:100})).code,'BAD_SERVER_RESPONSE');
 assert.equal((await readBoundedResponseText({text:async()=>''},{limit:0})).code,'BAD_SERVER_RESPONSE');
});
