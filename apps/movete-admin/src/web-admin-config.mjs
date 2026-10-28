/** Public browser configuration ONLY. Admin service_role never ships to web. */
export function verifyWebAdminConfig({url,publishableKey}={}){
 try{
  if(typeof url!=='string'||url.includes('\\'))return Object.freeze({ok:false});
  const host=new URL(url);
  if(host.protocol!=='https:'||host.port||host.username||host.password||
   host.pathname!=='/'||host.search||host.hash||
   !/^[a-z0-9]{10,32}\.supabase\.co$/.test(host.hostname)||
   typeof publishableKey!=='string'||
   !/^sb_publishable_[a-zA-Z0-9_-]{16,}$/.test(publishableKey))
   return Object.freeze({ok:false});
  return Object.freeze({ok:true,url:host.origin,publishableKey});
 }catch{return Object.freeze({ok:false});}
}
