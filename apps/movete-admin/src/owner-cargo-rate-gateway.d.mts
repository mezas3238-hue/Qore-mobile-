export type CargoKind='AUTO'|'MOTO';
export type CargoRate={vehicleKind:CargoKind;cargoZone:string;ruleId:string;
 ruleVersion:string;version:number;basePyg:number;perKmPyg:number;
 perMinutePyg:number;minimumPyg:number;commissionBps:number;
 active:true;validUntil:string;mode:'STAGING_DEMO_ONLY';liveEnabled:false;
 passengerSubsidyPolicyApplicable:false};
export type CargoDraft={requestKey:string;basePyg:number;perKmPyg:number;
 perMinutePyg:number;minimumPyg:number;commissionBps:number;durationDays:number};
export type CargoOutcome={ok:boolean;code?:string;data?:CargoRate};
export declare function createOwnerCargoRateGateway(args?:{
 enabled?:boolean;contractCertified?:boolean;origin?:string;
 pinnedOrigin?:string;getSession?:()=>unknown|Promise<unknown>;
 fetchImpl?:(url:string,options:unknown)=>unknown|Promise<unknown>;
 now?:()=>number;timeoutMs?:number;maxBytes?:number;
}):Readonly<{isConfigured:()=>boolean;
 read:(kind:CargoKind,zone:string)=>Promise<CargoOutcome>;
 change:(kind:CargoKind,zone:string,draft:CargoDraft)=>Promise<CargoOutcome>;
}>;
