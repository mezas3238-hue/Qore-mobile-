import test from 'node:test';
import assert from 'node:assert/strict';
import {DELIVERY_LIVE_ENABLED,nextSyntheticDeliveryState,checkSyntheticParcel} from './delivery-staging.mjs';
test('delivery cannot be live',()=>assert.equal(DELIVERY_LIVE_ENABLED,false));
test('synthetic delivery lifecycle',()=>{assert.equal(nextSyntheticDeliveryState('requested','accept').state,'accepted');assert.equal(nextSyntheticDeliveryState('accepted','pickup').state,'picked_up');assert.equal(nextSyntheticDeliveryState('picked_up','deliver').state,'delivered');assert.equal(nextSyntheticDeliveryState('delivered','accept').ok,false);assert.equal(nextSyntheticDeliveryState('requested','deliver').ok,false);});
test('moto and auto capacity limits',()=>{const p={vehicle:'MOTO',grams:1500,lengthCm:20,widthCm:20,heightCm:20};assert.equal(checkSyntheticParcel(p).ok,true);assert.equal(checkSyntheticParcel({...p,grams:11000}).ok,false);assert.equal(checkSyntheticParcel({...p,lengthCm:80}).ok,false);assert.equal(checkSyntheticParcel({...p,vehicle:'AUTO',grams:11000}).ok,true);assert.equal(checkSyntheticParcel({...p,grams:NaN}).ok,false);});
