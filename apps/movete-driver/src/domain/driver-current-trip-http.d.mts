export declare const DRIVER_CURRENT_TRIP_LIVE_ENABLED:false;
export type DriverCurrentTrip=Readonly<{
 tripId:string;status:'accepted'|'arriving'|'in_progress';revision:number;
}>;
export declare function readDriverCurrentTrip(opts:{
 apiOrigin:string;approvedStagingHost?:string|null;
 allowedByOwner?:boolean;accessToken:string;request?:typeof fetch;
 timeoutMs?:number;maxBytes?:number;
}):Promise<DriverCurrentTrip|null>;
