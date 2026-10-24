export type MerchantSupportReasonCode='MISSING_ITEM'|'WRONG_ITEM'|'DAMAGED_ITEM'|'LATE_DELIVERY'|'PRICE_DISPUTE'|'SAFETY_CONCERN';
export type MerchantSupportCategory='LOSS'|'QUALITY'|'DISPUTE'|'SAFETY';
export type MerchantSupportSeverity='LOW'|'MEDIUM'|'HIGH';
export interface MerchantSupportActor {role:'passenger';subject:string;sessionRevision:number}
export interface MerchantSupportReason {readonly code:MerchantSupportReasonCode;readonly label:string;readonly category:MerchantSupportCategory}
export interface MerchantSupportSnapshot {
 readonly ok:boolean;readonly code?:string;readonly orderId:string;
 readonly reason:MerchantSupportReasonCode|null;
 readonly severity:MerchantSupportSeverity|null;readonly canReview:boolean;
 readonly localOnly:true;readonly caseCreated:false;
 readonly operatorNotified:false;readonly sosDispatched:false;
 readonly merchantContacted?:false;
}
export interface MerchantSupportIntent {
 readonly subjectKind:'MERCHANT_ORDER';readonly subjectId:string;
 readonly category:MerchantSupportCategory;readonly severity:MerchantSupportSeverity;
}
export type MerchantSupportReview=Readonly<{
 ok:boolean;code?:string;localOnly?:true;intent?:MerchantSupportIntent;
 caseCreated:false;operatorNotified:false;merchantContacted:false;
 sosDispatched:false;ownershipVerified?:false;submitted?:false;qaOnly?:true;
 customerContacted?:false
}>;
export type MerchantSupportUpdate=
 |{orderId:string}|{reason:MerchantSupportReasonCode|null}
 |{severity:MerchantSupportSeverity|null};
export declare const MERCHANT_SUPPORT_REASONS:readonly MerchantSupportReason[];
export declare function createMerchantSupportGuide():{
 snapshot(actor:MerchantSupportActor|null):MerchantSupportSnapshot;
 update(actor:MerchantSupportActor|null,patch:MerchantSupportUpdate):MerchantSupportSnapshot|MerchantSupportReview;
 review(actor:MerchantSupportActor|null):MerchantSupportReview;
 clear():void;dispose():void;
};
