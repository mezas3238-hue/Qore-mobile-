export declare const DRIVER_TRIP_LIFECYCLE_LIVE_ENABLED:false;
export type DriverTripState='accepted'|'arriving'|'in_progress'|'completed'|'cancelled';
export type DriverTripEvent='arrive'|'pickup'|'complete';
export type DriverTripHttpOptions={
 apiOrigin:string;approvedStagingHost?:string|null;allowedByOwner?:boolean;
 accessToken:string;tripId:string;request?:typeof fetch;
};
export type DriverTripStatus=Readonly<{
 tripId:string;phase:DriverTripState;revision:number;
 nextEvent:DriverTripEvent|null;qaOnly:true;productionEnabled:false;
}>;
export type DriverTripTransition=Readonly<{
 tripId:string;event:DriverTripEvent;receiptId:string;
 serverPersisted:true;qaOnly:true;productionEnabled:false;
}>;
export declare function readPrivateDriverTripStatus(
 options:DriverTripHttpOptions):Promise<DriverTripStatus>;
export declare function transitionPrivateDriverTrip(
 options:DriverTripHttpOptions&{event:DriverTripEvent;eventKey:string}
):Promise<DriverTripTransition>;
