/**
 * G271: authenticate ONLY the STAGING server-side Supabase API key by
 * performing a read-only GET of PostgREST's schema discovery endpoint.
 * Success proves key acceptance, NOT Auth session, RLS, real trip or payment.
 * The API key is NEVER logged, returned, sent in a query string or used as
 * a bearer user JWT. No API response body is retained.
 */
const REF='mrjzxftsdxzepzbcuids';
const MODERN=/^sb_secret_[A-Za-z0-9_-]{20,}$/;
const B64=/^[A-Za-z0-9_-]+$/;
const fail=()=>Object.freeze({validated:false,mode:'STAGING_ONLY'});
function legacyRoleJwt(value){
 const parts=typeof value==='string'?value.split('.'):[];
 if(parts.length!==3||parts.some(x=>!B64.test(x)))return false;
 try{
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  return claims?.role==='service_role'&&(!claims.ref||claims.ref===REF);
 }catch{return false;}
}
export async function probeG271StagingServiceKey({
 ref,key,request=fetch
}={}){
 if(ref!==REF||typeof request!=='function'||
   typeof key!=='string'||key.length>8192||
   !(MODERN.test(key)||legacyRoleJwt(key)))return fail();
 let response;
 try{
  // No redirect following; only public-known pinned Supabase project URL.
  response=await request('https://'+REF+'.supabase.co/rest/v1/',{
   method:'GET',redirect:'error',
   signal:AbortSignal.timeout(8000),
   headers:{apikey:key,Accept:'application/openapi+json'}
  });
  // A 200 response is the only accepted proof that Supabase accepted
  // the provided backend key; 401/403/5xx/redirect/timeout fail closed.
  if(response?.status!==200||response.ok!==true||
    response.redirected===true)return fail();
  return Object.freeze({validated:true,mode:'STAGING_ONLY'});
 }catch{return fail();}
 finally{
  // Discard any response stream (e.g., schema data) without storing/printing.
  try{await response?.body?.cancel?.();}catch{}
 }
}
