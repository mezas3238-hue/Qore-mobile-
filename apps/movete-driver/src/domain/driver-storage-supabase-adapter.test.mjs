import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverSupabasePrivateStorageAdapter,DRIVER_PRIVATE_STORAGE_LIVE_ENABLED}
 from './driver-storage-supabase-adapter.mjs';
const actor='18180000-0000-4818-8818-000000000001';
const other='18180000-0000-4818-8818-000000000002';
const bearer='private-driver-session-token-verified-0000001';
const objectKey=actor+'/rostro_selfie-abcdefghijklmnop.jpg';
const bytes=Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1,0,0,0,0,0,0,255,217]);
function fixture(changes={}){
 const calls=[];
 const options={allowedByOwner:true,liveEnabled:false,
  authAdapter:{getSession:async()=>({role:'driver',userId:actor,accessToken:bearer})},
  storage:{from:bucket=>{
   calls.push(['bucket',bucket]);return {upload:async(key,data,opts)=>{
    calls.push(['upload',key,data,opts]);
    return {data:{path:key},error:null};
   }};}},
  ...changes
 };
 return {upload:createDriverSupabasePrivateStorageAdapter(options),calls};
}
const input={bucket:'mobility-staging-driver-evidence',objectKey,
 mimeType:'image/jpeg',bytes,upsert:false,accessToken:bearer};
test('Opt-in Storage SDK receives private bucket, owner path, bytes and no upsert',async()=>{
 assert.equal(DRIVER_PRIVATE_STORAGE_LIVE_ENABLED,false);
 const f=fixture();
 assert.deepEqual(await f.upload(input),{storedPrivately:true});
 assert.equal(f.calls[0][1],input.bucket);
 const [_,path,data,opts]=f.calls[1];
 assert.equal(path,objectKey);
 assert(data instanceof ArrayBuffer);
 assert.deepEqual(new Uint8Array(data),bytes);
 assert.deepEqual(opts,{contentType:'image/jpeg',upsert:false,cacheControl:'0'});
});
test('Public bucket, other owner, stale session, public URL and unsafe SDK result all denied',async()=>{
 for(const invalid of [
  {...input,bucket:'public'},
  {...input,upsert:true},
  {...input,objectKey:other+'/rostro_selfie-abcdefghijklmnop.jpg'},
  {...input,objectKey:actor+'/unknown-abcdefghijklmnop.jpg'},
  {...input,objectKey:actor+'/rostro_selfie-abcdefghijklmnop.jpg?download=1'},
  {...input,mimeType:'application/pdf'},
  {...input,bytes:new Uint8Array(5)}
 ]){
  const f=fixture();
  await assert.rejects(()=>f.upload(invalid));
  assert.deepEqual(f.calls,[]);
 }
 for(const authAdapter of [
  {getSession:async()=>null},
  {getSession:async()=>({role:'passenger',userId:actor,accessToken:bearer})},
  {getSession:async()=>({role:'driver',userId:other,accessToken:bearer})},
  {getSession:async()=>({role:'driver',userId:actor,accessToken:'changed'})}
 ]){
  const f=fixture({authAdapter});
  await assert.rejects(()=>f.upload(input));
  assert.deepEqual(f.calls,[]);
 }
 for(const response of [
  {data:null,error:null},{data:{path:'other'},error:null},
  {data:{path:objectKey},error:{message:'denied'}}
 ]){
  const f=fixture({storage:{from:()=>({upload:async()=>response})}});
  await assert.rejects(()=>f.upload(input));
 }
 assert.throws(()=>fixture({allowedByOwner:false}));
 assert.throws(()=>fixture({liveEnabled:true}));
});
