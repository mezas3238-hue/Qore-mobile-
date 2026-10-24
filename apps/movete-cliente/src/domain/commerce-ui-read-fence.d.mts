export type CommerceUiReadResult=Readonly<{ok:true}>|Readonly<{ok:false;code:string}>;
export declare function createCommerceUiReadFence():Readonly<{
 run:<T>(execute:()=>Promise<T>|T,callbacks?:{
  onResult?:(result:T)=>void;onError?:()=>void;onFinish?:()=>void;
 })=>Promise<CommerceUiReadResult>;
 isBusy:()=>boolean;
 invalidate:()=>void;
 dispose:()=>void;
}>;
