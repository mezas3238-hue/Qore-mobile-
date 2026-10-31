import test from 'node:test';
import assert from 'node:assert/strict';
import {createG254ExpoKycReminderSender,G254_EXPO_KYC_LIVE_ENABLED}
 from './g254-expo-kyc-reminder-sender.mjs';
const who='25400000-0000-4254-8254-000000000001';
const token='ExpoPushToken[abcdefghijklmno1234567]';
const message={title:'QORE · Documentación',
 body:'Revisá tus documentos en la aplicación QORE Driver.',
 data:{kind:'QORE_STAGING_KYC_REMINDER'}};
const create=override=>createG254ExpoKycReminderSender({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 request:async()=>new Response(JSON.stringify({
  data:{status:'ok',id:'accepted_ticket_123'}}),{
  status:200,headers:{'content-type':'application/json'}}),
 ...override
});
test('G254 sender posts private generic payload to Expo and never claims delivery',async()=>{
 assert.equal(G254_EXPO_KYC_LIVE_ENABLED,false);
 const calls=[];
 const sender=create({request:async(url,opt)=>{
  calls.push({url,opt});
  return new Response(JSON.stringify({data:{status:'ok',id:'accepted_ticket_123'}}),
   {status:200,headers:{'content-type':'application/json'}});
 }});
 assert.deepEqual(await sender({
  token,recipientDriverId:who,message
 }),{acceptedForProcessing:true,handsetDelivered:false,
  driverApproved:false,productionEnabled:false,
  providerTicketId:'accepted_ticket_123'});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://exp.host/--/api/v2/push/send');
 assert.equal(calls[0].opt.method,'POST');
 assert.equal(calls[0].opt.redirect,'error');
 const sent=JSON.parse(calls[0].opt.body);
 assert.deepEqual(sent,{to:token,title:message.title,body:message.body,
  data:message.data,ttl:3600,priority:'normal'});
 assert.equal(JSON.stringify(sent).includes(who),false);
 assert.equal(JSON.stringify(sent).includes('validUntil'),false);
});
test('G254 sender rejects forged payload, token or recipient before any POST',async()=>{
 let calls=0;
 const sender=create({request:async()=>{calls++;return new Response('not used');}});
 for(const bad of [
  {token:'bad',recipientDriverId:who,message},
  {token,recipientDriverId:'bad',message},
  {token,recipientDriverId:who,message:{...message,kind:'secret'}},
  {token,recipientDriverId:who,message:{...message,data:{
   kind:'QORE_STAGING_KYC_REMINDER',driverId:who}}},
  {token,recipientDriverId:who,message:{...message,title:'Private license'}},
  {token,recipientDriverId:who,message:{...message,
   body:'Document expires today - private ID'}},
 ]){
  await assert.rejects(sender(bad),/G254_UNVERIFIED_GENERIC_REMINDER/);
 }
 assert.equal(calls,0);
});
test('G254 sender rejects provider errors, ambiguous acceptance and ticket forgery',async()=>{
 const bad=[
  new Response('error',{status:500}),
  new Response('{}',{status:200,headers:{'content-type':'text/html'}}),
  new Response('{}',{status:200,headers:{'content-type':'application/json'}}),
  new Response(JSON.stringify({data:{status:'error',id:'notreal_123456'}}),
   {status:200,headers:{'content-type':'application/json'}}),
  new Response(JSON.stringify({data:{status:'ok',id:'abc'}}),
   {status:200,headers:{'content-type':'application/json'}}),
  new Response(JSON.stringify({data:{status:'ok',id:'accepted_ticket_123',
   receiverPhone:'secret'}}),
   {status:200,headers:{'content-type':'application/json'}})
 ];
 for(const response of bad){
  await assert.rejects(create({request:async()=>response})({
   token,recipientDriverId:who,message}),/G254_EXPO_UNTRUSTED/);
 }
});
test('G254 sender does not retry when Expo network state is ambiguous',async()=>{
 let count=0;
 const sender=create({request:async()=>{count++;throw Error('private');}});
 await assert.rejects(sender({token,recipientDriverId:who,message}),
  /G254_EXPO_OUTCOME_UNKNOWN_NO_RETRY/);
 assert.equal(count,1);
});
test('G254 Expo transport cannot be configured for production',()=>{
 for(const opts of [
  {environment:'production'},{liveEnabled:true},
  {qaOnly:false},{request:null}
 ]){
  assert.throws(()=>create(opts),/G254_SECURE_STAGING_EXPO_REQUIRED/);
 }
});
