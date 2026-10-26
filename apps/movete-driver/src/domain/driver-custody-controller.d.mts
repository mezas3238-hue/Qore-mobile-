import type {CustodyRead,CustodyReceipt,DeliveryCustodyAction,
 DeliveryCustodyPhase} from './driver-custody-http.mjs';
export declare const DRIVER_CUSTODY_CONTROLLER_LIVE_ENABLED:false;
export type DriverCustodySnapshot=Readonly<{
 phase:'signed-out'|'authorization-required'|'ready'|'loading'|'offline'|
 'unverified'|'active'|'terminal'|'submitting'|'uncertain';
 deliveryId:string|null;status:DeliveryCustodyPhase|null;
 revision:number|null;nextEvent:DeliveryCustodyAction|null;
 uncertain:boolean;proofVerified:boolean;qaOnly:true;productionEnabled:false;
}>;
export type DriverCustodyAdapters=Readonly<{
 readStatus:(scope:{accessToken:string;deliveryId:string})=>Promise<CustodyRead>;
 transition:(scope:{accessToken:string;deliveryId:string;
 event:DeliveryCustodyAction;eventKey:string;proofRef?:string})=>
 Promise<CustodyReceipt>;
 makeRequestKey:()=>Promise<string>|string;
 obtainVerifiedProof?:((scope:{accessToken:string;deliveryId:string;actorId:string})=>
 Promise<{deliveryId:string;actorId:string;proofRef:string;verifiedByServer:true}>)|null;
 liveEnabled?:false;
}>;
export type DriverCustodyController=Readonly<{
 current:()=>DriverCustodySnapshot;
 subscribe:(fn:(s:DriverCustodySnapshot)=>void)=>()=>void;
 clear:()=>DriverCustodySnapshot;
 setSession:(session:{role:'driver';userId:string;accessToken:string}|null)=>
 DriverCustodySnapshot;
 open:(deliveryId:string)=>Promise<DriverCustodySnapshot>;
 refresh:()=>Promise<DriverCustodySnapshot>;
 poll:()=>Promise<DriverCustodySnapshot>;
 advance:()=>Promise<DriverCustodySnapshot>;
}>;
export declare function createDriverCustodyController(
 options:DriverCustodyAdapters):DriverCustodyController;
