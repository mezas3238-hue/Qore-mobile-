import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStagingMerchantRepository,SUPABASE_MERCHANT_LIVE_ENABLED}
 from './g6-supabase-merchant-repository.mjs';

const buyer='11111111-1111-4111-8111-111111111111';
const staff='22222222-2222-4222-8222-222222222222';
const order='33333333-3333-4333-8333-333333333333';
const merchant='44444444-4444-4444-8444-444444444444';
const branch='55555555-5555-4555-8555-555555555555';
const item='66666666-6666-4666-8666-666666666666';
const key='77777777-7777-4777-8777-777777777777';
const delivery='88888888-8888-4888-8888-888888888888';
const base=actorId=>({mode:'SYNTHETIC_STAGING',liveEnabled:false,actorId});
function fixture(){
 const state={calls:[],order:{id:order,buyer_id:buyer,merchant_id:merchant,
  branch_id:branch,requested_vehicle_kind:'AUTO',subtotal_pyg:30000,
  status:'ready',delivery_id:null,revision:4},
  lines:[{order_id:order,item_id:item,quantity:2,unit_price_pyg:15000,
   line_total_pyg:30000}]};
 const client={
  async rpc(name,params){state.calls.push({name,params});return {data:key,error:null};},
  from(table){
   const filter={};let columns='';
   const result=()=>{
    if(table==='mobility_stage_merchant_orders')
     return columns==='merchant_id'?{merchant_id:merchant}:{...state.order};
    if(table==='mobility_stage_merchant_staff')
     return filter.user_id===staff?{merchant_id:merchant,user_id:staff,active:true}:null;
    return null;
   };
   const chain={
    select(value){columns=value;return chain;},
    eq(k,v){filter[k]=v;return chain;},
    async maybeSingle(){return {data:result(),error:null};},
    then(resolve){
     return Promise.resolve(table==='mobility_stage_merchant_order_lines'?{
      data:state.lines.map(x=>({...x})),error:null}:{data:null,error:null}).then(resolve);
    },
   };
   return chain;
  },
 };
 return {client,state};
}

test('merchant repository is staging-only and validates server client',()=>{
 assert.equal(SUPABASE_MERCHANT_LIVE_ENABLED,false);
 assert.throws(()=>createSupabaseStagingMerchantRepository({}),/server-only/i);
});

test('buyer identity and catalog price stay server-side in order RPC',async()=>{
 const f=fixture(),repo=createSupabaseStagingMerchantRepository(f.client);
 const result=await repo.request({...base(buyer),requestKey:key,branchId:branch,
  vehicleKind:'AUTO',items:[{itemId:item,quantity:2}]});
 assert.deepEqual(result,{ok:true,liveEnabled:false,orderId:key});
 assert.deepEqual(f.state.calls[0],{name:'mobility_stage_merchant_order_request',params:{
  _buyer_id:buyer,_request_key:key,_branch_id:branch,_vehicle_kind:'AUTO',
  _items:[{itemId:item,quantity:2}],
 }});
 await assert.rejects(repo.request({...base(buyer),requestKey:key,branchId:branch,
  vehicleKind:'AUTO',items:[{itemId:item,quantity:2},{itemId:item,quantity:1}]}),/invalid/i);
});

test('merchant transition and delivery link derive actor from verified session',async()=>{
 const f=fixture(),repo=createSupabaseStagingMerchantRepository(f.client);
 await repo.transition({...base(staff),orderId:order,event:'ready',eventKey:key});
 await repo.attachDelivery({...base(staff),orderId:order,deliveryId:delivery,requestKey:key});
 assert.equal(f.state.calls[0].params._actor_id,staff);
 assert.equal(f.state.calls[1].params._actor_id,staff);
 assert.equal(f.state.calls[1].params._delivery_id,delivery);
});

test('snapshot validates participant, immutable line prices and subtotal',async()=>{
 const f=fixture(),repo=createSupabaseStagingMerchantRepository(f.client);
 assert.equal(await repo.isMerchantParticipant({...base(staff),orderId:order}),true);
 const result=await repo.snapshot({...base(buyer),orderId:order});
 assert.equal(result.order.subtotalPyg,30000);
 assert.equal(result.order.items[0].unitPricePyg,15000);
 f.state.lines[0].line_total_pyg=29999;
 await assert.rejects(repo.snapshot({...base(buyer),orderId:order}),/lines/);
});

