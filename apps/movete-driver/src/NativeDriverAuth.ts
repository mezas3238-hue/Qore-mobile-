import 'react-native-url-polyfill/auto';
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {createEncryptedChunkStore} from './domain/encrypted-chunk-store.mjs';
import {createClient} from '@supabase/supabase-js';
import {verifyNativeDriverConfig} from './domain/native-driver-config.mjs';
import {createNativeDriverAuth} from './domain/native-driver-auth.mjs';
import type {NativeDriverAuth} from './domain/native-driver-auth.mjs';

/** Driver and Cliente use separate bundles, distinct Auth storage keys and
 * independent role checks. No server secrets and no Driver network action
 * until backend STAGING is independently authorized and mounted. */
let instance:NativeDriverAuth|null|undefined;
let nativeSupabase:ReturnType<typeof createClient>|null|undefined;
/** One native SDK instance for login and for a separately approved QA API.
 * A second client would race token refresh and break Driver session isolation.
 * Never provides service_role or a backend authorization by itself. */
export function getNativeDriverSupabase():ReturnType<typeof createClient>|null{
 if(nativeSupabase!==undefined)return nativeSupabase;
 if(Platform.OS==='web')return (nativeSupabase=null);
 const config=verifyNativeDriverConfig({
  url:process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 });
 if(!config.ok)return (nativeSupabase=null);
 const storage=createEncryptedChunkStore({
  prefix:'movete-facil-driver-vault-v1',
  randomUUID:()=>Crypto.randomUUID(),
  get:key=>SecureStore.getItemAsync(key),
  put:(key,value)=>SecureStore.setItemAsync(key,value,{
   keychainAccessible:SecureStore.WHEN_UNLOCKED
  }),
  del:key=>SecureStore.deleteItemAsync(key)
 });
 nativeSupabase=createClient(config.url,config.publishableKey,{
  auth:{storage,persistSession:true,autoRefreshToken:true,
   detectSessionInUrl:false,flowType:'pkce',
   storageKey:'movete-facil-driver-auth'}
 });
 return nativeSupabase;
}
export function getNativeDriverAuth():NativeDriverAuth|null{
 if(instance!==undefined)return instance;
 const supabase=getNativeDriverSupabase();
 if(!supabase)return (instance=null);
 instance=createNativeDriverAuth({supabase});
 return instance;
}
