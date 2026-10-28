export type F1ReachabilityResult={
 readonly ok:boolean;
 readonly code:string;
 readonly state?:'PROCESS_UP_ONLY';
 readonly commercialReady:false;
};
export type F1StagingConnectivityProbe={
 isConfigured:()=>boolean;
 check:()=>Promise<F1ReachabilityResult>;
};
export declare function createF1StagingConnectivityProbe(options?:{
 origin?:string;
 pinnedOrigin?:string;
 fetchImpl?:(url:string,options:unknown)=>Promise<unknown>;
 now?:()=>number;
 timeoutMs?:number;
}):F1StagingConnectivityProbe;
