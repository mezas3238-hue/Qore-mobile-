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
const defaultChoice:Preference={destination:'EMERGENCY_911',trustedNumber:''};
function storageKey(userId:string){return KEY_PREFIX+userId;}
async function verifiedUser(){
 try{return (await getNativeDriverAuth()?.getSession())?.userId??null;}
 catch{return null;}
}
export async function readDriverSosPreference():Promise<Preference>{
 const userId=await verifiedUser();
 if(!userId)return defaultChoice; // Even offline: a direct 911 fallback is available.
 try{
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
   void IntentLauncher.startActivityAsync(plan.intentAction,{data:plan.uri})
    .catch(()=>{}); // OS call UI is allowed to interrupt foreground map.
   return 'PHONE_OPENED'; // Handoff attempted, not proof that anyone answered.
  }
  await Linking.openURL(plan.uri); // iOS fallback to phone UI
  return 'PHONE_OPENED';
 }catch{return 'FAILED';}
}
