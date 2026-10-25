import 'react-native-url-polyfill/auto';
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {createClient} from '@supabase/supabase-js';
import {verifyNativeDriverConfig} from './domain/native-driver-config.mjs';
import {createNativeDriverAuth} from './domain/native-driver-auth.mjs';
import type {NativeDriverAuth} from './domain/native-driver-auth.mjs';

/** Driver and Cliente use separate bundles, distinct Auth storage keys and
 * independent role checks. No server secrets and no Driver network action
 * until backend STAGING is independently authorized and mounted. */
let instance:NativeDriverAuth|null|undefined;
export function getNativeDriverAuth():NativeDriverAuth|null{
 if(instance!==undefined)return instance;
 if(Platform.OS==='web')return (instance=null);
 const config=verifyNativeDriverConfig({
  url:process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 });
 if(!config.ok)return (instance=null);
 const storage={
  getItem:(key:string)=>SecureStore.getItemAsync(key),
  async setItem(key:string,value:string){
   const bytes=encodeURIComponent(value).replace(/%[0-9A-F]{2}/gi,'_').length;
   if(bytes>1900)throw Error('Driver session exceeds secure storage limit');
   await SecureStore.setItemAsync(key,value,{
    keychainAccessible:SecureStore.WHEN_UNLOCKED
   });
  },
  removeItem:(key:string)=>SecureStore.deleteItemAsync(key)
 };
 const supabase=createClient(config.url,config.publishableKey,{
  auth:{storage,persistSession:true,autoRefreshToken:true,
   detectSessionInUrl:false,flowType:'pkce',
   storageKey:'movete-facil-driver-auth'}
 });
 instance=createNativeDriverAuth({supabase});
 return instance;
}
