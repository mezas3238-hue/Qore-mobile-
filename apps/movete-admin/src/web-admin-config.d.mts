export type WebAdminPublicConfig={ok:false}|{ok:true;url:string;publishableKey:string};
export declare function verifyWebAdminConfig(options?:{url?:string;publishableKey?:string}):WebAdminPublicConfig;
