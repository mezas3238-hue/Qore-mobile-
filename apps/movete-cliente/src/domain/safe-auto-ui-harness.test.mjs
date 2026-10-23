import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
import {createSafeAutoUiHarness} from './safe-auto-ui-harness.mjs';

const subject='123e4567-e89b-42d3-a456-426614174000';
const requestKey='123e4567-e89b-42d3-a456-426614174001';
const now=1800000000000;
const session=(token='synthetic-passenger-token-initial')=>({subject,role:'passenger',
 expiresAt:now+120000,token});
function setup(initial=session()){
 let auth=initial,calls=0,keys=0;
 const client=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>auth,signOut:async()=>{}},
  gateway:{send:async()=>{calls++;return {ok:true,status:201};}}});
 const ui=createSafeAutoUiHarness({client,requestKeyFactory:()=>{keys++;return requestKey;}});
 return {client,ui,setSession:value=>auth=value,calls:()=>calls,keys:()=>keys};
}

test('UI AUTO sin Auth revisa localmente pero no prepara ni llama red',()=>{
 const f=setup(null);
 assert.equal(f.ui.setRoute('Centro San Lorenzo','Villa Morra Asunción').ok,true);
 assert.equal(f.ui.review().ok,true);
 assert.equal(f.ui.prepare().code,'AUTH_REQUIRED');
 const surface=f.ui.surface();
 assert.equal(surface.stage,'REVIEWED_LOCAL');
 assert.equal(surface.canPrepare,false);
 assert.equal(surface.canQuote,false);
 assert.equal(surface.canSearchDriver,false);
 assert.equal(f.calls(),0);assert.equal(f.keys(),0);
});

test('journey AUTO prepara y descarta borrador sin precio, GPS ni dispatch',async()=>{
 const f=setup();await f.client.refreshSession();
 assert.equal(f.ui.setRoute('Centro San Lorenzo','Villa Morra Asunción').ok,true);
 assert.equal(f.ui.setService('confort').ok,true);
 assert.equal(f.ui.review().ok,true);
 assert.equal(f.ui.surface().stage,'REVIEWED_LOCAL');
 assert.equal(f.ui.prepare().ok,true);
 const prepared=f.ui.surface();
 assert.equal(prepared.stage,'PREPARED_NOT_SENT');
 assert.equal(prepared.canEdit,false);assert.equal(prepared.canDiscard,true);
 assert.equal(prepared.serverRequestSent,false);
 assert.equal(prepared.serverQuote,null);assert.equal(prepared.assignedDriver,null);
 assert.equal(prepared.gps,null);assert.equal(f.calls(),0);assert.equal(f.keys(),1);
 assert.equal(f.ui.continueToQuoteAndDriver().code,
  'PREQUOTE_AND_DISPATCH_CONTRACT_PENDING');
 assert.equal(f.ui.discard().ok,true);
 assert.equal(f.ui.surface().stage,'EDITING');
 assert.equal(f.calls(),0);assert.equal(f.keys(),1);
});

test('ruta inválida no genera requestKey ni muestra avance ficticio',async()=>{
 const f=setup();await f.client.refreshSession();
 f.ui.setRoute('Centro',' centro ');
 assert.equal(f.ui.review().code,'INVALID_ROUTE');
 assert.equal(f.ui.prepare().code,'REVIEW_REQUIRED');
 assert.equal(f.ui.surface().stage,'EDITING');
 assert.equal(f.keys(),0);assert.equal(f.calls(),0);
});

test('rotación JWT desmonta la ruta y el borrador del harness visible',async()=>{
 const f=setup();await f.client.refreshSession();
 f.ui.setRoute('Centro San Lorenzo','Villa Morra Asunción');
 f.ui.review();assert.equal(f.ui.prepare().ok,true);
 f.setSession(session('synthetic-passenger-token-rotated'));
 await f.client.refreshSession();
 const surface=f.ui.surface();
 assert.equal(surface.stage,'EDITING');assert.equal(surface.route,null);
 assert.equal(surface.feedback,'');assert.equal(surface.canDiscard,false);
 assert.equal(f.calls(),0);
});

