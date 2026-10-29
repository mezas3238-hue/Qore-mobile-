export declare const DRIVER_CUSTODY_LIVE_ENABLED:false;
export type DeliveryCustodyPhase='accepted'|'picked_up'|'delivered'|'disputed'|'returned'|'cancelled';
export type DeliveryCustodyAction='pickup'|'deliver'|'return';
export type CourierHttpScope={apiOrigin:string;approvedStagingHost?:string|null;
 allowedByOwner?:boolean;accessToken:string;deliveryId:string;
 request?:typeof fetch;timeoutMs?:number;};
export type CustodyRead=Readonly<{deliveryId:string;phase:DeliveryCustodyPhase;
 revision:number;nextEvent:DeliveryCustodyAction|null;proofVerified:boolean;
 qaOnly:true;productionEnabled:false;}>;
export type CustodyReceipt=Readonly<{deliveryId:string;event:DeliveryCustodyAction;
 receiptId:string;serverPersisted:true;qaOnly:true;productionEnabled:false;}>;
export declare function readPrivateCourierCustody(
 options:CourierHttpScope):Promise<CustodyRead>;
export declare function transitionPrivateCourierCustody(
 options:CourierHttpScope&{event:DeliveryCustodyAction;eventKey:string;
 proofRef?:string|null}):Promise<CustodyReceipt>;
