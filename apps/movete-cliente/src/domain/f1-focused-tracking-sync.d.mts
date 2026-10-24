import type {ClientSnapshot,ClientResult} from './client-experience.mjs';

/** F1 Passenger QA only, foreground route focused, never production dispatch. */
export declare function createF1FocusedTrackingSync(options:{
 readSnapshot:()=>ClientSnapshot;
 syncTracking:()=>Promise<ClientResult>;
 schedule?:(fn:()=>void,ms:number)=>unknown;
 cancel?:(timer:unknown)=>void;
 intervalMs?:number;
}):Readonly<{
 start:()=>{ok:boolean;code?:string};
 stop:()=>void;
 refresh:()=>Promise<{ok:boolean;code?:string}>;
 isActive:()=>boolean;
}>;
