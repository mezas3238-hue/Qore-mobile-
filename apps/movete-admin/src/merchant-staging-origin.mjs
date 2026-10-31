/**
 * D/G230 Merchant staff STAGING backend selection.
 * Commerce is a separate role and session from Admin/Owner. Hostname
 * allowlisting is a transport restriction, NEVER a privilege grant.
 * The origin must be injected twice, identically and explicitly, by the
 * reviewed STAGING build. No LIVE, localhost, arbitrary host or wildcards.
 */
const HOST=/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.(?:onrender\.com|up\.railway\.app)$/;
function exactHttpsOrigin(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.origin!==raw||
     u.username||u.password||u.port||u.search||u.hash||
     u.pathname!=='/'||!HOST.test(u.hostname))return null;
  return u.origin;
 }catch{return null;}
}
export function verifyMerchantStagingApiOrigin({origin,pinnedOrigin}={}){
 const candidate=exactHttpsOrigin(origin);
 return candidate!==null&&candidate===exactHttpsOrigin(pinnedOrigin)
  ?candidate:null;
}
