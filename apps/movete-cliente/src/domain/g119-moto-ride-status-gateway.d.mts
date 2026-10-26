export type G119MotoRideState={
 mode:'STAGING_DEMO_ONLY';commercialEnabled:false;ownerId:string;
 bookingKey:string;tripId:string;serviceKind:'MOTO_RIDE';
 tripState:'searching'|'accepted'|'arriving'|'in_progress'|'completed'|'cancelled';
 tripRevision:number;driverAssigned:boolean;driverIdentityExposed:false;
 gpsVerified:false;etaAvailable:false;commissionBps:number;subsidyBps:1000;
 amountGs:number;customerPaysGs:number;customerSubsidyGs:number;
 financialState:'RESERVED_QA'|'VOIDED_QA'|'COMPLETED_UNSETTLED_QA';
 pspCollected:false;serverPersisted:true;
};
export type G119Result={ok:boolean;code?:string;data?:G119MotoRideState;
 qaOnly?:true;productionEnabled?:false};
export declare function createG119MotoStatusGateway(args?:{
 enabled?:boolean;contractCertified?:boolean;stagingRuntimeVerified?:boolean;
 origin?:string;pinnedOrigin?:string;now?:()=>number;
 getSession?:()=>unknown|Promise<unknown>;
 fetchImpl?:(url:string,init:unknown)=>unknown|Promise<unknown>;
}):{isConfigured:()=>boolean;
 read:(scope:{bookingKey:string;expectedTripId:string;minimumRevision?:number})=>Promise<G119Result>;
 cancelPending:()=>void};
