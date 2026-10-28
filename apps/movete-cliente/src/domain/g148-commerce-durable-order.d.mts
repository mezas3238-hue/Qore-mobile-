import type {ClientExperience} from './client-experience.mjs';
export type G148Row={version:1;ownerId:string;requestKey:string;branchId:string;
 vehicleKind:'AUTO'|'MOTO';createdAt:number;cancelKey:string|null};
export type G148Receipt={orderId:string;requestKey:string;branchId:string;
 status?:string;revision?:number;subtotalPyg?:number;paymentConfirmed:false};
export type G148Result={ok:boolean;code?:string;receipt?:G148Receipt;
 requestKey?:string;cancellationPending?:boolean;alreadyCancelled?:boolean;
 qaOnly:true;paymentEnabled:false};
export declare function createG148CommerceDurableOrder(options?:{
 store:{
  read:(ownerId:string)=>Promise<G148Row|null>;
  write:(row:G148Row)=>Promise<void>;
  markCancel:(ownerId:string,requestKey:string,cancelKey:string)=>Promise<void>;
  clearMatching:(ownerId:string,requestKey:string)=>Promise<boolean>;
 }|null;
 api:ClientExperience;
 now?:()=>number;
}):Readonly<{
 isConfigured:()=>boolean;
 reserve:(body:{requestKey:string;branchId:string;catalogVersion:number;
  vehicleKind:'AUTO'|'MOTO';items:{itemId:string;quantity:number}[]})=>Promise<G148Result>;
 recover:()=>Promise<G148Result>;
 cancel:(cancelKey:string)=>Promise<G148Result>;
 releaseCancelled:()=>Promise<G148Result>;
}>;
