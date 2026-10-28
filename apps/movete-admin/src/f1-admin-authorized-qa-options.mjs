/**
 * B R77 — native Admin Web F1 read-only runtime wiring. OFF by default.
 * Client-visible build flags are NOT authorization. The backend MUST
 * independently verify JWT audience/session, AAL2 TOTP, exclusive Admin RBAC,
 * revocation, scope and PG receipts. G99 loopback is NOT external certification.
 */
const safeOrigin=(raw)=>{
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.origin!==raw||u.username||u.password
   ||u.port||u.search||u.hash||u.pathname!=='/'||u.hostname.endsWith('.'))
   return null;
  // Disallow LAN/IP/localhost and arbitrary domains for staging deployments.
  if(!/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(u.hostname))
   return null;
  return u.origin;
 }catch{return null;}
};
export function createF1AdminAuthorizedQaOptions({
 origin,pinnedOrigin,ownerApproved=false,externalHttpsVerified=false,
 g75ContractVerified=false,persistedPostgresVerified=false,
 serverMfaVerified=false,serverRbacVerified=false,
 serverRevocationVerified=false,fetchImpl=fetch
}={}){
 const url=safeOrigin(origin);
 if(url===null||url!==safeOrigin(pinnedOrigin)
  ||ownerApproved!==true||externalHttpsVerified!==true
  ||g75ContractVerified!==true||persistedPostgresVerified!==true
  ||serverMfaVerified!==true||serverRbacVerified!==true
  ||serverRevocationVerified!==true||typeof fetchImpl!=='function')
  return null;
 // The gateway still rejects any caller without an actual Admin+AAL2 lease.
 return Object.freeze({enabled:true,contractCertified:true,
  stagingRuntimeVerified:true,origin:url,pinnedOrigin:url,
  fetchImpl,productionEnabled:false});
}
