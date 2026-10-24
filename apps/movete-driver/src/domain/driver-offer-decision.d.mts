export declare const DRIVER_OFFER_DECISIONS_LIVE_ENABLED:false;
export type PrivateDriverOfferKind='AUTO_RIDE'|'DELIVERY';
export type DriverOfferDecisionAction='accept'|'decline';
export type DriverOfferDecision=Readonly<{
 kind:PrivateDriverOfferKind;
 action:DriverOfferDecisionAction;
 outcome:'accepted'|'declined';
 receiptId:string;
 liveEnabled:false;
 pushDelivered:false;
}>;
export type DriverOfferDecisionOptions={
 apiOrigin:string;
 accessToken:string;
 approvedStagingHost?:string|null;
 allowedByOwner?:boolean;
 kind:PrivateDriverOfferKind;
 offerId:string;
 /** Stable UUID: reuse this exact key after a timeout; do not create on every retry. */
 requestKey:string;
 action:DriverOfferDecisionAction;
 request?:(url:string,init:RequestInit)=>Promise<{status:number;json():Promise<unknown>}>;
};
export declare function decidePrivateDriverOffer(
 options:DriverOfferDecisionOptions
):Promise<DriverOfferDecision>;
