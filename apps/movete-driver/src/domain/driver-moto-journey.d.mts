import type {DriverMotoJourney} from './driver-moto-journey-http.mjs';
export declare const DRIVER_MOTO_CONTROLLER_LIVE_ENABLED:false;
export type DriverMotoSnapshot=Readonly<{
 phase:'signed-out'|'ready'|'loading'|'submitting'|'active'|'terminal'|
 'offline'|'unverified'|'uncertain'|'authorization-required';
 bookingKey:string|null;tripId:string|null;status:string|null;
 revision:number|null;nextState:'arriving'|'in_progress'|'completed'|null;
 uncertain:boolean;qaOnly:true;productionEnabled:false;
}>;
export type DriverMotoAdapters=Readonly<{
 readStatus:(p:{accessToken:string;bookingKey:string})=>Promise<DriverMotoJourney>;
 advanceState:(p:{accessToken:string;bookingKey:string;
  expectedRevision:number;nextState:'arriving'|'in_progress'|'completed';
  commandKey:string})=>Promise<DriverMotoJourney>;
 makeRequestKey:()=>string|Promise<string>;
 liveEnabled?:false;
}>;
export type DriverMotoController=Readonly<{
 current:()=>DriverMotoSnapshot;
 subscribe:(fn:(x:DriverMotoSnapshot)=>void)=>(()=>void);
 clear:()=>DriverMotoSnapshot;
 setSession:(value:{role:string;userId:string;accessToken:string}|null)=>DriverMotoSnapshot;
 open:(bookingKey:string)=>Promise<DriverMotoSnapshot>;
 refresh:()=>Promise<DriverMotoSnapshot>;
 advance:()=>Promise<DriverMotoSnapshot>;
}>;
export declare function createDriverMotoJourneyController(
 adapters:DriverMotoAdapters):DriverMotoController;
