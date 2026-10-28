const urlOK=raw=>{
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&!u.port&&!u.username&&!u.password
   &&!u.search&&!u.hash&&u.pathname==='/'
   &&/^[a-z0-9]{10,32}\.supabase\.co$/.test(u.hostname)?u.origin:null;
 }catch{return null;}
};
export function verifyNativeDriverConfig({url,publishableKey}={}){
 const host=urlOK(url);
 if(!host||typeof publishableKey!=='string'
  ||!/^sb_publishable_[a-zA-Z0-9_-]{16,}$/.test(publishableKey))
  return Object.freeze({ok:false});
 return Object.freeze({ok:true,url:host,publishableKey});
}
