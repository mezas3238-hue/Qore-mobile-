export type DeliveryUiResult=Readonly<{ok:false;code:string}>|
 Readonly<{ok:true;editable:boolean;canReview:boolean;canPrepare:boolean;
  canDiscard:boolean;status:string;vehicleKind:'MOTO'|'AUTO';
  requestSent:false;courierAssigned:false;paymentCaptured:false;
  serverPriceVerified:false}>;
export declare function projectDeliveryDraftUi(options?:{
 phase?:'idle'|'ready'|'in_flight'|'retryable'|'acknowledged'|'failed';
 operation?:'rideRequest'|'deliveryRequest'|'fareQuote'|'paymentAuthorize'|null;
 authenticated?:boolean;validated?:boolean;restricted?:boolean;
 vehicleKind?:'MOTO'|'AUTO';
}):DeliveryUiResult;
