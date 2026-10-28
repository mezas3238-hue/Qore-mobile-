export type F1AutoQuote={quoteId:string;amountGs:number;currency:'PYG';
 fareVersion:string;expiresAt:number};
export type F1AutoSubsidy={quoteId:string;campaignId:string;originalFareGs:number;
 customerSubsidyGs:number;customerPaysGs:number;commissionBps:number;
 subsidyBps:number;platformRetainsGs:number;fareVersion:string;expiresAt:number};
export type F1AutoPrequoteSnapshot={phase:string;quote:F1AutoQuote|null;
 quoteAvailable:boolean;bookingAvailable:boolean;canAccept:boolean;
 canReserve:boolean;requiresReconciliation:boolean;
 subsidyRequired?:boolean;subsidyAvailable?:boolean;subsidyLoading?:boolean;
 subsidy?:F1AutoSubsidy|null};
export type F1AutoQuoteScreen={
 phase:string;quote:F1AutoQuote|null;amountLabel:string|null;
 subsidyRequired:boolean;subsidy:F1AutoSubsidy|null;canPreviewSubsidy:boolean;
 canEditRoute:boolean;canAccept:boolean;canReserve:boolean;
 canReconcile:boolean;canDiscard:boolean;locked:boolean;productionEnabled:false};
export declare function projectAutoPrequoteScreen(options?:{
 prequote?:F1AutoPrequoteSnapshot|null;authenticated?:boolean;
 mutationPhase?:string;now?:number
}):F1AutoQuoteScreen;
