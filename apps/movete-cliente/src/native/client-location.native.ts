/** G309: native-only foreground location and device geocoder, no app key. */
import * as Location from 'expo-location';
import {inspectPassengerGpsFix,makePassengerAddressLabel,
 inspectDestinationCandidates,scopePassengerDestinationQuery,
 makePassengerDestinationCandidate} from '../domain/client-geolocation.mjs';
export type PassengerPlace=Readonly<{label:string;latitude:number;longitude:number}>;
const timeout=<T,>(task:Promise<T>,ms:number):Promise<T>=>Promise.race([
 task,new Promise<T>((_,reject)=>setTimeout(()=>reject(Error('LOCATION_TIMEOUT')),ms))
]);
export async function getPassengerCurrentPickup():Promise<{
 ok:true;place:PassengerPlace;accuracyMeters:number
}|{ok:false;code:string}>{
 try{
  // Never reopen the Android permission or high-accuracy settings dialogue
  // when permission was already granted. Foreground location is one-shot.
  const existing=await timeout(Location.getForegroundPermissionsAsync(),5000);
  const permit=existing.granted===true?existing:
   await timeout(Location.requestForegroundPermissionsAsync(),12000);
  if(permit.granted!==true)return {ok:false,code:'LOCATION_DENIED'};
  const gps=await timeout(Location.getCurrentPositionAsync({
   accuracy:Location.Accuracy.High,mayShowUserSettingsDialog:false
  }),15000);
  const valid=inspectPassengerGpsFix({
   latitude:gps.coords.latitude,longitude:gps.coords.longitude,
   accuracyMeters:gps.coords.accuracy,mocked:gps.mocked
  });
  if(!valid.ok)return {ok:false,code:valid.code};
  let label:string|null=null;
  try{
   const result=await timeout(Location.reverseGeocodeAsync(valid.point),10000);
   label=makePassengerAddressLabel(result[0],null);
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
  const scoped=scopePassengerDestinationQuery(query);
  if(!scoped)return {ok:false,code:'ADDRESS_QUERY_TOO_SHORT'};
  // Forward geocoder coordinates are not user-facing addresses by themselves.
  // Resolve the top two suggestions back to a real Paraguayan postal address.
  const spots=await timeout(Location.geocodeAsync(scoped),12000);
  const confirmed:PassengerPlace[]=[];
  for(const point of spots.slice(0,2)){
   try{
    const resolved=await timeout(Location.reverseGeocodeAsync({
     latitude:point.latitude,longitude:point.longitude
    }),4500);
    const address=makePassengerDestinationCandidate(point,resolved[0]);
    if(address)confirmed.push(address);
   }catch{/* Unverified suggestions must never be selectable. */}
  }
  const places=inspectDestinationCandidates(confirmed);
  return places.length?{ok:true,places}:{ok:false,code:'ADDRESS_NOT_FOUND'};
 }catch{return {ok:false,code:'GEOCODER_UNAVAILABLE'};}
}
