/**
 * R70: native Passenger read-only trip recovery wiring after process restart.
 * History GET and Status GET MUST be independently certified by Architect A.
 * No route, POST, pricing, booking, Driver claim, GPS permission or LIVE flag.
 * Neither /_qore/liveness nor G73 route gates imply recovery readiness.
 */
function renderOrigin(raw){
 try{
  if(typeof raw!=='string'||raw.includes('\\'))return null;
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.origin!==raw||url.username||url.password
   ||url.port||url.search||url.hash||url.pathname!=='/'
   ||url.hostname.endsWith('.')||
   !/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.onrender\.com$/.test(url.hostname))
   return null;
  return url.origin;
 }catch{return null;}
}
export function createF1AuthorizedHistoryRecoveryOptions({
 origin,pinnedOrigin,ownerApproved=false,persistedRuntimeVerified=false,
 historyContractVerified=false,statusContractVerified=false,
 passengerRlsVerified=false,fetchImpl=fetch
}={}){
 const host=renderOrigin(origin);
 if(ownerApproved!==true||persistedRuntimeVerified!==true
  ||historyContractVerified!==true||statusContractVerified!==true
  ||passengerRlsVerified!==true||host===null
  ||renderOrigin(pinnedOrigin)!==host||typeof fetchImpl!=='function')
  return null;
 const historyGatewayOptions=Object.freeze({
  enabled:true,contractCertified:true,origin:host,pinnedOrigin:host,fetchImpl
 });
 const statusGatewayOptions=Object.freeze({
  enabled:true,contractCertified:true,origin:host,pinnedOrigin:host,fetchImpl
 });
 return Object.freeze({historyGatewayOptions,statusGatewayOptions,
  readOnly:true,qaOnly:true,productionEnabled:false});
}
