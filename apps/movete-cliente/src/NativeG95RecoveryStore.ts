import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Keychain/Keystore, sin fallback web ni AsyncStorage. No guarda JWT,
// dinero, teléfonos, coordenadas ni rutas humanas: solo UUIDs y revisión.
const KEY='movete-facil-cliente-g95-pending-v1';
export function getNativeG95RecoveryStore(){
 if(Platform.OS==='web')return null;
 return {
  async read():Promise<unknown>{
   const raw=await SecureStore.getItemAsync(KEY);
   if(raw===null)return null;
   if(raw.length>1800)throw Error('G95 record too large');
   return JSON.parse(raw) as unknown;
  },
  async write(value:unknown):Promise<void>{
   const raw=JSON.stringify(value);
   if(raw.length>1800)throw Error('G95 record too large');
   await SecureStore.setItemAsync(KEY,raw,{
    keychainAccessible:SecureStore.WHEN_UNLOCKED
   });
  },
  async clear():Promise<void>{await SecureStore.deleteItemAsync(KEY);}
 };
}
