/** Web/unsupported fallback: never guess GPS coordinates. */
import type {PassengerPlace} from './client-location.native';
export type {PassengerPlace} from './client-location.native';
export async function getPassengerCurrentPickup():Promise<{
 ok:true;place:PassengerPlace;accuracyMeters:number
}|{ok:false;code:string}>{
 return {ok:false,code:'NATIVE_GPS_REQUIRED'};
}
export async function searchPassengerDestination(_query:string):Promise<{
 ok:true;places:readonly PassengerPlace[]
}|{ok:false;code:string}>{
 return {ok:false,code:'NATIVE_GPS_REQUIRED'};
}

/** Unsupported browser must never approve a map point. */
export async function confirmPassengerMapPoint(
 _previous:PassengerPlace,_selected:Readonly<{latitude:number;longitude:number}>
):Promise<{ok:true;place:PassengerPlace}|{ok:false;code:string}>{
 return {ok:false,code:'NATIVE_MAP_REQUIRED'};
}
