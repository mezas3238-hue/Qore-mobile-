export type NativeG263Kind='AUTO_RIDE'|'MOTO_RIDE'|'DELIVERY_AUTO'|'DELIVERY_MOTO'|'COMMERCE';
export type NativeG263Evidence={
 serviceKind:NativeG263Kind;serviceId:string;status:string;revision:number;
 requestKey:string;events:readonly {eventId:string;revision:number;status:string;at:string}[];
 eventsTruncated:boolean;totalEvents:number;linkedDeliveryId:string|null;
 financialReconciliationCertified:false;externalEndToEndCertified:false;
 expiresAt:number;
};
export type NativeG263Result={
 ok:true;qaOnly:true;productionEnabled:false;data:NativeG263Evidence
}|{ok:false;code:string};
export declare function createG263NativeAdminReader(options?:{
 enabled?:boolean;ownerApproved?:boolean;externalHttpsVerified?:boolean;
 nativePgVerified?:boolean;aal2ServerVerified?:boolean;origin?:string;
 fetchImpl?:(url:string,options:RequestInit)=>Promise<Response>;
 getSession?:()=>Promise<unknown>;now?:()=>number
}):{
 isConfigured:()=>boolean;
 read:(kind:NativeG263Kind,id:string)=>Promise<NativeG263Result>;
 cancelPending:()=>void;
};
