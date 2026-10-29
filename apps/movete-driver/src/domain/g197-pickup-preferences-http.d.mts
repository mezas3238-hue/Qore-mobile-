export type G197Service='RIDE'|'MOTO_RIDE'|'DELIVERY'|'MERCHANT_ORDER';
export type G197Preference={serviceKind:G197Service;maximumRoadMeters:number;revision:number};
export type G197Response={ok:boolean;code?:string;data?:{
 preferences?:G197Preference[];driverId:string;serviceKind?:G197Service;
 maximumRoadMeters?:number;revision?:number;
};qaOnly?:true;productionEnabled?:false};
export declare function createG197DriverPickupPreferencesHttp(options?:{
 enabled?:boolean;ownerApproved?:boolean;serverRoleVerified?:boolean;
 roadEnforcementVerified?:boolean;origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 request?:(url:string,options:unknown)=>Promise<unknown>;
 timeoutMs?:number;now?:()=>number;
}):Readonly<{
 isConfigured:()=>boolean;
 read:()=>Promise<G197Response>;
 update:(serviceKind:G197Service,maximumRoadMeters:number,expectedRevision:number)=>Promise<G197Response>;
 productionEnabled:false;
}>;
