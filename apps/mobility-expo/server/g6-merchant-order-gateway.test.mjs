import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreMerchantOrderGateway} from './g6-merchant-order-gateway.mjs';

const ref='staging1234567890abcd';
const buyer='11111111-1111-4111-8111-111111111111';
const staff='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';
const order='44444444-4444-4444-8444-444444444444';
const branch='55555555-5555-4555-8555-555555555555';
const item='66666666-6666-4666-8666-666666666666';
const key='77777777-7777-4777-8777-777777777777';
const delivery='88888888-8888-4888-8888-888888888888';
const bearer=id=>'synthetic_bearer_'+id.replaceAll('-','')+'_token';
const headers=id=>({authorization:'Bearer '+bearer(id)});
const request={requestKey:key,branchId:branch,vehicleKind:'AUTO',
 items:[{itemId:item,quantity:2}]};
function fixture(){
 const calls=[];
 const gateway=createQoreMerchantOrderGateway({
  projectRef:ref,
  verifyAccessToken:async token=>{
   const id=[buyer,staff,outsider].find(value=>bearer(value)===token);
   if(!id)throw Error('unauthorized');
   return {id,is_anonymous:false,email_confirmed_at:'2026-10-22T12:00:00Z'};
  },
  authorizeBuyer:async id=>id===buyer,
  authorizeMerchantOrder:async({actorId,orderId})=>actorId===staff&&orderId===order,
  allowRequest:()=>true,
  requestOrder:async input=>{calls.push({operation:'request',input});
   return {ok:true,liveEnabled:false,orderId:order};},
  transitionOrder:async input=>{calls.push({operation:'transition',input});
   return {ok:true,liveEnabled:false,eventId:key};},
  attachDelivery:async input=>{calls.push({operation:'attach',input});
   return {ok:true,liveEnabled:false,eventId:key};},
  loadOrder:async input=>{calls.push({operation:'status',input});
   if(input.actorId===outsider)throw Error('denied');
   return {ok:true,liveEnabled:false,order:{id:order,status:'ready'}};},
 });
 return {gateway,calls};
}

test('buyer creates strict basket without sending price or identity',async()=>{
 const f=fixture();
 const out=await f.gateway({method:'POST',path:'/v1/staging/buyer/orders/request',
  headers:headers(buyer),body:request});
 assert.equal(out.status,201);
 assert.equal(out.body.orderId,order);
 assert.equal(out.body.liveCommerceEnabled,false);
 assert.equal(f.calls[0].input.actorId,buyer);
 for(const forged of [{...request,buyerId:buyer},{...request,subtotalPyg:1},
  {...request,items:[{itemId:item,quantity:2,unitPricePyg:1}]}])
  assert.equal((await f.gateway({method:'POST',path:'/v1/staging/buyer/orders/request',
   headers:headers(buyer),body:forged})).status,400);
});

test('merchant and buyer transitions are route- and actor-separated',async()=>{
 const f=fixture();
 const merchantPath=`/v1/staging/merchant/orders/${order}/transition`;
 const buyerPath=`/v1/staging/buyer/orders/${order}/transition`;
 assert.equal((await f.gateway({method:'POST',path:merchantPath,headers:headers(staff),
  body:{event:'confirm',eventKey:key}})).status,200);
 assert.equal((await f.gateway({method:'POST',path:merchantPath,headers:headers(staff),
  body:{event:'cancel',eventKey:key}})).status,400);
 assert.equal((await f.gateway({method:'POST',path:buyerPath,headers:headers(buyer),
  body:{event:'cancel',eventKey:key}})).status,200);
 assert.equal((await f.gateway({method:'POST',path:buyerPath,headers:headers(staff),
  body:{event:'complete',eventKey:key}})).status,403);
 assert.equal((await f.gateway({method:'POST',path:merchantPath,headers:headers(outsider),
  body:{event:'ready',eventKey:key}})).status,403);
});

test('merchant attaches only opaque delivery reference and participants read status',async()=>{
 const f=fixture();
 const attach=`/v1/staging/merchant/orders/${order}/attach-delivery`;
 assert.equal((await f.gateway({method:'POST',path:attach,headers:headers(staff),
  body:{deliveryId:delivery,requestKey:key}})).status,200);
 assert.equal((await f.gateway({method:'POST',path:attach,headers:headers(staff),
  body:{deliveryId:delivery,requestKey:key,buyerId:buyer}})).status,400);
 const status=`/v1/staging/orders/${order}/status`;
 assert.equal((await f.gateway({method:'GET',path:status,headers:headers(buyer)})).status,200);
 assert.equal((await f.gateway({method:'GET',path:status,headers:headers(outsider)})).status,409);
});

test('invalid Auth, limits and live receipts fail closed',async()=>{
 const f=fixture();
 assert.equal((await f.gateway({method:'POST',path:'/v1/staging/buyer/orders/request',
  headers:{},body:request})).status,401);
 const base={projectRef:ref,verifyAccessToken:async()=>({id:buyer,is_anonymous:false,
  email_confirmed_at:'2026-10-22T12:00:00Z'}),authorizeBuyer:async()=>true,
  authorizeMerchantOrder:async()=>false,requestOrder:async()=>({ok:true,
   liveEnabled:true,orderId:order}),transitionOrder:async()=>{},attachDelivery:async()=>{},
  loadOrder:async()=>{}};
 const limited=createQoreMerchantOrderGateway({...base,allowRequest:()=>false});
 assert.equal((await limited({method:'POST',path:'/v1/staging/buyer/orders/request',
  headers:headers(buyer),body:request})).status,429);
 const broken=createQoreMerchantOrderGateway({...base,allowRequest:()=>true});
 assert.equal((await broken({method:'POST',path:'/v1/staging/buyer/orders/request',
  headers:headers(buyer),body:request})).status,409);
});
