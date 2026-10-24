export declare const DRIVER_INBOX_LIVE_ENABLED:false;
export type DriverOffer=Readonly<{
 kind:'AUTO_RIDE'|'DELIVERY';
 offerId:string;
 serviceId:string;
 expiresAtMs:number;
}>;
export type DriverInboxReadOptions={
 apiOrigin:string;
 accessToken:string;
 approvedStagingHost?:string|null;
 allowedByOwner?:boolean;
 request?:(url:string,init:RequestInit)=>Promise<{status:number;json():Promise<unknown>}>;
 now?:()=>number;
};
export declare function readDriverPrivateInbox(
 options:DriverInboxReadOptions
):Promise<ReadonlyArray<DriverOffer>>;
