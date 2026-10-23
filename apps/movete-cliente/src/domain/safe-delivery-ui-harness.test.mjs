import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
import {createSafeDeliveryUiHarness} from './safe-delivery-ui-harness.mjs';

const subject='123e4567-e89b-42d3-a456-426614174010';
const requestKey='123e4567-e89b-42d3-a456-426614174011';
const now=1800000000000;
const session=(token='synthetic-delivery-passenger-token')=>({subject,role:'passenger',
 expiresAt:now+120000,token});
const valid={pickup:'Centro San Lorenzo',destination:'Villa Morra Asunción',
 vehicleKind:'MOTO',category:'PARCEL',weight:'5000',length:'30',width:'20',
 height:'15',restricted:false};
function setup(initial=session()){
 let auth=initial,calls=0,keys=0;
 const client=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>auth,signOut:async()=>{}},
  gateway:{send:async()=>{calls++;return {ok:true,status:201};}}});
 const ui=createSafeDeliveryUiHarness({client,requestKeyFactory:()=>{keys++;return requestKey;}});
 return {client,ui,setSession:value=>auth=value,calls:()=>calls,keys:()=>keys};
}

test('envío MOTO válido se prepara y descarta sin repartidor ni destinatario',async()=>{
 const f=setup();await f.client.refreshSession();
 assert.equal(f.ui.edit(valid).ok,true);assert.equal(f.ui.review().ok,true);
 assert.equal(f.ui.prepare().ok,true);
 const surface=f.ui.surface();
 assert.equal(surface.stage,'PREPARED_NOT_SENT');assert.equal(surface.recipient,null);
 assert.equal(surface.canRequestCourier,false);assert.equal(surface.courier,null);
 assert.equal(surface.deliveryId,null);assert.equal(surface.gps,null);
 assert.equal(surface.serverRequestSent,false);assert.equal(f.calls(),0);assert.equal(f.keys(),1);
 assert.equal(f.ui.discard().ok,true);assert.equal(f.ui.surface().stage,'EDITING');
});

test('peso MOTO, dimensiones y artículos restringidos fallan antes de UUID',async()=>{
 for(const patch of [{weight:'10001'},{length:'201'},{restricted:true},
  {weight:'1e3'},{weight:'5.5'}]){
  const f=setup();await f.client.refreshSession();f.ui.edit({...valid,...patch});
  assert.equal(f.ui.review().ok,false);
  assert.equal(f.ui.prepare().code,'REVIEW_REQUIRED');
  assert.equal(f.keys(),0);assert.equal(f.calls(),0);
 }
});

test('offline y contrato pendiente son estados explícitos con cero red',async()=>{
 const f=setup();await f.client.refreshSession();f.ui.edit({...valid,vehicleKind:'AUTO',weight:'50000'});
 assert.equal(f.ui.review().ok,true);assert.equal(f.ui.prepare().ok,true);
 assert.equal(f.ui.continueToServer({online:false}).code,'OFFLINE_NO_REQUEST_SENT');
 assert.equal(f.ui.continueToServer({online:true}).code,'DELIVERY_CONTRACT_PENDING');
 assert.equal(f.ui.surface().serverRequestSent,false);assert.equal(f.calls(),0);
});

test('rotación JWT elimina ruta de envío y borrador temporal visible',async()=>{
 const f=setup();await f.client.refreshSession();f.ui.edit(valid);f.ui.review();
 assert.equal(f.ui.prepare().ok,true);
 f.setSession(session('synthetic-delivery-passenger-rotated'));
 await f.client.refreshSession();
 const surface=f.ui.surface();
 assert.equal(surface.stage,'EDITING');assert.equal(surface.route,null);
 assert.equal(surface.recipient,null);assert.equal(surface.feedback,'');
 assert.equal(f.calls(),0);
});

