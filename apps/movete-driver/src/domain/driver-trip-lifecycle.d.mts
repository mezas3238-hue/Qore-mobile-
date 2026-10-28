import type {DriverTripState,DriverTripEvent,DriverTripStatus,
 DriverTripTransition} from './driver-trip-lifecycle-http.mjs';
export declare const DRIVER_TRIP_CONTROLLER_LIVE_ENABLED:false;
export type DriverTripSnapshot=Readonly<{
 phase:'signed-out'|'authorization-required'|'ready'|'loading'|
  'offline'|'unverified'|'active'|'terminal'|'submitting'|'uncertain';
 tripId:string|null;status:DriverTripState|null;revision:number|null;
 nextEvent:DriverTripEvent|null;uncertain:boolean;
 qaOnly:true;productionEnabled:false;
}>;
export type DriverTripAdapters={
 readStatus:(args:{accessToken:string;tripId:string})=>Promise<DriverTripStatus>;
 transition:(args:{accessToken:string;tripId:string;event:DriverTripEvent;
  eventKey:string})=>Promise<DriverTripTransition>;
 makeRequestKey:()=>Promise<string>|string;
 liveEnabled?:false;
};
export type DriverTripController=Readonly<{
 current:()=>DriverTripSnapshot;
 subscribe:(cb:(state:DriverTripSnapshot)=>void)=>()=>void;
 clear:()=>DriverTripSnapshot;
 setSession:(session:{role:'driver';userId:string;accessToken:string}|null)=>
  DriverTripSnapshot;
 open:(tripId:string)=>Promise<DriverTripSnapshot>;
 refresh:()=>Promise<DriverTripSnapshot>;
 /** Read-only foreground status sync, never a second mutation. */
 poll:()=>Promise<DriverTripSnapshot>;
 advance:()=>Promise<DriverTripSnapshot>;
}>;
export declare function createDriverTripLifecycleController(
 adapters:DriverTripAdapters
):DriverTripController;
