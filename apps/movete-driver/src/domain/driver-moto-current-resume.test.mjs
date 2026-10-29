import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverOriginalDriverMoto} from './driver-moto-current-resume.mjs';
const id=n=>'18900000-0000-4189-8189-'+String(n).padStart(12,'0');
const first={role:'driver',userId:id(1),accessToken:'verified-driver-g189-1234567890'};
const active={bookingKey:id(2),tripId:id(3),status:'accepted',
 revision:2,qaOnly:true,productionEnabled:false};
const opened={...active,phase:'active'};
test('G189 recovery uses current GET then separate original SQL GET and three IdP proofs',async()=>{
 const calls=[];
 const value=await recoverOriginalDriverMoto({
  getSession:async()=>{calls.push('AUTH');return first;},
  readCurrent:async({accessToken})=>{
   assert.equal(accessToken,first.accessToken);
   calls.push('CURRENT');return active;
  },
  openOriginal:async booking=>{
   assert.equal(booking,active.bookingKey);
   calls.push('ORIGINAL');return opened;
  }
 });
 assert.deepEqual(value,{ok:true,bookingKey:active.bookingKey,tripId:active.tripId,
  qaOnly:true,productionEnabled:false});
 assert.deepEqual(calls,['AUTH','CURRENT','AUTH','ORIGINAL','AUTH']);
});
test('G189 zero current or terminal/foreign/stale original can never navigate',async()=>{
 for(const candidate of [null,{...active,status:'completed'},
  {...active,bookingKey:'bad'},{...active,revision:1},
  {...active,productionEnabled:true}]){
  let original=0;
  const result=await recoverOriginalDriverMoto({
   getSession:async()=>first,readCurrent:async()=>candidate,
   openOriginal:async()=>{original++;return opened;}
  });
  assert.equal(result.ok,false);
  if(!candidate||candidate.status==='completed'||candidate.revision===1||
   candidate.bookingKey==='bad'||candidate.productionEnabled===true)
   assert.equal(original,0);
 }
 for(const bad of [
  {...opened,bookingKey:id(9)},{...opened,tripId:id(9)},
  {...opened,revision:1},{...opened,status:'completed',phase:'terminal'},
  {...opened,phase:'offline'}
 ]){
  assert.equal((await recoverOriginalDriverMoto({
   getSession:async()=>first,readCurrent:async()=>active,
   openOriginal:async()=>bad
  })).ok,false);
 }
});
test('G189 identity rotation at each network boundary prevents opening or navigation',async()=>{
 for(const turn of [2,3]){
  let count=0,reads=0,opens=0;
  const outcome=await recoverOriginalDriverMoto({
   getSession:async()=>++count>=turn?{...first,userId:id(6)}:first,
   readCurrent:async()=>{reads++;return active;},
   openOriginal:async()=>{opens++;return opened;}
  });
  assert.equal(outcome.ok,false);
  assert.equal(reads,1);
  assert.equal(opens,turn===2?0:1);
 }
});
test('G189 missing IdP, unavailable SQL, malformed proof are fail-closed',async()=>{
 let opens=0;
 for(const args of [
  {getSession:async()=>null,readCurrent:async()=>active},
  {getSession:async()=>first,readCurrent:async()=>{throw Error('503')}},
  {getSession:async()=>first,readCurrent:async()=>[{...active}]},
  {getSession:async()=>first,readCurrent:async()=>({...active,qaOnly:false})}
 ]){
  assert.equal((await recoverOriginalDriverMoto({
   ...args,openOriginal:async()=>{opens++;return opened;}
  })).ok,false);
 }
 assert.equal(opens,0);
});
