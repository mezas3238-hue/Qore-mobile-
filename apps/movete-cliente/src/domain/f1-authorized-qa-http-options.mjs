/**
 * QA-only F1 HTTP wiring for the installed Passenger app.
 *
 * It MUST NOT infer G73 authorization from /_qore/liveness. Four separate
 * external verifications must have been completed by the STAGING operator
 * before setting the public build flags. All are false by default and the
 * server independently validates JWT, RLS, route, tariffs and transaction.
 */
const pinned=raw=>{
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const u=new URL(raw);
  return u.protocol==='https:'&&u.origin===raw&&!u.username&&!u.password
   &&!u.port&&!u.search&&!u.hash&&u.pathname==='/'
   &&/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(u.hostname)
   ?u.origin:null;
 }catch{return null;}
};
export function createF1AuthorizedQaHttpOptions({
 origin,pinnedOrigin,
 ownerApproved=false,backendContractVerified=false,
 persistedRuntimeVerified=false,routeProviderVerified=false,
 subsidyContractVerified=false,fetchImpl=fetch
}={}){
 const url=pinned(origin);
 if(ownerApproved!==true||backendContractVerified!==true||
  persistedRuntimeVerified!==true||routeProviderVerified!==true
  ||subsidyContractVerified!==true||
  url===null||url!==pinned(pinnedOrigin)||
  typeof fetchImpl!=='function')return null;
 // This is explicitly STAGING QA; these flags do not enable payment,
 // commercial rides, production or an independently attested server.
 return Object.freeze({
  enabled:true,contractCertified:true,stagingRuntimeVerified:true,
  routeProviderCertified:true,subsidyContractCertified:true,
  origin:url,pinnedOrigin:url,fetchImpl
 });
}
