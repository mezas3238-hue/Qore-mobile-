export type NativeDriverPublicConfig={ok:false}|{ok:true;url:string;publishableKey:string};
export declare function verifyNativeDriverConfig(
 options?:{url?:string;publishableKey?:string}
):NativeDriverPublicConfig;
