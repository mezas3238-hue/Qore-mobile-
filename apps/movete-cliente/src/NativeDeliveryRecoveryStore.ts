import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * B19: per-Passenger native Keychain/Keystore durable G5 request key.
 * Contains opaque UUIDs + time ONLY, never address, parcel, token or fare.
 * No web/AsyncStorage fallback. Order reads/writes per instance.
 */
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const keyFor=(ownerId:string)=>{
 if(!UUID.test(ownerId))throw Error('Invalid owner scope');
 return 'movete-cliente-delivery-pending-v1-'+ownerId.toLowerCase();
};
export function getNativeDeliveryRecoveryStore(){
 if(Platform.OS==='web')return null;
 let queue:Promise<unknown>=Promise.resolve();
 function ordered<T>(cb:()=>Promise<T>):Promise<T>{
  const next=queue.then(cb);
  queue=next.catch(()=>{});
  return next;
 }
 return {
  read:(ownerId:string)=>ordered(async():Promise<unknown>=>{
   const raw=await SecureStore.getItemAsync(keyFor(ownerId));
   if(raw===null)return null;
   if(raw.length>500)throw Error('G5 recovery record oversized');
   return JSON.parse(raw) as unknown;
  }),
  write:(record:{version:number;ownerId:string;requestKey:string;createdAt:number})=>
   ordered(async()=>{
    if(record?.version!==1||!UUID.test(record?.ownerId??'')
     ||!UUID.test(record?.requestKey??'')
     ||!Number.isSafeInteger(record?.createdAt))throw Error('Invalid recovery record');
    const key=keyFor(record.ownerId);
    const existing=await SecureStore.getItemAsync(key);
    // An unresolved key is never silently overwritten with a different key.
    if(existing!==null){
     if(existing.length>500)throw Error('G5 recovery record oversized');
     let old:unknown;
     try{old=JSON.parse(existing);}catch{throw Error('Invalid saved recovery');}
     if(!old||typeof old!=='object'
      ||(old as {requestKey?:unknown}).requestKey!==record.requestKey)
      throw Error('Existing delivery request must be reconciled');
    }
    const raw=JSON.stringify(record);
    if(raw.length>500)throw Error('G5 recovery record oversized');
    await SecureStore.setItemAsync(key,raw,{
     keychainAccessible:SecureStore.WHEN_UNLOCKED
    });
   }),
  // Called ONLY after server-certified final reconciliation/cancellation,
  // not by logout or a client-side 404.
  clear:(ownerId:string)=>ordered(async()=>SecureStore.deleteItemAsync(keyFor(ownerId))),
  // B25: the caller must have just verified final G121+G68 custody.
  // Compare-and-delete inside the same serialized native queue.
  clearMatching:(ownerId:string,requestKey:string)=>ordered(async()=>{
   if(!UUID.test(requestKey))throw Error('invalid original G5 key');
   const key=keyFor(ownerId);
   const raw=await SecureStore.getItemAsync(key);
   if(raw===null)return false;
   if(raw.length>500)throw Error('invalid saved G5 record');
   const row:unknown=JSON.parse(raw);
   if(!row||typeof row!=='object'||Array.isArray(row)
    ||Object.keys(row).length!==4
    ||(row as {version?:unknown}).version!==1
    ||(row as {ownerId?:unknown}).ownerId!==ownerId
    ||(row as {requestKey?:unknown}).requestKey!==requestKey)
    throw Error('G5 terminal release scope mismatch');
   await SecureStore.deleteItemAsync(key);
   return true;
  })
 };
}
