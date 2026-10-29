import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {createG192ReceiptKeyJournal} from './domain/g192-receipt-key-journal.mjs';

/** G192 persists the original POST key in native encrypted Keystore only.
 * No browser fallback, no AsyncStorage, no token or address.
 */
let journal:ReturnType<typeof createG192ReceiptKeyJournal>|null|undefined;
export function getNativeG192ReceiptJournal(){
 if(journal!==undefined)return journal;
 if(Platform.OS==='web')return (journal=null);
 journal=createG192ReceiptKeyJournal({
  readSecure:key=>SecureStore.getItemAsync(key),
  writeSecure:(key,value)=>SecureStore.setItemAsync(key,value,{
   keychainAccessible:SecureStore.WHEN_UNLOCKED
  }),
  deleteSecure:key=>SecureStore.deleteItemAsync(key)
 });
 return journal;
}
