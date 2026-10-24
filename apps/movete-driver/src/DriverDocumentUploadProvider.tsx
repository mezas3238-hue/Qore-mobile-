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
  setState({phase:'sending',kind,message:''});
  try{
   const result=await qaAdapters.upload({kind,faceConsent});
   if(nonce!==generation.current)return;
   setState({phase:result.phase,kind,message:result.phase==='pending-review'?
    'Archivo recibido para revisión. La cuenta aún no está aprobada.':
    'Captura cancelada. No se registró el documento.'});
  }catch{
   if(nonce!==generation.current)return;
   setState({phase:'error',kind,message:
    'No se pudo confirmar la recepción. Revisá el estado privado antes de intentar nuevamente.'});
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
