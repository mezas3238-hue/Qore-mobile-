export type DriverPendingVehicleKind='AUTO'|'MOTO';
export type DriverPendingVehicleService='economico'|'confort'|'xl'|'moto_pasajero';
export type DriverPendingVehicleDraft=Readonly<{
 kind:DriverPendingVehicleKind;service:DriverPendingVehicleService;
 municipalityCode:string;plate:string;brand:string;model:string;
 year:number;passengerCapacity:number;
}>;
export type DriverPendingVehicleReceipt=
 | Readonly<{ok:true;applicationId:string;status:'pending';driverEligible:false;commercialEnabled:false}>
 | Readonly<{ok:false;code:string;commercialEnabled:false}>;
export declare function validateDriverPendingVehicleDraft(draft:unknown):boolean;
export declare function submitDriverPendingVehicle(input:{
 draft:unknown;requestKey:string;
 auth:{getSession():Promise<{role:string;userId:string;accessToken:string}|null>};
 apiOrigin:string;approvedStagingHost:string;
 allowedByOwner?:boolean;liveEnabled?:boolean;
 request?:typeof fetch;timeoutMs?:number;
}):Promise<DriverPendingVehicleReceipt>;
