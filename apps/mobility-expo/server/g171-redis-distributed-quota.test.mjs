import test from 'node:test';
import assert from 'node:assert/strict';
import {validateG171RedisEndpoint,createG171DistributedQuota,
 hashG171Credential} from './g171-redis-distributed-quota.mjs';

test('G174 disposable QA Redis remains localhost-only and never requires TLS secrets',()=>{
 for(const url of ['redis://localhost:6379','redis://127.0.0.1:6379/0']){
  assert.deepEqual(validateG171RedisEndpoint({url}),
   {mode:'DISPOSABLE_LOOPBACK_CI',tls:false});
 }
 for(const url of ['redis://localhost:6380','redis://0.0.0.0:6379',
   'redis://redis-host:6379','redis://localhost:6379/1',
   'redis://localhost:6379?evil=1']){
  assert.throws(()=>validateG171RedisEndpoint({url}));
 }
});
test('G174 remote STAGING requires pinned hostname, ACL and TLS with Owner gate',()=>{
 const url='rediss://qore_backend_user:0123456789abcdefghijklmnopqrstuvwxyz@redis-qa.internal:6380/0';
 assert.throws(()=>validateG171RedisEndpoint({url}),/requires pinned/);
 assert.throws(()=>validateG171RedisEndpoint({
  url,privateStagingApproved:true,pinnedHostname:'other.internal'
 }),/requires pinned/);
 assert.deepEqual(validateG171RedisEndpoint({
  url,privateStagingApproved:true,pinnedHostname:'redis-qa.internal'
 }),{mode:'OWNER_APPROVED_STAGING_TLS',tls:true});
 for(const invalid of [
  url.replace('rediss://','redis://'),
  url.replace('qore_backend_user:',''),
  url.replace('0123456789abcdefghijklmnopqrstuvwxyz','short'),
  url.replace(':6380/0',':6380/5'),
  url+'?allowInsecure=true',url+'#fragment',
  'rediss://localhost:6379',
 ]){
  assert.throws(()=>validateG171RedisEndpoint({
   url:invalid,privateStagingApproved:true,
   pinnedHostname:'redis-qa.internal'
  }));
 }
});
test('G171 quota scopes never publish token and deny failed atomic server calls',async()=>{
 const bearer='Bearer '+'a'.repeat(44);
 const digest=hashG171Credential(bearer);
 const commands=[];
 const redisClient={sendCommand:async command=>{
  commands.push(command);
  return [1,60000];
 }};
 const limiter=createG171DistributedQuota({redisClient});
 const granted=await limiter.claim({credentialHash:digest,method:'POST'});
 assert.deepEqual(granted,{admitted:true,retryAfterSeconds:60});
 assert.equal(commands.length,1);
 assert(!JSON.stringify(commands).includes(bearer));
 assert.equal(commands[0][3].endsWith(':POST:'+digest),true);
 assert.equal(commands[0][4],'20');
 for(const invalid of [null,'bad',{},[1]]){
  assert.throws(()=>createG171DistributedQuota({redisClient:invalid}));
 }
 const broken=createG171DistributedQuota({
  redisClient:{sendCommand:async()=>{throw Error('Redis unavailable');}}
 });
 await assert.rejects(broken.claim({credentialHash:digest,method:'GET'}));
});
