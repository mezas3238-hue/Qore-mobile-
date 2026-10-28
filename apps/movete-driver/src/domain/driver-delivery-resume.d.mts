export type DriverDeliveryResumeResult=Readonly<{
 ok:boolean;code?:string;deliveryId?:string;
 saved?:boolean;status?:string;revision?:number;
}>;
export declare function createDriverDeliveryResume(config:{
 getSession:()=>Promise<unknown>;
 readAssignment:(id:string,actor:{role:'driver';userId:string;accessToken:string})=>Promise<unknown>;
 storage?:null|{get:(key:string)=>Promise<string|null>;
 put:(key:string,value:string)=>Promise<void>;
 del:(key:string)=>Promise<void>};
 now?:()=>number;
}):Readonly<{
 remember:(id:string)=>Promise<DriverDeliveryResumeResult>;
 resume:()=>Promise<DriverDeliveryResumeResult>;
 clear:()=>Promise<void>;
}>;
export declare const DRIVER_DELIVERY_RESUME_LIVE_ENABLED:false;
