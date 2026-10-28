export type CommissionKind='AUTO_RIDE'|'MOTO_RIDE';
export type CommissionReceipt={serviceKind:CommissionKind;commissionBps:number;
 subsidyBps:1000;version:number;mode:'STAGING_DEMO_ONLY';productionEnabled:false};
export type CommissionOutcome={ok:boolean;code?:string;data?:CommissionReceipt};
export type OwnerCommissionGateway={
 isConfigured:()=>boolean;
 read:(service:CommissionKind)=>Promise<CommissionOutcome>;
 change:(service:CommissionKind,body:{requestKey:string;commissionBps:number})=>Promise<CommissionOutcome>;
};
export declare function createOwnerCommissionGateway(args?:{
 enabled?:boolean;contractCertified?:boolean;origin?:string;
 pinnedOrigin?:string;getSession?:()=>unknown|Promise<unknown>;
 fetchImpl?:(url:string,options:unknown)=>unknown|Promise<unknown>;
 now?:()=>number;
}):OwnerCommissionGateway;
