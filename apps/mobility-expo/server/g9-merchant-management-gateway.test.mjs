import test from 'node:test';import assert from 'node:assert/strict';
import {createQoreMerchantManagementGateway} from './g9-merchant-management-gateway.mjs';
const ref='staging1234567890abcd',owner='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
const key='33333333-3333-4333-8333-333333333333',merchant='44444444-4444-4444-8444-444444444444';
const branch='55555555-5555-4555-8555-555555555555',item='66666666-6666-4666-8666-666666666666',eventId='77777777-7777-4777-8777-777777777777';
const bearer=id=>'synthetic_merchant_'+id.replaceAll('-','')+'_bearer',headers=id=>({authorization:'Bearer '+bearer(id)});
function fixture(){const calls=[];const gateway=createQoreMerchantManagementGateway({projectRef:ref,
 verifyAccessToken:async token=>{const id=[owner,admin].find(x=>bearer(x)===token);if(!id)throw Error('bad');return {id,is_anonymous:false,email_confirmed_at:'2026-10-22T12:00:00Z'};},
 authorizeAdmin:async id=>id===admin,allowRequest:()=>true,
 onboardMerchant:async input=>{calls.push(input);return {ok:true,liveEnabled:false,merchantId:merchant};},
 reviewMerchant:async input=>{calls.push(input);return {ok:true,liveEnabled:false,eventId};},
 upsertBranch:async input=>{calls.push(input);return {ok:true,liveEnabled:false,branchId:branch};},
 upsertItem:async input=>{calls.push(input);return {ok:true,liveEnabled:false,itemId:item};}});return {gateway,calls};}
test('owner submits strict pending onboarding without approval fields',async()=>{const f=fixture(),body={requestKey:key,kind:'SUPERMARKET',displayTag:'MARKET_A'};
 const out=await f.gateway({method:'POST',path:'/v1/staging/merchant/onboarding/request',headers:headers(owner),body});
 assert.equal(out.status,202);assert.equal(out.body.commercialOrdersEnabled,false);assert.equal(f.calls[0].actorId,owner);
 for(const forged of [{...body,ownerId:owner},{...body,status:'approved'}])assert.equal((await f.gateway({method:'POST',path:'/v1/staging/merchant/onboarding/request',headers:headers(owner),body:forged})).status,400);});
test('review is admin-only and actor is never accepted from body',async()=>{const f=fixture(),path=`/v1/staging/admin/merchants/${merchant}/review`,body={event:'approve',requestKey:key};
 assert.equal((await f.gateway({method:'POST',path,headers:headers(owner),body})).status,403);
 assert.equal((await f.gateway({method:'POST',path,headers:headers(admin),body})).status,200);
 assert.equal(f.calls[0].actorId,admin);assert.equal(f.calls[0].merchantId,merchant);});
test('owner manages branch and catalog through strict integer contracts',async()=>{const f=fixture();
 const b={merchantId:merchant,requestKey:key,branchTag:'CENTRO',pickupTag:'MARKET_CENTRO',preparationMinutes:15,active:true,acceptingOrders:true};
 assert.equal((await f.gateway({method:'POST',path:'/v1/staging/merchant/branches/upsert',headers:headers(owner),body:b})).status,200);
 const i={branchId:branch,requestKey:key,sku:'RICE_1',itemTag:'RICE_BAG',itemClass:'GENERAL',unitPricePyg:12000,unitGrams:1000,stockUnits:50,active:true};
 assert.equal((await f.gateway({method:'POST',path:'/v1/staging/merchant/catalog/upsert',headers:headers(owner),body:i})).status,200);
 assert.equal((await f.gateway({method:'POST',path:'/v1/staging/merchant/catalog/upsert',headers:headers(owner),body:{...i,unitPricePyg:12.5}})).status,400);});
test('Auth, limits and live receipts fail closed',async()=>{const f=fixture(),body={requestKey:key,kind:'RETAIL',displayTag:'STORE_A'};
 assert.equal((await f.gateway({method:'POST',path:'/v1/staging/merchant/onboarding/request',headers:{},body})).status,401);
 const common={projectRef:ref,verifyAccessToken:async()=>({id:owner,is_anonymous:false,email_confirmed_at:'2026-10-22T12:00:00Z'}),authorizeAdmin:async()=>false,onboardMerchant:async()=>({ok:true,liveEnabled:true,merchantId:merchant}),reviewMerchant:async()=>{},upsertBranch:async()=>{},upsertItem:async()=>{}};
 const limited=createQoreMerchantManagementGateway({...common,allowRequest:()=>false});assert.equal((await limited({method:'POST',path:'/v1/staging/merchant/onboarding/request',headers:headers(owner),body})).status,429);
 const broken=createQoreMerchantManagementGateway({...common,allowRequest:()=>true});assert.equal((await broken({method:'POST',path:'/v1/staging/merchant/onboarding/request',headers:headers(owner),body})).status,409);});
