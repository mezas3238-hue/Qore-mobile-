export declare const DRIVER_CHAT_HTTPS_LIVE_ENABLED:false;
export type DriverChatHttpAnswer=Readonly<{
 status:number;
 body:unknown;
}>;
export type DriverChatHttpsSessionScope={
 bearer:string;
};
export type DriverChatHttpsHistoryScope=DriverChatHttpsSessionScope&{
 serviceKind:'RIDE'|'DELIVERY'|'MERCHANT_ORDER';
 serviceId:string;
 conversationId:string;
 cursor?:string|null;
 limit?:number;
};
export type DriverChatHttpsSendScope=Omit<DriverChatHttpsHistoryScope,'cursor'|'limit'>&{
 requestKey:string;body:string;
};
export type DriverChatHttpsVisibleScope=DriverChatHttpsSessionScope&{
 conversationId:string;messageId:string;marker:string;
};
export type DriverChatHttpsStagingOptions=Readonly<{
 apiOrigin:string;
 approvedStagingHost:string;
 /** Must only be enabled by a separately authorized STAGING composition. */
 allowedByOwner:true;
 liveEnabled?:false;
 request:typeof fetch;
 /** Cryptographically strong UUIDv4 provider from native OS/SDK, never Math.random. */
 makeRequestKey:()=>string|Promise<string>;
 /** May only obtain independent telematics/driver-motion evidence. */
 verifyStopped:()=>Promise<{
  vehicleStopped:boolean;
  source:string;
  observedAtMs:number;
 }>;
 now?:()=>number;
 timeoutMs?:number;
}>;
export type DriverChatHttpsStagingAdapters=Readonly<{
 readInbox:({bearer,cursor,limit}:{
  bearer:string;cursor?:string|null;limit?:number;
 })=>Promise<DriverChatHttpAnswer>;
 readHistory:(request:DriverChatHttpsHistoryScope)=>Promise<DriverChatHttpAnswer>;
 send:(request:DriverChatHttpsSendScope)=>Promise<DriverChatHttpAnswer>;
 reconcile:(request:DriverChatHttpsSendScope)=>Promise<DriverChatHttpAnswer>;
 markVisible:(request:DriverChatHttpsVisibleScope)=>Promise<DriverChatHttpAnswer>;
 makeRequestKey:()=>Promise<string>;
 verifyStopped:()=>Promise<{
  vehicleStopped:boolean;source:string;observedAtMs:number;
 }>;
}>;
export declare function createDriverChatHttpsStagingAdapters(
 opts:DriverChatHttpsStagingOptions
):DriverChatHttpsStagingAdapters;
