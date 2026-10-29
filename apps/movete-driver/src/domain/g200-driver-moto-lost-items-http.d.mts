export type G200DriverResult={ok:boolean;code?:string;retrySafe?:false;
 data?:{driverId?:string;caseId?:string;tripId?:string;
  cases?:Array<{caseId:string;tripId:string;state:string;expiresAtMs:number}>;
  messages?:Array<{messageId:string;senderRole:'passenger'|'driver';body:string;createdAtMs:number}>;
  canSend?:boolean;state?:string};
 qaOnly?:true;productionEnabled?:false};
export declare function createG200DriverMotoLostItemsHttp(options?:{
 enabled?:boolean;ownerApproved?:boolean;postTripCertified?:boolean;
 verifiedStoppedProvider?:boolean;origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 request?:(url:string,init:unknown)=>Promise<unknown>;
 now?:()=>number;
}):Readonly<{
 isConfigured:()=>boolean;
 inbox:()=>Promise<G200DriverResult>;
 read:(caseId:string)=>Promise<G200DriverResult>;
 send:(caseId:string,requestKey:string,body:string)=>Promise<G200DriverResult>;
 close:(caseId:string,block:boolean)=>Promise<G200DriverResult>;
 productionEnabled:false;
}>;
