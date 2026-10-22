import test from 'node:test';import assert from 'node:assert/strict';
import {createSupabaseStagingMerchantManagementRepository,
 SUPABASE_MERCHANT_MANAGEMENT_LIVE_ENABLED} from './g9-supabase-merchant-management-repository.mjs';
const actor='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
const key='33333333-3333-4333-8333-333333333333',merchant='44444444-4444-4444-8444-444444444444';
const branch='55555555-5555-4555-8555-555555555555',item='66666666-6666-4666-8666-666666666666';
const event='77777777-7777-4777-8777-777777777777';
const base=id=>({mode:'SYNTHETIC_STAGING',liveEnabled:false,actorId:id});
function fixture(){const calls=[];return {calls,client:{async rpc(name,params){calls.push({name,params});
 return {data:name.includes('onboarding')?merchant:name.includes('branch')?branch:
  name.includes('catalog')?item:event,error:null};}}};}
test('management repository is server-only and non-live',()=>{assert.equal(SUPABASE_MERCHANT_MANAGEMENT_LIVE_ENABLED,false);
 assert.throws(()=>createSupabaseStagingMerchantManagementRepository({}),/server-only/i);});
test('onboarding and review derive owner/admin from server actor',async()=>{const f=fixture(),r=createSupabaseStagingMerchantManagementRepository(f.client);
 await r.onboarding({...base(actor),requestKey:key,kind:'SUPERMARKET',displayTag:'MARKET_A'});
 await r.review({...base(admin),merchantId:merchant,event:'approve',requestKey:key});
 assert.equal(f.calls[0].params._owner_id,actor);assert.equal(f.calls[1].params._admin_id,admin);});
test('branch and item upserts map bounded structured fields only',async()=>{const f=fixture(),r=createSupabaseStagingMerchantManagementRepository(f.client);
 await r.upsertBranch({...base(actor),merchantId:merchant,requestKey:key,branchTag:'CENTRO',pickupTag:'MARKET_CENTRO',preparationMinutes:15,active:true,acceptingOrders:true});
 await r.upsertItem({...base(actor),branchId:branch,requestKey:key,sku:'RICE_1',itemTag:'RICE_BAG',itemClass:'GENERAL',unitPricePyg:12000,unitGrams:1000,stockUnits:50,active:true});
 assert.equal(f.calls[0].params._actor_id,actor);assert.equal(f.calls[1].params._unit_price_pyg,12000);
 await assert.rejects(r.upsertItem({...base(actor),branchId:branch,requestKey:key,sku:'RX',itemTag:'RX',itemClass:'PRESCRIPTION',unitPricePyg:1,unitGrams:1,stockUnits:1,active:true}),/invalid/i);});
test('live, malformed tag and excess numeric ranges fail before RPC',async()=>{const f=fixture(),r=createSupabaseStagingMerchantManagementRepository(f.client);
 await assert.rejects(r.onboarding({...base(actor),liveEnabled:true,requestKey:key,kind:'RETAIL',displayTag:'STORE'}),/invalid/i);
 await assert.rejects(r.upsertBranch({...base(actor),merchantId:merchant,requestKey:key,branchTag:'bad',pickupTag:'TAG',preparationMinutes:181,active:true,acceptingOrders:true}),/invalid/i);
 assert.equal(f.calls.length,0);});
