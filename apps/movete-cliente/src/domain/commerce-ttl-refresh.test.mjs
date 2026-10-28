import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceExpiryRefreshDelay,isCommercePageFresh} from './commerce-ttl-refresh.mjs';
const T=1800000000000;
test('R47 un snapshot previo al vencimiento solo puede ser visible mientras es vigente',()=>{
 assert.equal(isCommercePageFresh(T+5000,T),true);
 assert.equal(isCommercePageFresh(T,T),false);
 assert.equal(isCommercePageFresh(T-1,T),false);
});
test('R47 vencimiento exacto obliga a ocultar catálogo sin esperar interacción',()=>{
 assert.equal(commerceExpiryRefreshDelay(T+5000,T),5001);
 assert.equal(commerceExpiryRefreshDelay(T+1,T),2);
 assert.equal(commerceExpiryRefreshDelay(T,T),0);
 assert.equal(commerceExpiryRefreshDelay(T-1,T),0);
});
test('R47 valores sin TTL/ilegales no dan acceso ni generan temporizadores',()=>{
 for(const val of [null,undefined,NaN,Infinity,'1800000000001',-1,0,1.1]){
  assert.equal(commerceExpiryRefreshDelay(val,T),null);
  assert.equal(isCommercePageFresh(val,T),false);
 }
 assert.equal(commerceExpiryRefreshDelay(T+1,NaN),null);
 assert.equal(isCommercePageFresh(T+1,NaN),false);
});
test('R47 corrige límite de temporizador JS sin desbordamiento',()=>{
 assert.equal(commerceExpiryRefreshDelay(T+3000000000,T),2147483647);
 assert.equal(isCommercePageFresh(T+3000000000,T),true);
});
test('R47 nunca inventa una prórroga de caducidad',()=>{
 const expiry=T+10000;
 assert.equal(isCommercePageFresh(expiry,T+9999),true);
 assert.equal(isCommercePageFresh(expiry,T+10000),false);
 assert.equal(isCommercePageFresh(expiry,T+50000),false);
});
