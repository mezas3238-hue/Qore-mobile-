import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
import {projectOwnDeliveryActivity} from './own-delivery-activity.mjs';

const T=1800000000000;
const uid=n=>'16000000-0000-4116-8116-'+String(n).padStart(12,'0');
const owner=uid(1),foreign=uid(2),auto=uid(31),moto=uid(32);
const token='b16-synthetic-passenger-jwt-very-long';
const host='https://sender-b16-staging.invalid';
const rows=()=>[
 {serviceId:auto,kind:'DELIVERY',status:'in_progress',revision:2,createdAt:T-3000},
 {serviceId:moto,kind:'DELIVERY',status:'in_progress',revision:2,createdAt:T-2000}
];
function history(who=owner){
 return {ownerId:who,generatedAt:T-100,expiresAt:T+5000,nextCursor:null,items:rows()};
}
function custody(id,vehicleKind,state,override={}){
 return {mode:'STAGING_DEMO_ONLY',deliveryId:id,ownerId:owner,
  state,revision:state==='delivered'?4:3,vehicleKind,
  assignmentPersisted:true,proofVerified:state==='delivered',
  qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false,...override};
}
const answer=(data,status=200)=>({ok:status===200,status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
function make({badCustody=null,historyStatus=200,custodyStatus=200}={}){
 let subject=owner,jwt=token,offline=false;const requests=[];
 const fetchImpl=async(url,config)=>{
  requests.push({url,method:config.method,credentials:config.credentials,
   authorization:config.headers.Authorization});
  if(offline)throw Error('offline');
  if(url===host+'/v1/staging/rider/history')
   return answer(history(),historyStatus);
  const match=/^https:\/\/sender-b16-staging\.invalid\/v1\/staging\/sender\/deliveries\/([0-9a-f-]{36})\/custody$/i.exec(url);
  if(!match)throw Error('Wrong/unsafe HTTP route');
  const id=match[1];
  if(![auto,moto].includes(id))return answer({error:'not found'},404);
  return answer(badCustody??(id===auto
   ?custody(auto,'AUTO','delivered')
   :custody(moto,'MOTO','picked_up')),custodyStatus);
 };
 const client=createClientExperience({
  now:()=>T,
  authProvider:{readSession:async()=>({role:'passenger',subject,
   token:jwt,expiresAt:T+60000}),signOut:async()=>{}},
  historyGatewayOptions:{enabled:true,contractCertified:true,
   origin:host,pinnedOrigin:host,fetchImpl},
  senderCustodyHttpOptions:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,g68SenderContractCertified:true,
   origin:host,pinnedOrigin:host,fetchImpl}
 });
 return {client,requests,rotate:x=>jwt=x,switchAccount:x=>subject=x,
  goOffline:()=>offline=true};
}
test('B#16: two delivery modes, same G26 own serviceId carried to G68 authenticated GET',async()=>{
 const t=make();
 assert.equal((await t.client.refreshSession()).ok,true);
 assert.equal((await t.client.loadHistoryPage({reset:true})).ok,true);
 const initial=projectOwnDeliveryActivity(t.client.snapshot());
 assert.equal(initial.rows.length,2);
 assert.equal(initial.rows.every(x=>x.vehicleKind===null&&x.canVerify),true);
 assert.equal((await t.client.readOwnDeliveryCustody(auto)).ok,true);
 const car=projectOwnDeliveryActivity(t.client.snapshot());
 assert.equal(car.selected.deliveryId,auto);
 assert.equal(car.selected.vehicleKind,'AUTO');
 assert.equal(car.selected.proofVerified,true);
 assert.equal(car.selected.complete,true);
 assert.equal((await t.client.readOwnDeliveryCustody(moto)).ok,true);
 const bike=projectOwnDeliveryActivity(t.client.snapshot());
 assert.equal(bike.selected.deliveryId,moto);
 assert.equal(bike.selected.vehicleKind,'MOTO');
 assert.equal(bike.selected.state,'picked_up');
 assert.equal(bike.selected.complete,false);
 assert.equal(bike.selected.gpsVerified,false);
 assert.equal(bike.selected.paymentConfirmed,false);
 assert.equal(t.requests.length,3);
 assert(t.requests.every(x=>x.method==='GET'&&x.credentials==='omit'));
 assert(t.requests.every(x=>x.authorization==='Bearer '+token));
 assert(t.requests.some(x=>x.url.endsWith('/deliveries/'+auto+'/custody')));
 assert(t.requests.some(x=>x.url.endsWith('/deliveries/'+moto+'/custody')));
 assert(!JSON.stringify(t.client.snapshot()).includes(token));
});
test('B#16: changed account and rotated JWT void custody and history',async()=>{
 const t=make();
 await t.client.refreshSession();
 await t.client.loadHistoryPage({reset:true});
 await t.client.readOwnDeliveryCustody(auto);
 t.rotate('b16-second-synthetic-jwt-very-long');
 await t.client.refreshSession();
 let projected=projectOwnDeliveryActivity(t.client.snapshot());
 assert.equal(projected.selected,null);
 assert.equal(projected.rows.length,0);
 t.switchAccount(foreign);
 await t.client.refreshSession();
 projected=projectOwnDeliveryActivity(t.client.snapshot());
 assert.equal(projected.selected,null);
 assert.equal(projected.rows.length,0);
 assert.equal((await t.client.readOwnDeliveryCustody(auto)).ok,false);
});
test('B#16: forged vehicle and foreign custody proof rejected even with HTTP 200',async()=>{
 for(const invalid of [
  custody(auto,'AUTO','delivered',{ownerId:foreign}),
  custody(auto,'MOTO_RIDE','delivered'),
  custody(auto,'AUTO','delivered',{proofVerified:false}),
  custody(auto,'AUTO','delivered',{receiptUrl:'https://evil.invalid'}),
  custody(auto,'AUTO','delivered',{deliveryId:moto})
 ]){
  const t=make({badCustody:invalid});
  await t.client.refreshSession();
  await t.client.loadHistoryPage({reset:true});
  assert.equal((await t.client.readOwnDeliveryCustody(auto)).ok,false);
  assert.equal(projectOwnDeliveryActivity(t.client.snapshot()).selected,null);
 }
});
test('B#16: offline history never creates a delivery or payment',async()=>{
 const t=make();
 await t.client.refreshSession();
 t.goOffline();
 assert.equal((await t.client.loadHistoryPage({reset:true})).ok,false);
 assert.equal(projectOwnDeliveryActivity(t.client.snapshot()).rows.length,0);
 assert(t.requests.every(x=>x.method==='GET'));
});
test('B#16: 403 from sender G68 revokes session and removes verified AUTO state',async()=>{
 const t=make({custodyStatus:403});
 await t.client.refreshSession();
 await t.client.loadHistoryPage({reset:true});
 assert.equal((await t.client.readOwnDeliveryCustody(auto)).ok,false);
 assert.equal(t.client.snapshot().authenticated,false);
 assert.equal(projectOwnDeliveryActivity(t.client.snapshot()).rows.length,0);
});
