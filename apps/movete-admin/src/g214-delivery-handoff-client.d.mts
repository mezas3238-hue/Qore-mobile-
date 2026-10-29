export type G214AdminHandoffReceipt={
 mode:'STAGING_DEMO_ONLY';viewerId:string;serviceId:string;
 serviceKind:'DELIVERY_AUTO'|'DELIVERY_MOTO';
 bookingRequestKey:string;quoteId:string;
 deliveryState:'delivered'|'disputed'|'returned';revision:number;
 courierAccepted:true;courierProofCommitted:true;
 recipientBound:boolean;recipientConfirmed:boolean;
 eligibleForSettlement:boolean;paymentAuthorized:false;
 commerciallyCertified:false;legalGate:'EXTERNAL_NOT_CERTIFIED';
 commerceOrderId:string|null;observedAt:number;expiresAt:number;
 serverPersisted:true;qaOnly:true;productionEnabled:false;
};
export function validateG214AdminHandoff(x:unknown,
 scope?:{kind?:string;id?:string;actor?:string;at?:number}):
 Readonly<G214AdminHandoffReceipt>|null;
export function createG214AdminHandoffClient(options?:{
 enabled?:boolean;ownerApproved?:boolean;contractVerified?:boolean;
 externalRuntimeVerified?:boolean;serverMfaVerified?:boolean;
 serverRbacVerified?:boolean;serverRevocationVerified?:boolean;
 origin?:string;pinnedOrigin?:string;
 getSession?:()=>Promise<unknown>;
 fetchImpl?:(url:string,options:unknown)=>Promise<Response>;
 now?:()=>number;
}):{
 isConfigured:()=>boolean;
 cancelPending:()=>void;
 read:(kind:'DELIVERY_AUTO'|'DELIVERY_MOTO',id:string)=>
 Promise<{ok:true;item:Readonly<G214AdminHandoffReceipt>}|
 {ok:false;code:string}>;
};
