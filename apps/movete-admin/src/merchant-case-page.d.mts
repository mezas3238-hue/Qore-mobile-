export type MerchantCaseReason=
 'MISSING_ITEM'|'WRONG_ITEM'|'DAMAGED_ITEM'|'LATE_DELIVERY'|
 'PRICE_DISPUTE'|'SAFETY_CONCERN';
export type MerchantCaseSeverity='LOW'|'MEDIUM'|'HIGH';
export type MerchantCaseState='RECEIVED_QA'|'CLASSIFIED_QA'|'REVIEW_QA'|'CLOSED_QA';
export type MerchantCaseActor=Readonly<{
 role:'admin';subject:string;mfaVerified:true;authRevision:number
}>;
export type MerchantCaseItem=Readonly<{
 caseId:string;subjectKind:'MERCHANT_ORDER';reason:MerchantCaseReason;
 severity:MerchantCaseSeverity;state:MerchantCaseState;createdAt:number;
 updatedAt:number;revision:number
}>;
export type MerchantCasePageDto=Readonly<{
 scope:'ADMIN_MERCHANT_CASES_QA_PAGE';qaOnly:true;generatedAt:number;
 expiresAt:number;revision:number;hasGlobalTotal:false;
 notificationsEnabled:false;operationsEnabled:false;
 nextCursor:string|null;items:readonly MerchantCaseItem[]
}>;
export type MerchantCaseRow=Omit<MerchantCaseItem,'subjectKind'>;
export type MerchantCasePageSuccess=Readonly<{
 ok:true;scope:'VISIBLE_CERTIFIED_QA_PAGE_ONLY';revision:number;
 expiresAt:number;nextCursor:string|null;items:readonly MerchantCaseRow[];
 counts:Readonly<{visible:number;open:number;closedQa:number;highOpen:number}>;
 totalKnown:false;operationsEnabled:false;notificationsEnabled:false;
 operatorAssigned:false;emergencyDispatchEnabled:false;contactConfirmed:false;
 caseResolvedInProduction:false
}>;
export type MerchantCasePageFail=Readonly<{
 ok:false;code:string;items:readonly never[];totalKnown:false;
 operationsEnabled:false;notificationsEnabled:false;operatorAssigned:false;
 emergencyDispatchEnabled:false
}>;
export type MerchantCasePageResult=MerchantCasePageSuccess|MerchantCasePageFail;
export declare function projectMerchantCasePage(raw:unknown,options?:{
 actor?:MerchantCaseActor|null;certified?:boolean;now?:number
}):MerchantCasePageResult;
export declare function createMerchantCasePageStore(options?:{now?:()=>number}):Readonly<{
 update:(raw:unknown,options:{actor:MerchantCaseActor|null;
  certified?:boolean})=>MerchantCasePageResult;
 snapshot:(options:{actor:MerchantCaseActor|null;
  certified?:boolean})=>MerchantCasePageSuccess|null;
 clear:()=>void
}>;
