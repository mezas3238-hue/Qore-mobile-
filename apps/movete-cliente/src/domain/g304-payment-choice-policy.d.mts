export type ClientPaymentInput=Readonly<{
 subjectKind:'RIDE'|'DELIVERY'|'MERCHANT_ORDER';
 fareMode:'AUTO'|'MOTO'|'DELIVERY'|'MERCHANT_DELIVERY';
 cardAvailable:boolean;cashAvailable:boolean;
 bankTransferAvailable:boolean;qrAvailable:boolean;
 commercePrepayBackendCertified:boolean;
}>;
export type ClientPaymentChoice='CASH'|'CARD'|'BANK_TRANSFER'|'QR';
export declare const CLIENT_COMMERCE_CASH_ENABLED:false;
export declare function chooseClientPaymentOptions(input:ClientPaymentInput):
 Readonly<{ok:true;options:readonly ClientPaymentChoice[];
 prepaidRequired:boolean;cashAllowed:boolean;canSubmitOrderWithoutVerifiedPayment:false}>|
 Readonly<{ok:false;code:string;options:readonly never[]}>;
export declare function validateClientPaymentChoice(input:ClientPaymentInput,method:string):
 Readonly<{ok:true;method:ClientPaymentChoice;prepaidRequired:boolean;
 requiresIndependentServerProof:boolean;paymentExecuted:false;orderReleased:false}>|
 Readonly<{ok:false;code:string;options:readonly never[]}>;
