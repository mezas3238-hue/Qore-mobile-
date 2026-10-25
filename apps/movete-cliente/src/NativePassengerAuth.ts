import 'react-native-url-polyfill/auto';
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {createClient} from '@supabase/supabase-js';
import {createNativePassengerAuth} from './domain/native-passenger-auth.mjs';
import type {NativePassengerAuth} from './domain/native-passenger-auth.mjs';
import {verifyNativePassengerConfig} from './domain/native-passenger-config.mjs';

/**
 * A real installed Passenger login, not a trip-production switch.
 * Supabase session never uses AsyncStorage or unencrypted fallback.
 * SecureStore can reject large sessions; failure must remain fail-closed.
 * Web has no equivalent trusted Keychain; disable native Auth on web.
 */
let singleton:NativePassengerAuth|null|undefined;
export function getNativePassengerAuth():NativePassengerAuth|null{
 if(singleton!==undefined)return singleton;
 if(Platform.OS==='web')return (singleton=null);
 const config=verifyNativePassengerConfig({
  url:process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 });
 if(!config.ok)return (singleton=null);
 const storage={
  async getItem(key:string){
   return SecureStore.getItemAsync(key);
  },
  async setItem(key:string,value:string){
   // Native Keychain/Keystore only. No persistent cleartext fallback.
   if(encodeURIComponent(value).replace(/%[0-9A-F]{2}/gi,'_').length>1900)
    throw Error('Supabase native session exceeds secure storage limit');
   return SecureStore.setItemAsync(key,value,{
    keychainAccessible:SecureStore.WHEN_UNLOCKED
   });
  },
  async removeItem(key:string){
   return SecureStore.deleteItemAsync(key);
  }
 };
 const supabase=createClient(config.url,config.publishableKey,{
  auth:{storage,persistSession:true,autoRefreshToken:true,
   detectSessionInUrl:false,flowType:'pkce',storageKey:'movete-facil-cliente-auth'}
 });
 singleton=createNativePassengerAuth({supabase});
 return singleton;
}
