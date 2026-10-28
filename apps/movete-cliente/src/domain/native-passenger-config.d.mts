export type PublicNativeAuthConfig=
 |{ok:false;reason:'NATIVE_AUTH_CONFIG_UNAVAILABLE'}
 |{ok:true;url:string;publishableKey:string};
export declare function verifyNativePassengerConfig(
 options?:{url?:string;publishableKey?:string}
):PublicNativeAuthConfig;
