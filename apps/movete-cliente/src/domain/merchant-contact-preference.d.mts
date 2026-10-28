export type MerchantContactRecipient='MERCHANT'|'SUPPORT';
export type MerchantContactCategory='LOSS'|'QUALITY'|'DISPUTE'|'SAFETY';
export type MerchantContactSeverity='LOW'|'MEDIUM'|'HIGH';
export interface MerchantContactActor {role:'passenger';subject:string;sessionRevision:number}
export interface MerchantGuideReview {
 ok:true;localOnly:true;submitted:false;caseCreated:false;
 operatorNotified:false;merchantContacted:false;ownershipVerified:false;
 sosDispatched:false;
 intent:{subjectKind:'MERCHANT_ORDER';subjectId:string;
 category:MerchantContactCategory;severity:MerchantContactSeverity}
}
export interface ContactPreferenceResult {
 readonly ok:boolean;readonly code?:string;
 readonly recipient?:MerchantContactRecipient|null;readonly consent?:boolean;
 readonly allowedRecipients?:readonly MerchantContactRecipient[];
 readonly readyToReview?:boolean;readonly localOnly:true;
 readonly contactAttempted:false;readonly caseCreated:false;
 readonly merchantNotified:false;readonly supportNotified:false;
 readonly sendEnabled:false;readonly channelAuthorized?:false;
 readonly messageStored?:false;readonly serverConsentRecorded?:false;
 readonly mode?:'IN_APP_ONLY';readonly consentToPrepare?:true;
 readonly orderId?:string;readonly category?:MerchantContactCategory;
 readonly severity?:MerchantContactSeverity;readonly ownershipVerified?:false;
 readonly submitted?:false
}
export declare function createMerchantContactPreference(options?:{now?:()=>number}):{
 snapshot(guide:unknown,actor:MerchantContactActor):ContactPreferenceResult;
 choose(guide:unknown,actor:MerchantContactActor,
  recipient:MerchantContactRecipient):ContactPreferenceResult;
 setConsent(guide:unknown,actor:MerchantContactActor,
  consent:boolean):ContactPreferenceResult;
 review(guide:unknown,actor:MerchantContactActor):ContactPreferenceResult;
 clear():void;dispose():void;
};
