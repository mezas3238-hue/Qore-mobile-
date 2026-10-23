import {createAdminSessionController} from './admin-session.mjs';
import {createKycQueueStore} from './kyc-queue.mjs';

/**
 * Composición web B11: ninguna sesión/cola real se crea por defecto.
 * Exige proveedor Auth de A con MFA comprobada, no un toggle de navegador.
 * Las operaciones de escritura siguen bajo validación y autorización de A.
 */
const fail=code=>({ok:false,code});
export function createAdminExperience({authProvider=null,gateway=null,now=()=>Date.now()}={}){
 const queue=createKycQueueStore({now});
 let session;
 const listeners=new Set();
 const notify=()=>{for(const callback of listeners){try{callback();}catch{/* no filtrar secretos */}}};
 const clearPrivate=()=>queue.clear();
 session=createAdminSessionController({provider:authProvider,clearSensitive:clearPrivate,now});
 function snapshot(){
  const current=session.publicSession();
  if(!current){queue.clear();return Object.freeze({authenticated:false,account:null,kyc:null,actionsEnabled:false});}
  return Object.freeze({
   authenticated:true,
   account:Object.freeze({subject:current.subject,role:'admin',mfaVerified:true}),
   kyc:queue.current(),
   // La UI nunca habilita acciones por permisos locales.
   actionsEnabled:false
  });
 }
 function readKyc(dto){
  const current=session.publicSession();
  if(!current){queue.clear();notify();return false;}
  const accepted=queue.replace(dto,current.role);
  notify();
  return accepted;
 }
 async function reviewVehicle(dto){
  // No inferir permisos/contrato desde una sesión en browser.
  const current=session.publicSession();
  if(!current){queue.clear();notify();return fail('ADMIN_AUTH_REQUIRED');}
  if(!gateway||typeof gateway.isConfigured!=='function'||gateway.isConfigured()!==true
   ||typeof gateway.reviewVehicle!=='function')return fail('ADMIN_CONTRACT_PENDING');
  const response=await gateway.reviewVehicle(dto);
  // Ningún resultado de revisión se refleja optimistamente en lista.
  // Se requiere nueva lectura servidor con revisión más reciente.
  queue.clear();
  if(!response||response.ok!==true){
   if(response?.code==='AUTH_REQUIRED'||response?.code==='FORBIDDEN')session.clear();
   notify();return fail(response?.code||'REVIEW_NOT_CONFIRMED');
  }
  notify();return {ok:true,refreshRequired:true};
 }
 return Object.freeze({
  subscribe:callback=>{
   if(typeof callback!=='function')return ()=>{};
   listeners.add(callback);return ()=>{listeners.delete(callback);};
  },
  refreshSession:async()=>{const result=await session.refresh();notify();return result;},
  logout:async()=>{queue.clear();const result=await session.logout();notify();return result;},
  clear:()=>{session.clear();notify();},
  readKyc,reviewVehicle,snapshot
 });
}
