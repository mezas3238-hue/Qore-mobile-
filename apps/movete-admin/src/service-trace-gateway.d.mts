export type TraceServiceKind='AUTO_RIDE'|'MOTO_RIDE'|'DELIVERY_AUTO'|'DELIVERY_MOTO'|'COMMERCE';
export type ServiceTrace=Readonly<{
 serviceKind:TraceServiceKind;serviceId:string;quoteId:string|null;
 bookingRequestKey:string;status:string;revision:number;
 observedAt:number;expiresAt:number;serverPersistedReported:true;
 qaOnly:true;productionEnabled:false;
 assignment:{state:string;legalGate:string};
 events:readonly Readonly<{eventId:string;serviceId:string;
  sequence:number;status:string;at:number}>[];
 ledger:null|Readonly<{serviceId:string;currency:'PYG';
  grossGs:number;platformCommissionGs:number;customerSubsidyGs:number;
  driverPayoutGs:number;reconciliationStatus:string}>;
}>;
export declare const TRACE_SERVICE_KINDS:readonly TraceServiceKind[];
export declare function createServiceTraceGateway(options?:{
 enabled?:boolean;contractCertified?:boolean;origin?:string;
 pinnedOrigin?:string;getSession?:()=>unknown|Promise<unknown>;
 fetchImpl?:(url:string,request:unknown)=>unknown|Promise<unknown>;
 onSessionInvalid?:()=>void;now?:()=>number;timeoutMs?:number;maxBytes?:number;
}):Readonly<{
 isConfigured:()=>boolean;cancelPending:()=>void;
 read:(kind:TraceServiceKind,id:string)=>Promise<
 {ok:false;code:string}|{ok:true;data:ServiceTrace}>;
}>;
export declare function createServiceTraceQaOptions(options?:{
 origin?:string;pinnedOrigin?:string;ownerApproved?:boolean;
 externalHttpsVerified?:boolean;contractVerified?:boolean;
 postgresVerified?:boolean;serverMfaVerified?:boolean;
 serverRbacVerified?:boolean;serverRevocationVerified?:boolean;
 fetchImpl?:(url:string,request:unknown)=>unknown|Promise<unknown>;
}):{
 enabled:true;contractCertified:true;origin:string;pinnedOrigin:string;
 fetchImpl:(url:string,request:unknown)=>unknown|Promise<unknown>;
}|null;
