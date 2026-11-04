/** G309: native-only foreground location and device geocoder, no app key. */
import * as Location from 'expo-location';
import {inspectPassengerGpsFix,makePassengerAddressLabel,
 inspectDestinationCandidates} from '../domain/client-geolocation.mjs';
export type PassengerPlace=Readonly<{label:string;latitude:number;longitude:number}>;
const timeout=<T,>(task:Promise<T>,ms:number):Promise<T>=>Promise.race([
 task,new Promise<T>((_,reject)=>setTimeout(()=>reject(Error('LOCATION_TIMEOUT')),ms))
]);
export async function getPassengerCurrentPickup():Promise<{
 ok:true;place:PassengerPlace;accuracyMeters:number
}|{ok:false;code:string}>{
 try{
  const permit=await timeout(Location.requestForegroundPermissionsAsync(),15000);
  if(permit.granted!==true)return {ok:false,code:'LOCATION_DENIED'};
  const gps=await timeout(Location.getCurrentPositionAsync({
   accuracy:Location.Accuracy.High,mayShowUserSettingsDialog:true
  }),20000);
  const valid=inspectPassengerGpsFix({
   latitude:gps.coords.latitude,longitude:gps.coords.longitude,
   accuracyMeters:gps.coords.accuracy,mocked:gps.mocked
  });
  if(!valid.ok)return {ok:false,code:valid.code};
  let label:string|null=null;
  try{
   const result=await timeout(Location.reverseGeocodeAsync(valid.point),10000);
   label=makePassengerAddressLabel(result[0],null as unknown as string);
  }catch{/* GPS coordinates survive if address service unavailable. */}
  const {latitude,longitude}=valid.point;
  if(!label)label='Ubicación GPS '+latitude.toFixed(5)+', '+longitude.toFixed(5);
  return {ok:true,place:{label,latitude,longitude},
   accuracyMeters:valid.point.accuracyMeters};
 }catch{return {ok:false,code:'LOCATION_UNAVAILABLE'};}
}
export async function searchPassengerDestination(query:string):Promise<{
 ok:true;places:readonly PassengerPlace[]
}|{ok:false;code:string}>{
 if(typeof query!=='string'||query.trim().length<4||query.length>120)
  return {ok:false,code:'ADDRESS_QUERY_TOO_SHORT'};
 try{
  // Android geocoding also requires foreground location permission.
  const perm=await timeout(Location.getForegroundPermissionsAsync(),5000);
  if(perm.granted!==true)return {ok:false,code:'LOCATION_DENIED'};
  const spots=await timeout(Location.geocodeAsync(query.trim()),12000);
  const places=inspectDestinationCandidates(spots.slice(0,5).map((point,i)=>({
   latitude:point.latitude,longitude:point.longitude,
   label:spots.length===1?query.trim():query.trim()+' · Opción '+(i+1)
  })));
  return places.length?{ok:true,places}:{ok:false,code:'ADDRESS_NOT_FOUND'};
 }catch{return {ok:false,code:'GEOCODER_UNAVAILABLE'};}
}
