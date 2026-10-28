import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** B23: durable G7 quote key + one-time reconciliation and consent fences.
 * No fare, map, address, phone, GPS, token or PSP in this keystore record.
 */
type Stage='prepared'|'recovery_attempted'|'consent_attempted';
type Row={version:1;ownerId:string;deliveryId:string;
 deliveryRequestKey:string;quoteRequestKey:string;vehicleKind:'AUTO'|'MOTO';
 createdAt:number;stage:Stage};
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const keyFor=(id:string)=>{
 if(!UUID.test(id))throw Error('invalid owner identifier');
 return 'movete-cliente-g126-quote-v1-'+id.toLowerCase();
};
const parse=(raw:string):Row=>{
 if(raw.length>600)throw Error('oversized G126 record');
 const x:unknown=JSON.parse(raw);
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('invalid G126 record');
 const r=x as Record<string,unknown>;
 if(Object.keys(r).length!==8||r.version!==1||
  !['ownerId','deliveryId','deliveryRequestKey','quoteRequestKey']
   .every(k=>typeof r[k]==='string'&&UUID.test(String(r[k])))||
  !['AUTO','MOTO'].includes(String(r.vehicleKind))||
  !Number.isSafeInteger(r.createdAt)||Number(r.createdAt)<=0||
  !['prepared','recovery_attempted','consent_attempted'].includes(String(r.stage)))
  throw Error('invalid G126 record');
 return r as Row;
};
export function getNativeG126QuoteRecoveryStore(){
 if(Platform.OS==='web')return null;
 let queue:Promise<unknown>=Promise.resolve();
 const serial=<T,>(fn:()=>Promise<T>):Promise<T>=>{
  const next=queue.then(fn);queue=next.catch(()=>{});return next;
 };
 return {
  read:(ownerId:string)=>serial(async()=>{
   const raw=await SecureStore.getItemAsync(keyFor(ownerId));
   return raw===null?null:parse(raw);
  }),
  write:(r:Row)=>serial(async()=>{
   if(!r||r.stage!=='prepared')throw Error('invalid initial G126 state');
   const raw=JSON.stringify(r);
   const valid=parse(raw),key=keyFor(valid.ownerId);
   const current=await SecureStore.getItemAsync(key);
   if(current!==null){
    const old=parse(current);
    // Never overwrite an unresolved quote, even with same key.
    throw Error('pending G126 quote exists: '+String(old.version));
   }
   await SecureStore.setItemAsync(key,raw,{
    keychainAccessible:SecureStore.WHEN_UNLOCKED
   });
  }),
  // Only a server-confirmed terminal delivery may release this ledger fence.
  // Never delete an unrelated or in-flight quote by Owner ID alone.
  clearMatching:(ownerId:string,deliveryId:string,deliveryRequestKey:string)=>
   serial(async()=>{
    if(!UUID.test(deliveryId)||!UUID.test(deliveryRequestKey))
     throw Error('invalid delivery scope');
    const key=keyFor(ownerId);
    const raw=await SecureStore.getItemAsync(key);
    if(raw===null)return false;
    const row=parse(raw);
    if(row.ownerId!==ownerId||row.deliveryId!==deliveryId
     ||row.deliveryRequestKey!==deliveryRequestKey)
     throw Error('G126 terminal release scope mismatch');
    await SecureStore.deleteItemAsync(key);
    return true;
   }),
  mark:(ownerId:string,quoteRequestKey:string,stage:Stage)=>serial(async()=>{
   if(!UUID.test(quoteRequestKey)||
    !['recovery_attempted','consent_attempted'].includes(stage))
    throw Error('invalid G126 recovery stage');
   const key=keyFor(ownerId),raw=await SecureStore.getItemAsync(key);
   if(raw===null)throw Error('G126 original quote missing');
   const old=parse(raw);
   if(old.ownerId!==ownerId||old.quoteRequestKey!==quoteRequestKey)
    throw Error('G126 key mismatch');
   if(stage==='recovery_attempted'&&old.stage!=='prepared')
    throw Error('G126 already recovered');
   if(stage==='consent_attempted'&&!['prepared','recovery_attempted'].includes(old.stage))
    throw Error('G126 already consented');
   await SecureStore.setItemAsync(key,JSON.stringify({...old,stage}),{
    keychainAccessible:SecureStore.WHEN_UNLOCKED
   });
  })
 };
}
