import test from 'node:test';
import assert from 'node:assert/strict';
import {readDriverCurrentTrip as read} from './driver-current-trip-http.mjs';
const trip='10600000-0000-4106-8106-000000000003';
const token='g106-verified-private-driver-token-0000000';
const origin='https://api-staging.movetefacil.example';
const valid={mode:'STAGING_DEMO_ONLY',liveTripsEnabled:false,
 qaOnly:true,productionEnabled:false,
 activeTrip:{tripId:trip,status:'in_progress',revision:5}};
const reply=(body=valid,status=200)=>({status,redirected:false,json:async()=>body});
const base={apiOrigin:origin,approvedStagingHost:'api-staging.movetefacil.example',
 allowedByOwner:true,accessToken:token};
test('G106 HTTPS Driver recovery is GET-only and never trusts local trip ID',async()=>{
 let seen;
 const result=await read({...base,request:async(u,options)=>{
  seen={u,options};return reply();}});
 assert.deepEqual(result,{tripId:trip,status:'in_progress',revision:5});
 assert.equal(seen.u,origin+'/v1/staging/driver/trips/current');
 assert.equal(seen.options.method,'GET');
 assert.equal(seen.options.redirect,'error');
 assert.equal(seen.options.credentials,'omit');
 assert.equal(seen.options.headers.authorization,'Bearer '+token);
 assert(!JSON.stringify(result).includes(token));
 assert.equal(await read({...base,request:async()=>reply({...valid,activeTrip:null})}),null);
});
test('G106 rejects forged user/Passenger/private GPS, terminal state and LIVE claim',async()=>{
 for(const body of [
  {...valid,activeTrip:{...valid.activeTrip,driverId:trip}},
  {...valid,activeTrip:{...valid.activeTrip,status:'completed'}},
  {...valid,activeTrip:{...valid.activeTrip,tripId:'not-a-uuid'}},
  {...valid,productionEnabled:true},
  {...valid,liveTripsEnabled:true},
  {...valid,passengerPhone:'private'}
 ])await assert.rejects(()=>read({...base,request:async()=>reply(body)}));
 for(const scope of [
  {...base,allowedByOwner:false},
  {...base,apiOrigin:'https://evil.example'},
  {...base,apiOrigin:'http://api-staging.movetefacil.example'},
  {...base,accessToken:'bad'}
 ])await assert.rejects(()=>read({...scope,request:async()=>reply()}));
 await assert.rejects(()=>read({...base,request:async()=>reply(valid,401)}));
});
