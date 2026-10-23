/** Estado de sesión efímero de Cliente: sin localStorage/AsyncStorage.
 * El backend de A debe verificar JWT, revocación, audiencia y propiedad.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createClientSessionController({provider,clearPrivateState=()=>{},now=()=>Date.now()}={}){
 let current=null,epoch=0,privacyEpoch=0;
 const clear=()=>{
  epoch++;privacyEpoch++;
  current=null;
  clearPrivateState();
 };
 async function refresh(){
  const started=++epoch;
  if(!provider||typeof provider.readSession!=='function'){clear();return {ok:false,code:'NO_AUTH_PROVIDER'};}
  let session;
  try{session=await provider.readSession();}
  catch{
   if(epoch!==started)return {ok:false,code:'STALE_SESSION_RESPONSE'};
   clear();return {ok:false,code:'AUTH_UNAVAILABLE'};
  }
  if(epoch!==started)return {ok:false,code:'STALE_SESSION_RESPONSE'};
  if(!session||session.role!=='passenger'||typeof session.subject!=='string'
   ||!UUID.test(session.subject)||typeof session.token!=='string'
   ||session.token.length<20||!Number.isFinite(session.expiresAt)
   ||session.expiresAt<=now()+1000){clear();return {ok:false,code:'AUTH_REQUIRED'};}
  // Un relogin con JWT distinto es otra sesión, aunque el subject sea igual.
  // No reutilizar historia, GPS ni requestKey de un token revocado.
  const changed=!current||current.subject!==session.subject
   ||current.token!==session.token||current.expiresAt!==session.expiresAt;
  // Separado de epoch: un refresh idéntico no destruye borradores, pero
  // login/logout, rotación JWT y expiración remueven estados locales privados.
  if(changed){
   privacyEpoch++;
   if(current)clearPrivateState();
  }
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
 return Object.freeze({refresh,publicSession,getSessionForGateway,logout,clear,revision:()=>epoch,privacyRevision:()=>privacyEpoch});
}
