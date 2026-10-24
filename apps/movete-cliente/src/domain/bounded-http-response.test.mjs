import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedResponseText} from './bounded-http-response.mjs';
const encode=new TextEncoder();
test('lee HTTP con Unicode fragmentado sin buffering ilimitado',async()=>{
 const content='{"municipio":"Asunción","vehículo":"🚕"}';
 const bytes=encode.encode(content);
 const response={body:new ReadableStream({start(c){
  for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();
 }}),text:async()=>{throw Error('no usar text');}};
 const result=await readBoundedResponseText(response,{limit:bytes.byteLength});
 assert.equal(result.ok,true);assert.equal(result.text,content);
});
test('una respuesta mayor al límite se rechaza antes de acumular todo',async()=>{
 let reads=0,abort=0;
 const result=await readBoundedResponseText({
  body:{getReader:()=>({read:async()=>{
   reads++;return {done:false,value:new Uint8Array(800)};},
   cancel:()=>{abort++;},releaseLock:()=>{}})}
 },{limit:1024});
 assert.equal(result.code,'RESPONSE_TOO_LARGE');
 assert.equal(reads,2);assert.equal(abort,1);
});
test('un stream de UTF-8 inválido no se presenta como datos JSON',async()=>{
 const result=await readBoundedResponseText({body:new ReadableStream({start(c){
  c.enqueue(new Uint8Array([0xed,0xa0,0x80]));c.close();
 }})},{limit:100});
 assert.equal(result.code,'BAD_SERVER_RESPONSE');
});
test('abort durante lectura colgada termina sin datos ni fuga',async()=>{
 const controller=new AbortController();let cancelled=0;
 const pending=readBoundedResponseText({body:{getReader:()=>({
  read:()=>new Promise(()=>{}),cancel:()=>{cancelled++;},releaseLock:()=>{}
 })}},{limit:1024,signal:controller.signal});
 controller.abort();
 assert.equal((await pending).code,'NETWORK_OR_TIMEOUT');
 assert.equal(cancelled,1);
});
test('fallback React Native sin ReadableStream sigue midiendo bytes UTF-8',async()=>{
 const response={text:async()=>JSON.stringify({content:'á'.repeat(600)})};
 assert.equal((await readBoundedResponseText(response,{limit:1024})).code,'RESPONSE_TOO_LARGE');
 assert.equal((await readBoundedResponseText({text:async()=>'{ "ok": true }'},{limit:1024})).ok,true);
});
