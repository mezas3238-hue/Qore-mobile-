export declare const DRIVER_MOTO_JOURNEY_LIVE_ENABLED:false;
export type DriverMotoJourney=Readonly<{
 bookingKey:string;tripId:string;status:'accepted'|'arriving'|'in_progress'|'completed';
 revision:number;nextState:'arriving'|'in_progress'|'completed'|null;
 qaOnly:true;productionEnabled:false;
}>;
export type DriverMotoHttpScope=Readonly<{
 apiOrigin:string;approvedStagingHost?:string|null;
 allowedByOwner?:boolean;accessToken:string;bookingKey:string;
 request?:typeof fetch;timeoutMs?:number;
}>;
export declare function readDriverMotoJourney(
 options:DriverMotoHttpScope):Promise<DriverMotoJourney>;
export declare function advanceDriverMotoJourney(
 options:DriverMotoHttpScope & {
 expectedRevision:number;nextState:'arriving'|'in_progress'|'completed';
 commandKey:string;
 }):Promise<DriverMotoJourney>;

export declare function readCurrentDriverMoto(options:Omit<DriverMotoHttpScope,'bookingKey'>):Promise<DriverMotoJourney|null>;
