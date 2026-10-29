import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import type {DriverDocumentUploadAdapters,DriverKycUploadKind}
 from './domain/driver-document-upload.mjs';
import type {DriverHttpsStagingAuthAdapter}
 from './domain/driver-https-staging-auth.mjs';
type State=Readonly<{phase:'not-configured'|'idle'|'sending'|'pending-review'|'cancelled'|'error';
 kind:DriverKycUploadKind|null;message:string}>;
const EMPTY:State={phase:'not-configured',kind:null,message:''};
const Context=createContext<{
 state:State;enabled:boolean;submit:(kind:DriverKycUploadKind,faceConsent:boolean)=>Promise<void>;
}|null>(null);
export function DriverDocumentUploadProvider({children,authAdapter=null,
 qaAdapters=null}:{
 children:React.ReactNode;authAdapter?:DriverHttpsStagingAuthAdapter|null;
 qaAdapters?:DriverDocumentUploadAdapters|null;
}){
 const [state,setState]=useState<State>(qaAdapters?{...EMPTY,phase:'idle'}:EMPTY);
 const generation=useRef(0);
 const busy=useRef(false);
 useEffect(()=>{
  ++generation.current;busy.current=false;
  setState(qaAdapters?{...EMPTY,phase:'idle'}:EMPTY);
  const dispose=authAdapter?.subscribe?.(()=>{
   ++generation.current;busy.current=false;
   setState(qaAdapters?{...EMPTY,phase:'idle'}:EMPTY);
  });
  return ()=>{++generation.current;busy.current=false;dispose?.();};
 },[authAdapter,qaAdapters]);
 const enabled=qaAdapters!==null&&authAdapter!==null;
 async function submit(kind:DriverKycUploadKind,faceConsent:boolean){
  if(!enabled||busy.current)return;
  busy.current=true;
  const nonce=generation.current;
  setState({phase:'sending',kind,message:'Comprobando sesión segura…'});
  try{
   const result=await qaAdapters.upload({kind,faceConsent,
    onProgress:stage=>{
     if(nonce!==generation.current)return;
     const messages={
      identity:'Comprobando identidad y sesión…',
      camera:'Esperando cámara. Permití el acceso o cancelá la captura.',
      uploading:'Enviando imagen al almacenamiento privado…',
      observing:'Comprobando recepción en el servidor…'
     };
     setState({phase:'sending',kind,message:messages[stage]??'Comprobando…'});
    }
   });
   if(nonce!==generation.current)return;
   setState({phase:result.phase,kind,message:result.phase==='pending-review'?
    'Archivo recibido para revisión. La cuenta aún no está aprobada.':
    'Captura cancelada. No se registró el documento.'});
  }catch(error){
   if(nonce!==generation.current)return;
   const code=error instanceof Error?error.message:'';
   const camera=code==='PRIVATE_CAPTURE_TIMEOUT';
   const permission=code==='CAMERA_PERMISSION_DENIED';
   const auth=code==='PRIVATE_AUTH_TIMEOUT'||code==='PRIVATE_REQUEST_KEY_TIMEOUT';
   const unknown=code==='PRIVATE_STORAGE_OUTCOME_UNKNOWN'||
    code==='PRIVATE_OBSERVATION_OUTCOME_UNKNOWN'||
    code==='PRIVATE_SESSION_RECHECK_TIMEOUT';
   setState({phase:'error',kind,message:permission
    ?'Permiso de cámara denegado. Activá la cámara desde Ajustes del teléfono y volvé a intentarlo cuando estés detenido.'
    :camera
    ?'La cámara no respondió. Cerrá el selector de cámara y volvé a esta pantalla para reintentar. No se envió ninguna imagen.'
    :unknown?'No se pudo confirmar si el documento llegó. Actualizá el expediente privado antes de intentar otra carga; no se repetirá automáticamente.'
    :auth?'La verificación de sesión tardó demasiado. Comprobá tu conexión e ingresá nuevamente si es necesario.'
    :'No se pudo confirmar la recepción. Revisá el estado privado antes de intentar nuevamente.'});
  }finally{
   if(nonce===generation.current)busy.current=false;
  }
 }
 return <Context.Provider value={{state,enabled,submit}}>{children}</Context.Provider>;
}
export function useDriverDocumentUpload(){
 const value=useContext(Context);
 if(!value)throw Error('Driver document upload provider missing');
 return value;
}
