import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** G148: per-Buyer durable original G45 order idempotency key.
 * No JWT, address, amount, card, merchant stock, GPS or PII.
 */
type Row={version:1;ownerId:string;requestKey:string;branchId:string;
 vehicleKind:'AUTO'|'MOTO';createdAt:number;cancelKey:string|null};
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const valid=(x:unknown):x is string=>typeof x==='string'&&UUID.test(x)&&x===x.toLowerCase();
const keyFor=(ownerId:string)=>{
 if(!valid(ownerId))throw Error('Invalid G148 owner');
 return 'movete-cliente-g148-commerce-qa-v1-'+ownerId;
};
const parse=(raw:string):Row=>{
 if(raw.length>550)throw Error('Oversized G148 record');
 const o:unknown=JSON.parse(raw);
 if(!o||typeof o!=='object'||Array.isArray(o))throw Error('Invalid G148 record');
 const x=o as Record<string,unknown>;
 if(Object.keys(x).length!==7||x.version!==1||
  !valid(x.ownerId)||!valid(x.requestKey)||!valid(x.branchId)||
  (x.vehicleKind!=='AUTO'&&x.vehicleKind!=='MOTO')||
  typeof x.createdAt!=='number'||!Number.isSafeInteger(x.createdAt)||x.createdAt<=0||
  !(x.cancelKey===null||valid(x.cancelKey)))
  throw Error('Invalid G148 record');
 return x as Row;
};
export function getNativeG148CommerceRecoveryStore(){
 if(Platform.OS==='web')return null;
 let pending:Promise<unknown>=Promise.resolve();
 const serial=<T,>(f:()=>Promise<T>):Promise<T>=>{
  const task=pending.then(f);pending=task.catch(()=>{});return task;
 };
 return {
  read:(ownerId:string):Promise<Row|null>=>serial(async()=>{
   const raw=await SecureStore.getItemAsync(keyFor(ownerId));
   return raw===null?null:parse(raw);
  }),
  write:(row:Row):Promise<void>=>serial(async()=>{
   const raw=JSON.stringify(row),safe=parse(raw);
   if(safe.cancelKey!==null)throw Error('Invalid initial G148 record');
   const key=keyFor(safe.ownerId);
   if(await SecureStore.getItemAsync(key)!==null)
    throw Error('Original commerce order not resolved');
   await SecureStore.setItemAsync(key,raw,{
    keychainAccessible:SecureStore.WHEN_UNLOCKED
   });
  }),
  markCancel:(ownerId:string,requestKey:string,cancelKey:string):Promise<void>=>
   serial(async()=>{
    if(!valid(requestKey)||!valid(cancelKey))throw Error('Invalid G148 cancel key');
    const key=keyFor(ownerId);
    const raw=await SecureStore.getItemAsync(key);
    if(raw===null)throw Error('Original commerce order missing');
    const row=parse(raw);
    if(row.ownerId!==ownerId||row.requestKey!==requestKey||
     row.cancelKey!==null&&row.cancelKey!==cancelKey)
     throw Error('Original commerce cancel scope mismatch');
    await SecureStore.setItemAsync(key,JSON.stringify({...row,cancelKey}),{
     keychainAccessible:SecureStore.WHEN_UNLOCKED
    });
   }),
  clearMatching:(ownerId:string,requestKey:string):Promise<boolean>=>
   serial(async()=>{
    if(!valid(requestKey))throw Error('Invalid G148 release key');
    const key=keyFor(ownerId);
    const raw=await SecureStore.getItemAsync(key);
    if(raw===null)return false;
    const row=parse(raw);
    if(row.ownerId!==ownerId||row.requestKey!==requestKey)
     throw Error('G148 different order cannot be cleared');
    await SecureStore.deleteItemAsync(key);
    return true;
   })
 };
}
