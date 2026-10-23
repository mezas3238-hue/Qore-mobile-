import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectServerQuote,createQuoteViewStore} from './quote-view.mjs';
const subject='123e4567-e89b-42d3-a456-426614174000';
const quote={ownerId:subject,quoteId:'123e4567-e89b-42d3-a456-426614174001',
 subjectId:'123e4567-e89b-42d3-a456-426614174002',subjectKind:'RIDE',fareMode:'AUTO',
 amountGs:15500,expiresAt:500000,fareVersion:'g7-qa-1',routingVerified:true};
test('importe de guaraníes proviene solo de respuesta validada',()=>{
 const output=inspectServerQuote(quote,{subject,now:400000});
 assert.equal(output.amountGs,15500);
 assert.ok(output.formattedAmount.includes('Gs.'));
 assert.equal(Object.hasOwn(output,'driverCommission'),false);
});
test('rechaza usuario ajeno, cotización vencida y monto manipulado',()=>{
 assert.equal(inspectServerQuote({...quote,ownerId:'123e4567-e89b-42d3-a456-426614174099'},{subject,now:400000}),null);
 assert.equal(inspectServerQuote({...quote,expiresAt:399999},{subject,now:400000}),null);
 for(const amountGs of [-1,0,1.2,NaN,Number.MAX_SAFE_INTEGER]){
  assert.equal(inspectServerQuote({...quote,amountGs},{subject,now:400000}),null);
 }
});
test('servicio moto de pasajeros y evidencia de ruta no confirmada se rechazan',()=>{
 assert.equal(inspectServerQuote({...quote,fareMode:'MOTO'},{subject,now:400000}),null);
 assert.equal(inspectServerQuote({...quote,routingVerified:false},{subject,now:400000}),null);
 assert.equal(inspectServerQuote({...quote,subjectKind:'DELIVERY'},{subject,now:400000}),null);
});
test('caducidad retira importe al pasar el reloj',()=>{
 let time=400000;const store=createQuoteViewStore({now:()=>time});
 assert.equal(store.show(quote,subject),true);
 assert.equal(store.current().amountGs,15500);
 time=500000;
 assert.equal(store.current(),null);
});
test('reemplazar por quote inválida elimina precio anterior',()=>{
 const store=createQuoteViewStore({now:()=>400000});
 store.show(quote,subject);store.show({...quote,amountGs:0},subject);
 assert.equal(store.current(),null);
});
