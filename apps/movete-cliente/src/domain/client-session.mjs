/** Estado de sesión efímero de Cliente: sin localStorage/AsyncStorage.
 * El backend de A debe verificar JWT, revocación, audiencia y propiedad.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createClientSessionController({provider,clearPrivateState=()=>{},now=()=>Date.now()}={}){
 let current=null;
 const clear=()=>{
  current=null;
  clearPrivateState();
 };
 async function refresh(){
  if(!provider||typeof provider.readSession!=='function'){clear();return {ok:false,code:'NO_AUTH_PROVIDER'};}
  let session;
  try{session=await provider.readSession();}catch{clear();return {ok:false,code:'AUTH_UNAVAILABLE'};}
  if(!session||session.role!=='passenger'||typeof session.subject!=='string'
   ||!UUID.test(session.subject)||typeof session.token!=='string'
   ||session.token.length<20||!Number.isFinite(session.expiresAt)
   ||session.expiresAt<=now()+1000){clear();return {ok:false,code:'AUTH_REQUIRED'};}
  if(current&&current.subject!==session.subject)clearPrivateState();
  current={subject:session.subject,role:'passenger',expiresAt:session.expiresAt,token:session.token};
  return {ok:true,subject:current.subject,expiresAt:current.expiresAt};
 }
 function publicSession(){
  if(!current||current.expiresAt<=now()+1000){if(current)clear();return null;}
  return {subject:current.subject,role:'passenger',expiresAt:current.expiresAt};
 }
 function getSessionForGateway(){
  if(!publicSession())return null;
  return {token:current.token,role:current.role,expiresAt:current.expiresAt};
 }
 async function logout(){
  clear(); // elimina datos privados antes de red, incluso si falla
  try{
   if(!provider||typeof provider.signOut!=='function')return {ok:false,code:'SERVER_REVOCATION_UNCONFIRMED'};
   await provider.signOut();
   return {ok:true};
  }catch{return {ok:false,code:'SERVER_REVOCATION_UNCONFIRMED'};}
 }
 return Object.freeze({refresh,publicSession,getSessionForGateway,logout,clear});
}
