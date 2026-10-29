export type G198DriverResult={ok:boolean;code?:string;retrySafe?:false;
 data?:{driverId?:string;caseId?:string;tripId?:string;
  cases?:Array<{caseId:string;tripId:string;state:string;expiresAtMs:number}>;
  messages?:Array<{messageId:string;senderRole:'passenger'|'driver';body:string;createdAtMs:number}>;
  canSend?:boolean;state?:string};
 qaOnly?:true;productionEnabled?:false};
export declare function createG198DriverLostItemsHttp(options?:{
 enabled?:boolean;ownerApproved?:boolean;postTripCertified?:boolean;
 verifiedStoppedProvider?:boolean;origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 request?:(url:string,init:unknown)=>Promise<unknown>;
 now?:()=>number;
}):Readonly<{
 isConfigured:()=>boolean;
 inbox:()=>Promise<G198DriverResult>;
 read:(caseId:string)=>Promise<G198DriverResult>;
 send:(caseId:string,requestKey:string,body:string)=>Promise<G198DriverResult>;
 productionEnabled:false;
}>;
