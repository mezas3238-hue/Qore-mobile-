import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyFreshDeliveryAccept as verify}
 from './driver-delivery-accept-preflight.mjs';
const uuid=n=>'c0000000-0000-4000-8000-'+String(n).padStart(12,'0');
const t=Date.parse('2026-10-26T21:00:00Z');
const offer={kind:'DELIVERY',offerId:uuid(1),serviceId:uuid(2),
 expiresAtMs:t+30000};
const preview=()=>({offerId:uuid(1),deliveryId:uuid(2),vehicleKind:'MOTO',
 category:'PARCEL',grams:1200,dimensionsCm:{length:25,width:12,height:8},
 expiresAtMs:offer.expiresAtMs,qaOnly:true,productionEnabled:false});
const actor={userId:uuid(3),role:'driver',
 accessToken:'driver-verified-access-token-01234567'};
const ws=()=>({phase:'connected',currentLicenseApproved:true,offers:[offer]});
const base=o=>verify({offer,preview:preview(),getSession:async()=>actor,
 readDetail:async()=>preview(),getWorkspace:ws,now:()=>t,...o});
test('C accepts only unchanged Driver, delivery ID, vehicle and package',async()=>{
 let reads=0;
 const good=await base({readDetail:async({offerId,accessToken})=>{
  reads++;assert.equal(offerId,uuid(1));assert.equal(accessToken,actor.accessToken);
  return preview();
 }});
 assert.equal(good.ok,true);assert.equal(reads,1);
 assert(!JSON.stringify(good).includes(actor.accessToken));
});
test('C blocks parcel weight, vehicle, dimensions, deliveryId and TTL mutation',async()=>{
 for(const changed of [
  {...preview(),grams:999}, {...preview(),vehicleKind:'AUTO'},
  {...preview(),dimensionsCm:{length:30,width:12,height:8}},
  {...preview(),deliveryId:uuid(88)},
  {...preview(),expiresAtMs:offer.expiresAtMs+5000}
 ]){
  const answer=await base({readDetail:async()=>changed});
  assert.equal(answer.ok,false);
 }
});
test('C rejects missing preview and absent private detail reader',async()=>{
 assert.equal((await base({preview:null})).code,'DELIVERY_DETAIL_REQUIRED');
 assert.equal((await base({readDetail:null})).code,'DELIVERY_DETAIL_REQUIRED');
});
test('C private session changed during read cannot send acceptance',async()=>{
 let identity=actor;
 const answer=await base({getSession:async()=>identity,
  readDetail:async()=>{identity={...actor,role:'passenger'};return preview();}});
 assert.equal(answer.code,'DRIVER_SESSION_CHANGED');
});
test('C no acceptance after inbox disappearance, KYC revocation or expiry',async()=>{
 for(const value of [
  {phase:'offline',currentLicenseApproved:true,offers:[offer]},
  {phase:'connected',currentLicenseApproved:false,offers:[offer]},
  {phase:'connected',currentLicenseApproved:true,offers:[]}
 ])assert.equal((await base({getWorkspace:()=>value})).ok,false);
 assert.equal((await base({now:()=>offer.expiresAtMs-2000})).ok,false);
});
test('C fail closed on offline HTTP without POST',async()=>{
 const x=await base({readDetail:async()=>{throw Error('offline');}});
 assert.equal(x.code,'DELIVERY_FRESH_READ_UNAVAILABLE');
});
