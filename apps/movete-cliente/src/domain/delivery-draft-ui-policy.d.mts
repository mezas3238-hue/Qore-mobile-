export type DeliveryUiResult=Readonly<{ok:false;code:string}>|
 Readonly<{ok:true;editable:boolean;canReview:boolean;canPrepare:boolean;
  canDiscard:boolean;status:string;vehicleKind:'MOTO'|'AUTO';
  requestSent:false;courierAssigned:false;paymentCaptured:false;
  serverPriceVerified:false}>;
export declare function projectDeliveryDraftUi(options?:{
 // Accept untrusted public snapshot strings; the runtime strictly validates them.
 phase?:string;operation?:string|null;
 authenticated?:boolean;validated?:boolean;restricted?:boolean;
 vehicleKind?:'MOTO'|'AUTO';
}):DeliveryUiResult;
