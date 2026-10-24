export declare const DRIVER_OFFER_ACTIONS_LIVE_ENABLED:false;
export type OfferKind='AUTO_RIDE'|'DELIVERY';
export type OfferAction='accept'|'decline';
export type OfferDecisionPhase='sending'|'confirmed'|'uncertain'|'blocked';
export type DriverOfferDecisionStatus=Readonly<{
 offerId:string;kind:OfferKind;action:OfferAction;phase:OfferDecisionPhase;
}>;
export type DriverOfferActionsSnapshot=Readonly<{
 phase:'signed-out'|'authorization-required'|'ready';
 offers:ReadonlyArray<{
  offerId:string;serviceId:string;kind:OfferKind;expiresAtMs:number;
 }>;
 decisions:ReadonlyArray<DriverOfferDecisionStatus>;
 busy:boolean;qaOnly:true;productionEnabled:false;
}>;
export type DriverOfferActionsAdapters=Readonly<{
 decide:(params:{accessToken:string;kind:OfferKind;offerId:string;
  requestKey:string;action:OfferAction})=>Promise<{
   kind:OfferKind;action:OfferAction;outcome:'accepted'|'declined';
   receiptId:string;liveEnabled:false;pushDelivered:false;
  }>;
 reconcile?:(params:{accessToken:string;kind:OfferKind;offerId:string;
  requestKey:string;action:OfferAction})=>Promise<{
   kind:OfferKind;action:OfferAction;outcome:'accepted'|'declined';
   receiptId:string;serverPersisted:true;liveEnabled:false;pushDelivered:false;
  }>;
 makeRequestKey:()=>string|Promise<string>;
 now?:()=>number;liveEnabled?:false;
}>;
export type DriverOfferActionsController=Readonly<{
 current:()=>DriverOfferActionsSnapshot;
 subscribe:(cb:(s:DriverOfferActionsSnapshot)=>void)=>()=>void;
 clear:()=>DriverOfferActionsSnapshot;
 setSession:(s:{role:'driver';userId:string;accessToken:string}|null)=>
  DriverOfferActionsSnapshot;
 setOffers:(offers:ReadonlyArray<{kind:OfferKind;offerId:string;
  serviceId:string;expiresAtMs:number}>,
  options?:{currentLicenseApproved?:boolean})=>DriverOfferActionsSnapshot;
 decide:(request:{offerId:string;action:OfferAction})=>Promise<DriverOfferActionsSnapshot>;
 reconcilePending:(offerId:string)=>Promise<DriverOfferActionsSnapshot>;
}>;
export declare function createDriverOfferActionsController(
 opts:DriverOfferActionsAdapters
):DriverOfferActionsController;
