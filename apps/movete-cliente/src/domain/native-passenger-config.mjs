/**
 * Public configuration only; no server service-role key, localhost, HTTP,
 * custom endpoint, or app-controlled "certified" boolean is accepted.
 * Runtime HTTPS trip operations remain disabled independently.
 */
const safeUrl=x=>{
 try{
  if(typeof x!=='string'||x.includes('\\'))return null;
  const u=new URL(x);
  return u.protocol==='https:'&&u.port===''&&u.username===''&&u.password===''
   &&u.pathname==='/'&&u.search===''&&u.hash===''
   &&/^[a-z0-9]{10,32}\.supabase\.co$/.test(u.hostname)?u.origin:null;
 }catch{return null;}
};
export function verifyNativePassengerConfig({url,publishableKey}={}){
 const host=safeUrl(url);
 if(!host||typeof publishableKey!=='string'
  ||!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(publishableKey))
  return Object.freeze({ok:false,reason:'NATIVE_AUTH_CONFIG_UNAVAILABLE'});
 return Object.freeze({ok:true,url:host,publishableKey});
}
