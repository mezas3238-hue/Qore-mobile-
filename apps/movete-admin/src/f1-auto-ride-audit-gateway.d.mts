export type F1AdminTripAudit={
 tripId:string;routeId:string;quoteId:string;bookingRequestKey:string;
 service:'economico'|'confort'|'xl';amountGs:number;currency:'PYG';
 fareVersion:string;revision:number;
 status:'searching'|'assigned'|'arriving'|'in_progress'|'completed'|'cancelled';
 assignmentPersisted:boolean;observedAt:number;expiresAt:number;
 qaOnly:true;productionEnabled:false;
};
export type F1AdminAuditGateway={
 isConfigured():boolean;read(tripId:string):Promise<{
  ok:boolean;code?:string;status:number;data?:F1AdminTripAudit
 }>;
 cancelPending():void;productionEnabled:false;
};
export declare function createF1AutoRideAuditGateway(options?:{
 enabled?:boolean;contractCertified?:boolean;stagingRuntimeVerified?:boolean;
 origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 fetchImpl?:(url:string,request:unknown)=>unknown|Promise<unknown>;
 onSessionInvalid?:()=>void;now?:()=>number;timeoutMs?:number;maxBytes?:number;
}):F1AdminAuditGateway;
