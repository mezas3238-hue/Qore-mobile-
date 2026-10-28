import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Native Keychain/Keystore, no web or AsyncStorage fallback. Records contain
// only opaque UUID identifiers and a timestamp, never JWT, route, GPS or fare.
// Serialization makes sign-out purge run after pending writes.
const KEY='movete-facil-cliente-moto-g101-pending-v1';
export function getNativeG101RecoveryStore(){
 if(Platform.OS==='web')return null;
 let queue:Promise<unknown>=Promise.resolve();
 function ordered<T>(fn:()=>Promise<T>):Promise<T>{
  const next=queue.then(fn);
  queue=next.catch(()=>{});
  return next;
 }
 return {
  read:()=>ordered(async():Promise<unknown>=>{
   const raw=await SecureStore.getItemAsync(KEY);
   if(raw===null)return null;
   if(raw.length>1000)throw Error('MOTO recovery record oversized');
   return JSON.parse(raw) as unknown;
  }),
  write:(value:unknown)=>ordered(async()=>{
   const raw=JSON.stringify(value);
   if(typeof raw!=='string'||raw.length>1000)
    throw Error('MOTO recovery record oversized');
   await SecureStore.setItemAsync(KEY,raw,{
    keychainAccessible:SecureStore.WHEN_UNLOCKED
   });
  }),
  clear:()=>ordered(async()=>{await SecureStore.deleteItemAsync(KEY);})
 };
}
