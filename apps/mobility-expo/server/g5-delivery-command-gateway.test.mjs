import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreDeliveryCommandGateway} from './g5-delivery-command-gateway.mjs';

const ref='staging1234567890abcd';
const sender='11111111-1111-4111-8111-111111111111';
const courier='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';
const delivery='44444444-4444-4444-8444-444444444444';
const vehicle='55555555-5555-4555-8555-555555555555';
const key='66666666-6666-4666-8666-666666666666';
const proof='77777777-7777-4777-8777-777777777777';
const bearer=id=>'synthetic_bearer_'+id.replaceAll('-','')+'_token';
const headers=id=>({authorization:'Bearer '+bearer(id)});
const request={requestKey:key,vehicleKind:'MOTO',category:'DOCUMENTS',grams:1200,
 lengthCm:30,widthCm:20,heightCm:10,pickupTag:'OFFICE_NORTH',
 deliveryTag:'OFFICE_SOUTH',restrictedItemDeclared:false};

function fixture(){
 const calls=[];
 const gateway=createQoreDeliveryCommandGateway({
  projectRef:ref,
  verifyAccessToken:async token=>{
   const id=[sender,courier,outsider].find(value=>bearer(value)===token);
   if(!id)throw Error('unauthorized');
   return {id,is_anonymous:false,email_confirmed_at:'2026-10-22T12:00:00Z'};
  },
  resolveRole:async id=>id===sender?'passenger':id===courier?'driver':null,
  allowRequest:()=>true,
  requestDelivery:async input=>{calls.push({operation:'request',input});
   return {ok:true,liveEnabled:false,deliveryId:delivery};},
  acceptDelivery:async input=>{calls.push({operation:'accept',input});
   return {ok:true,liveEnabled:false,eventId:key};},
  transitionDelivery:async input=>{calls.push({operation:'transition',input});
   return {ok:true,liveEnabled:false,eventId:key};},
  loadDelivery:async input=>{calls.push({operation:'status',input});
   return {ok:true,liveEnabled:false,delivery:{id:delivery,status:'accepted'}};},
 });
 return {gateway,calls};
}

test('sender creates a persisted delivery without client identity fields',async()=>{
 const f=fixture();
 const result=await f.gateway({method:'POST',path:'/v1/staging/sender/deliveries/request',
  headers:headers(sender),body:request});
 assert.equal(result.status,201);
 assert.equal(result.body.deliveryId,delivery);
 assert.equal(result.body.liveDeliveriesEnabled,false);
 assert.equal(f.calls[0].input.actorId,sender);
 for(const forged of [{...request,senderId:sender},{...request,courierId:courier},
  {...request,liveEnabled:true},{...request,restrictedItemDeclared:true}])
  assert.equal((await f.gateway({method:'POST',path:'/v1/staging/sender/deliveries/request',
   headers:headers(sender),body:forged})).status,400);
 assert.equal(f.calls.length,1);
});

test('courier accepts, custody events are role-separated and delivery needs proof',async()=>{
 const f=fixture();
 const acceptPath=`/v1/staging/courier/deliveries/${delivery}/accept`;
 const transitionPath=`/v1/staging/deliveries/${delivery}/transition`;
 assert.equal((await f.gateway({method:'POST',path:acceptPath,headers:headers(courier),
  body:{vehicleId:vehicle,requestKey:key}})).status,200);
 assert.equal((await f.gateway({method:'POST',path:transitionPath,headers:headers(courier),
  body:{event:'pickup',eventKey:key}})).status,200);
 assert.equal((await f.gateway({method:'POST',path:transitionPath,headers:headers(courier),
  body:{event:'deliver',eventKey:key}})).status,400);
 assert.equal((await f.gateway({method:'POST',path:transitionPath,headers:headers(courier),
  body:{event:'deliver',eventKey:key,proofRef:proof}})).status,200);
 assert.equal((await f.gateway({method:'POST',path:transitionPath,headers:headers(sender),
  body:{event:'dispute',eventKey:key}})).status,200);
 assert.equal((await f.gateway({method:'POST',path:transitionPath,headers:headers(sender),
  body:{event:'return',eventKey:key}})).status,403);
 assert.equal((await f.gateway({method:'POST',path:acceptPath,headers:headers(sender),
  body:{vehicleId:vehicle,requestKey:key}})).status,403);
});

test('only authenticated participants reach persistent status lookup',async()=>{
 const f=fixture(),path=`/v1/staging/deliveries/${delivery}/status`;
 assert.equal((await f.gateway({method:'GET',path,headers:headers(sender)})).status,200);
 assert.equal((await f.gateway({method:'GET',path,headers:headers(courier)})).status,200);
 assert.equal((await f.gateway({method:'GET',path,headers:headers(outsider)})).status,403);
 assert.equal((await f.gateway({method:'GET',path,headers:{}})).status,401);
 assert.equal(f.calls.filter(call=>call.operation==='status').length,2);
});

test('limiter and persistence failures remain closed without live success',async()=>{
 const base={projectRef:ref,verifyAccessToken:async()=>({id:sender,is_anonymous:false,
  email_confirmed_at:'2026-10-22T12:00:00Z'}),resolveRole:async()=> 'passenger',
  requestDelivery:async()=>({ok:true,liveEnabled:false,deliveryId:delivery}),
  acceptDelivery:async()=>{},transitionDelivery:async()=>{},loadDelivery:async()=>{}};
 const limited=createQoreDeliveryCommandGateway({...base,allowRequest:()=>false});
 assert.equal((await limited({method:'POST',path:'/v1/staging/sender/deliveries/request',
  headers:headers(sender),body:request})).status,429);
 const broken=createQoreDeliveryCommandGateway({...base,allowRequest:()=>true,
  requestDelivery:async()=>({ok:true,liveEnabled:true,deliveryId:delivery})});
 assert.equal((await broken({method:'POST',path:'/v1/staging/sender/deliveries/request',
  headers:headers(sender),body:request})).status,409);
});
