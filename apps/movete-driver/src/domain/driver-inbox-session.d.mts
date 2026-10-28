import type {DriverOffer} from './driver-inbox.mjs';
export declare const DRIVER_SESSION_LIVE_ENABLED:false;
export type DriverInboxPhase='signed-out'|'authorization-required'|'ready'|'loading'|'connected'|'offline';
export type DriverSessionInput=Readonly<{
 role:'driver';userId:string;accessToken:string;
}>;
export type DriverInboxState=Readonly<{
 phase:DriverInboxPhase;
 offers:ReadonlyArray<DriverOffer>;
 liveEnabled:false;
}>;
export declare function createDriverInboxSessionController(options:{
 readInbox:(request:{accessToken:string})=>Promise<ReadonlyArray<DriverOffer>>;
}):Readonly<{
 current():DriverInboxState;
 setSession(input:DriverSessionInput|null):DriverInboxState;
 clear():DriverInboxState;
 refresh():Promise<DriverInboxState>;
}>;
