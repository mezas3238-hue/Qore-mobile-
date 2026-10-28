import test from 'node:test';
import assert from 'node:assert/strict';
import {readStagingCourierOffers,COURIER_POLL_LIVE_ENABLED}
 from './staging-courier-poll.ts';

const offer='11111111-1111-4111-8111-111111111111';
const delivery='22222222-2222-4222-8222-222222222222';
const token='synthetic_qa_access_token_never_live';
const now=Date.parse('2026-10-22T12:00:00Z');
const baseUrl='http://127.0.0.1:4141';
const data={mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
 offers:[{offerId:offer,deliveryId:delivery,expiresAtMs:now+30000}],
 deviceReceived:false,pushDelivered:false,suggestedPollIntervalMs:5000};
function fake(response:unknown=data,status=200){
 const seen:{url?:string,init?:RequestInit}={};
 const request=async(url:string,init:RequestInit)=>{
  seen.url=url;seen.init=init;return {status,json:async()=>response};
 };
 return {request,seen};
}
const read=(overrides:Record<string,unknown>={})=>
 readStagingCourierOffers({baseUrl,accessToken:token,now:()=>now,
  request:fake().request,...overrides});

test('G15 Expo only makes one local read, with bearer and no ambient credentials',async()=>{
 assert.equal(COURIER_POLL_LIVE_ENABLED,false);
 const f=fake();
 const offers=await read({request:f.request});
 assert.deepEqual(offers,[{offerId:offer,deliveryId:delivery,expiresAtMs:now+30000}]);
 assert.equal(Object.isFrozen(offers),true);
 assert.equal(f.seen.url,baseUrl+'/v1/staging/courier/delivery-offers');
 assert.equal(f.seen.init?.method,'GET');
 assert.equal(f.seen.init?.cache,'no-store');
 assert.equal(f.seen.init?.credentials,'omit');
 assert.equal((f.seen.init?.headers as Record<string,string>).authorization,'Bearer '+token);
});
test('G15 Expo refuses remote hosts, unsafe paths and missing access token before fetching',async()=>{
 let calls=0;
 const request=async()=>{calls++;throw Error('must not call')};
 for(const invalid of ['https://staging.example','http://0.0.0.0:4141',
  'http://127.0.0.1:4141/admin','http://127.0.0.1:4141/?token=x',
  'http://user:pass@127.0.0.1:4141','http://localhost:4141']){
  await assert.rejects(()=>read({baseUrl:invalid,request}));
 }
 await assert.rejects(()=>read({accessToken:'',request}));
 await assert.rejects(()=>read({accessToken:'bad',request}));
 assert.equal(calls,0);
});
test('G15 Expo fails closed for invalid, expired or PII-bearing snapshots',async()=>{
 for(const result of [
  {...data,liveDeliveriesEnabled:true},
  {...data,pushDelivered:true},
  {...data,deviceReceived:true},
  {...data,offers:[{...data.offers[0],senderPhone:'123'}]},
  {...data,offers:[{...data.offers[0],expiresAtMs:now+2500}]},
  {...data,offers:[{...data.offers[0],expiresAtMs:now+46000}]},
  {...data,offers:Array(6).fill(data.offers[0])},
  {...data,offers:[data.offers[0],data.offers[0]]},
  {...data,offers:[{...data.offers[0],offerId:'invalid'}]},
  {mode:'LIVE',offers:[]}
 ]){
  await assert.rejects(()=>read({request:fake(result).request}));
 }
});
test('G15 Expo treats offline/errors/unauthorized as unavailable without inventing offers',async()=>{
 await assert.rejects(()=>read({request:fake(data,401).request}));
 await assert.rejects(()=>read({request:fake(data,503).request}));
 await assert.rejects(()=>read({request:async()=>{throw Error('offline')}}));
 await assert.rejects(()=>read({request:fake(null).request}));
 const empty=await read({request:fake({...data,offers:[]}).request});
 assert.deepEqual(empty,[]);
});
