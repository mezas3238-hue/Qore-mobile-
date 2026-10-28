import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidCursor,readContinuation,createPageNavigator} from './page-cursor.mjs';
test('acepta sólo cursores opacos URL-safe, no PII, rutas ni query injection',()=>{
 for(const cursor of ['?x=1','a/b','abc def','token@example.org','x'.repeat(257),'','a+b']){
  assert.equal(isValidCursor(cursor),false,cursor);
 }
 assert.equal(isValidCursor('cGFnZT0yXzE'),true);
 assert.deepEqual(readContinuation({}),{ok:true,nextCursor:null});
 assert.deepEqual(readContinuation({nextCursor:null}),{ok:true,nextCursor:null});
 assert.equal(readContinuation({nextCursor:'a/b'}).ok,false);
});
test('sin límite de páginas, navegación y retorno sin acumular registros',()=>{
 const n=createPageNavigator();
 let requested=n.request('kyc','reset');
 assert.equal(n.commit('kyc',requested.direction,requested.cursor,'cursor_1'),true);
 for(let i=1;i<=250;i++){
  requested=n.request('kyc','next');
  assert.equal(requested.ok,true);
  assert.equal(n.commit('kyc','next',requested.cursor,i===250?null:'cursor_'+(i+1)),true);
 }
 assert.equal(n.get('kyc').pageNumber,251);
 assert.equal(n.get('kyc').hasNext,false);
 assert.equal(n.get('kyc').hasPrevious,true);
 assert.equal(n.request('kyc','next').code,'NO_ADDITIONAL_PAGE');
 requested=n.request('kyc','previous');
 assert.equal(n.commit('kyc','previous',requested.cursor,'cursor_251'),true);
 assert.equal(n.get('kyc').pageNumber,250);
});
test('no acepta next repetido ni cursor circular que podría ciclar red',()=>{
 const n=createPageNavigator();
 assert.equal(n.commit('audit','reset',null,'q1'),true);
 const next=n.request('audit','next');
 assert.equal(n.commit('audit','next',next.cursor,'q1'),false);
 assert.equal(n.commit('audit','next','bad','q2'),false);
 assert.equal(n.commit('audit','next',next.cursor,'q2'),true);
 assert.equal(n.commit('audit','next','q2','q1'),false);
});
test('las bandejas y las sesiones pueden invalidarse por separado',()=>{
 const n=createPageNavigator();
 n.commit('zones','reset',null,'z1');
 n.commit('incidents','reset',null,'i1');
 n.clear('zones');
 assert.equal(n.get('zones').hasNext,false);
 assert.equal(n.get('incidents').hasNext,true);
 n.clear();
 assert.equal(n.get('incidents').hasNext,false);
});
