export declare const DRIVER_PRIVATE_STORAGE_LIVE_ENABLED:false;
export declare function createDriverSupabasePrivateStorageAdapter(opts:{
 storage:{from:(bucket:string)=>{upload:(
  key:string,bytes:ArrayBuffer,config:{contentType:string;upsert:false;cacheControl:'0'}
 )=>Promise<{data:{path:string}|null;error:unknown}>}};
 authAdapter:{getSession:()=>Promise<{role:string;userId:string;accessToken:string}|null>};
 allowedByOwner:true;liveEnabled?:false;
}):({bucket,objectKey,mimeType,bytes,upsert,accessToken}:{
 bucket:string;objectKey:string;mimeType:string;bytes:Uint8Array;upsert:false;
 accessToken:string;
})=>Promise<Readonly<{storedPrivately:true}>>;
