/**
 * Opt-in private Supabase Storage adapter for Driver evidence. Uses the same
 * independently verified Auth SDK as Driver runtime. No service_role keys,
 * public buckets, presigned URLs, overwrite or bundled connection defaults.
 */
export const DRIVER_PRIVATE_STORAGE_LIVE_ENABLED=false;
const BUCKET='mobility-staging-driver-evidence';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','habilitacion','seguro','inspeccion','rostro_selfie']);
export function createDriverSupabasePrivateStorageAdapter({
 storage,authAdapter,allowedByOwner=false,liveEnabled=false
}={}){
 if(allowedByOwner!==true||liveEnabled!==false||
   typeof storage?.from!=='function'||
   typeof authAdapter?.getSession!=='function')
  throw Error('Private Driver storage requires authorized SDK and session');
 return async({bucket,objectKey,mimeType,bytes,upsert,accessToken}={})=>{
  if(bucket!==BUCKET||upsert!==false||
    !['image/jpeg','image/png'].includes(mimeType)||
    !(bytes instanceof Uint8Array)||bytes.byteLength<20||
    bytes.byteLength>5242880||
    typeof objectKey!=='string'||objectKey.length>180||
    typeof accessToken!=='string'||accessToken.length<20)
   throw Error('PRIVATE_STORAGE_REQUEST_INVALID');
  const match=/^([0-9a-f-]{36})\/([a-z_]+)-([A-Za-z0-9_-]{12,80})\.(jpg|jpeg|png)$/.exec(objectKey);
  if(!match||!UUID.test(match[1])||!KINDS.has(match[2])||
    (mimeType==='image/png'&&match[4]!=='png')||
    (mimeType==='image/jpeg'&&!['jpg','jpeg'].includes(match[4])))
   throw Error('PRIVATE_STORAGE_PATH_INVALID');
  const session=await authAdapter.getSession().catch(()=>null);
  if(session?.role!=='driver'||session.userId!==match[1]||
    session.accessToken!==accessToken)
   throw Error('PRIVATE_STORAGE_SESSION_CHANGED');
  let data,error;
  try{
   const response=await storage.from(BUCKET).upload(objectKey,
    bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),
    {contentType:mimeType,upsert:false,cacheControl:'0'});
   data=response?.data;error=response?.error;
  }catch{throw Error('PRIVATE_STORAGE_UPLOAD_UNCONFIRMED');}
  if(error||data?.path!==objectKey)
   throw Error('PRIVATE_STORAGE_UPLOAD_UNCONFIRMED');
  return Object.freeze({storedPrivately:true});
 };
}
