/**
 * B11 Admin-only: sesión estrictamente en memoria. NO implementa proveedor
 * Auth del servidor; exige factor adicional confirmado por proveedor aprobado.
 * El navegador nunca concede permisos; JWT/RBAC se verifica en backend A.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createAdminSessionController({provider,clearSensitive=()=>{},now=()=>Date.now()}={}){
 let current=null;
 const clear=()=>{current=null;clearSensitive();};
 async function refresh(){
  if(typeof provider?.readSession!=='function'){
   clear();return {ok:false,code:'NO_AUTH_PROVIDER'};
  }
  let value;
  try{value=await provider.readSession();}
  catch{clear();return {ok:false,code:'AUTH_UNAVAILABLE'};}
  if(!value||!['admin','owner'].includes(value.role)||value.mfaVerified!==true
   ||typeof value.subject!=='string'||!UUID.test(value.subject)
   ||typeof value.token!=='string'||value.token.length<20
   ||!Number.isFinite(value.expiresAt)||value.expiresAt<=now()+1000){
   clear();return {ok:false,code:'ADMIN_AUTH_REQUIRED'};
  }
  if(current&&current.subject!==value.subject)clearSensitive();
  current={subject:value.subject,role:value.role,mfaVerified:true,token:value.token,expiresAt:value.expiresAt};
  return {ok:true,subject:current.subject,expiresAt:current.expiresAt};
 }
 function publicSession(){
  if(!current||current.expiresAt<=now()+1000){
   if(current)clear();
   return null;
  }
  return Object.freeze({subject:current.subject,role:current.role,mfaVerified:true,expiresAt:current.expiresAt});
 }
 function getSessionForGateway(){
  if(!publicSession())return null;
  return {subject:current.subject,role:current.role,mfaVerified:true,token:current.token,expiresAt:current.expiresAt};
 }
 async function logout(){
  clear();
  try{
   if(typeof provider?.signOut!=='function')return {ok:false,code:'REVOCATION_UNCONFIRMED'};
   await provider.signOut();
   return {ok:true};
  }catch{return {ok:false,code:'REVOCATION_UNCONFIRMED'};}
 }
 return Object.freeze({refresh,publicSession,getSessionForGateway,logout,clear});
}
