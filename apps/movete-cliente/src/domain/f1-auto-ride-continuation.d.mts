export type AutoContinuationResult={ok:boolean;code?:string;tripId?:string;
 deferredNavigation?:boolean;qaOnly?:true;productionEnabled?:false};
export declare function createF1AutoRideContinuation(options:{
 readSnapshot:()=>unknown;
 verifyRide:()=>Promise<{ok:boolean;tripId?:string|null;code?:string}>;
 reverifyTracking?:(()=>Promise<{ok:boolean;code?:string}>)|null;
 now?:()=>number;
 isForeground?:()=>boolean;
 onVerified?:(tripId:string)=>void;
 onFailure?:(code:string)=>void;
 onBusy?:(busy:boolean)=>void;
}):{
 tryResume:()=>Promise<AutoContinuationResult>;
 close:()=>void;
 isBusy:()=>boolean;
};
