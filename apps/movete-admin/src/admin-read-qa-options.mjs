/** D: mount only independently certified G27 reads, never on browser request.
 * Backend must verify owner-approved STAGING PG, JWT/AAL2, RBAC and revocation.
 */
const OPS=Object.freeze(['kyc','zones','incidents','audit','finance']);
function safeOrigin(value){
 try{
  if(typeof value!=='string'||value.includes('\\'))return null;
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash
    ||u.pathname!=='/'||u.port||u.hostname.endsWith('.')
    ||!/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?\.(?:onrender\.com|up\.railway\.app)$/.test(u.hostname))
   return null;
  return u.origin;
 }catch{return null;}
}
function operations(raw){
 if(typeof raw!=='string'||raw.length<3||raw.length>100)return null;
 const names=raw.split(',').map(x=>x.trim());
 if(names.length<1||names.length>OPS.length||new Set(names).size!==names.length
  ||!names.every(x=>OPS.includes(x)))return null;
 return Object.freeze(names);
}
export function createAdminReadQaOptions({
 origin,pinnedOrigin,ownerApproved=false,externalHttpsVerified=false,
 contractVerified=false,postgresVerified=false,serverMfaVerified=false,
 serverRbacVerified=false,serverRevocationVerified=false,
 verifiedOperations='',fetchImpl
}={}){
 const host=safeOrigin(origin),names=operations(verifiedOperations);
 if(host===null||host!==safeOrigin(pinnedOrigin)||names===null
  ||ownerApproved!==true||externalHttpsVerified!==true
  ||contractVerified!==true||postgresVerified!==true
  ||serverMfaVerified!==true||serverRbacVerified!==true
  ||serverRevocationVerified!==true||typeof fetchImpl!=='function')
  return null;
 return Object.freeze({enabled:true,origin:host,pinnedOrigin:host,
  certifiedContracts:names,fetchImpl});
}
