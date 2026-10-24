import {validateSupportDraft} from './support-draft.mjs';

/** Memoria efímera por montaje/sesión privada. Nunca escribe en disco o en la red. */
export function createSupportDraftSession(){
 let active=true;
 let state={category:'SAFETY',serviceId:'',description:'',feedback:''};
 const snapshot=()=>Object.freeze({...state,localOnly:true,submitted:false});
 const edit=(patch)=>{
  if(!active)return snapshot();
  state={...state,...patch,feedback:''};
  return snapshot();
 };
 return Object.freeze({
  snapshot,
  setCategory:(category)=>edit({category}),
  setServiceId:(serviceId)=>edit({serviceId}),
  setDescription:(description)=>edit({description}),
  validate:()=>{
   if(!active)return snapshot();
   const result=validateSupportDraft(state);
   state={...state,feedback:result.ok
    ?'Borrador local válido. NO enviado. Sin recibo ni número de caso.'
    :result.reason};
   return snapshot();
  },
  clear:()=>{
   if(active)state={category:'SAFETY',serviceId:'',description:'',feedback:''};
   return snapshot();
  },
  dispose:()=>{
   active=false;
   state={category:'SAFETY',serviceId:'',description:'',feedback:''};
   return snapshot();
  }
 });
}
