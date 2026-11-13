import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientDestinationAutocompleteGate} from './client-destination-autocomplete.mjs';
test('G328 typeahead waits after typing, not per keypress',()=>{
 let t=10000;const gate=createClientDestinationAutocompleteGate({now:()=>t});
 for(const q of ['C','Ca','Cal'])assert.equal(gate.plan(q),null);
 assert.deepEqual(gate.plan('Calle'),{query:'Calle',delayMs:850});
 gate.markStarted('Calle');
 assert.equal(gate.plan('Calle'),null);
 assert.deepEqual(gate.plan('Calle Mar'),{query:'Calle Mar',delayMs:3250});
 t+=2500;
 assert.deepEqual(gate.plan('Calle Mar'),{query:'Calle Mar',delayMs:850});
});
test('G328 query changes allow one fresh request but no loop of repeated results',()=>{
 let t=20000;const gate=createClientDestinationAutocompleteGate({now:()=>t});
 assert.equal(gate.plan('  Hernandarias  ').query,'Hernandarias');
 assert.equal(gate.markStarted('Hernandarias'),true);
 t+=6000;
 assert.equal(gate.plan('Hernandarias'),null);
 assert.equal(gate.plan('Hernandarias Centro').query,'Hernandarias Centro');
 gate.markStarted('Hernandarias Centro');
 assert.equal(gate.plan('Hernandarias Centro'),null);
 gate.clear();
 assert.equal(gate.plan('Hernandarias Centro').delayMs,850);
});
test('G328 rejects invalid query or inactive screen',()=>{
 const gate=createClientDestinationAutocompleteGate();
 for(const q of [null,{},'', ' abc', 'X'.repeat(121),'Calle\nX'])
  assert.equal(gate.plan(q),null);
 assert.equal(gate.plan('Avda. San José',{enabled:false}),null);
 assert.throws(()=>createClientDestinationAutocompleteGate({debounceMs:0}),/INVALID_AUTOCOMPLETE/);
});
