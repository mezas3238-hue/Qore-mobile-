/**
 * G298 — Android telephone handoff. No call-state claim, no in-app hidden 911.
 * Only an explicit Driver tap calls this method. No passenger gets a signal.
 */
import {Linking,PermissionsAndroid,Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as IntentLauncher from 'expo-intent-launcher';
import {getNativeDriverAuth} from './NativeDriverAuth';
import {planDriverSosDial,normalizeTrustedNumber} from './domain/g298-driver-sos-dial.mjs';

type Destination='EMERGENCY_911'|'TRUSTED_CONTACT';
type Preference={destination:Destination;trustedNumber:string};
const KEY_PREFIX='qore-driver-sos-choice-v1-';
const ACTIVE_KEY='qore-driver-sos-current-user-v1';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const defaultChoice:Preference={destination:'EMERGENCY_911',trustedNumber:''};
function storageKey(userId:string){return KEY_PREFIX+userId;}
async function verifiedUser(){
 try{return (await getNativeDriverAuth()?.getSession())?.userId??null;}
 catch{return null;}
}
/** Driver's current account is restored after authenticated login, but SOS
 * reads ONLY local secure storage: never wait for internet in an emergency. */
export async function restoreDriverSosActiveSession():Promise<void>{
 const userId=await verifiedUser();
 if(userId&&UUID.test(userId))
  await SecureStore.setItemAsync(ACTIVE_KEY,userId);
 else await SecureStore.deleteItemAsync(ACTIVE_KEY);
}
export async function clearDriverSosActiveSession():Promise<void>{
 await SecureStore.deleteItemAsync(ACTIVE_KEY);
}
export async function readDriverSosPreference():Promise<Preference>{
 try{
  const userId=await SecureStore.getItemAsync(ACTIVE_KEY);
  if(!userId||!UUID.test(userId))return defaultChoice;
  const stored=await SecureStore.getItemAsync(storageKey(userId));
  if(!stored)return defaultChoice;
  const parsed:unknown=JSON.parse(stored);
  if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed))
   return defaultChoice;
  const row=parsed as Record<string,unknown>;
  if(row.destination==='TRUSTED_CONTACT'){
   const phone=normalizeTrustedNumber(row.trustedNumber);
   return phone?{destination:'TRUSTED_CONTACT',trustedNumber:phone}:defaultChoice;
  }
  return defaultChoice;
 }catch{return defaultChoice;}
}
export async function saveDriverSosPreference(next:Preference):Promise<boolean>{
 const userId=await verifiedUser();
 if(!userId)return false;
 if(next.destination!=='EMERGENCY_911'&&next.destination!=='TRUSTED_CONTACT')
  return false;
 const normalized=next.destination==='TRUSTED_CONTACT'?
  normalizeTrustedNumber(next.trustedNumber):'';
 if(next.destination==='TRUSTED_CONTACT'&&!normalized)return false;
 await SecureStore.setItemAsync(storageKey(userId),
  JSON.stringify({destination:next.destination,trustedNumber:normalized??''}),{
   keychainAccessible:SecureStore.WHEN_UNLOCKED
  });
 await SecureStore.setItemAsync(ACTIVE_KEY,userId);
 return true;
}
export async function requestTrustedContactCallPermission(){
 if(Platform.OS!=='android')return false;
 const permission=PermissionsAndroid.PERMISSIONS.CALL_PHONE;
 try{
  if(await PermissionsAndroid.check(permission))return true;
  return await PermissionsAndroid.request(permission)===PermissionsAndroid.RESULTS.GRANTED;
 }catch{return false;}
}
export async function launchDriverSosPhone():Promise<'PHONE_OPENED'|'FAILED'>{
 const choice=await readDriverSosPreference();
 const plan=planDriverSosDial(choice.destination,choice.trustedNumber);
 if(!plan)return 'FAILED';
 try{
  if(Platform.OS==='android'){
   if(plan.needsCallPermission){
    // Do not block urgent access behind a permission prompt.
    const granted=await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
    if(!granted){
     // Safe fallback: open the dialer; does not place an unsolicited call.
     await IntentLauncher.startActivityAsync('android.intent.action.DIAL',{data:plan.uri});
     return 'PHONE_OPENED';
    }
   }
   // For ordinary numbers ACTION_CALL starts a direct outgoing call. For 911,
   // Android requires ACTION_DIAL and user confirmation in the system dialer.
   // Android controls the telephone UI; ACTION_CALL does not indicate
   // whether the recipient answered, only that handoff was attempted.
   try{
    await IntentLauncher.startActivityAsync(plan.intentAction,{data:plan.uri});
   }catch{
    // If direct calling is blocked by device policy, open the dialer instead.
    await IntentLauncher.startActivityAsync('android.intent.action.DIAL',{data:plan.uri});
   }
   return 'PHONE_OPENED'; // No claim that a call connected or was answered.
  }
  await Linking.openURL(plan.uri); // iOS fallback to phone UI
  return 'PHONE_OPENED';
 }catch{return 'FAILED';}
}
