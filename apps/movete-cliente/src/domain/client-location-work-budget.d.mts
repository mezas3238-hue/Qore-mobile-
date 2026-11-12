export type ClientLocationWorkResult=Readonly<{
 ok:true
}|Readonly<{ok:false;code:string}>;
export type ClientLocationBudget=Readonly<{
 beginGps:(args?:{manual?:boolean})=>ClientLocationWorkResult;
 beginDestination:(query:string)=>ClientLocationWorkResult;
 end:(kind:'gps'|'destination')=>boolean;
 busy:()=>boolean;
}>;
export declare function createClientLocationWorkBudget(args?:{
 now?:()=>number;gpsIntervalMs?:number;destinationIntervalMs?:number;
}):ClientLocationBudget;
