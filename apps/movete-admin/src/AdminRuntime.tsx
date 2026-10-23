import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createAdminExperience} from './admin-experience.mjs';
import type {AdminExperience,AdminSnapshot} from './admin-experience.mjs';
const Context=createContext<AdminExperience|null>(null);
/**
 * Por defecto sin Auth/Admin API. Inyectar dependencias auditadas de A
 * requiere trabajo explícito de integración; aquí no se inicia sesión.
 */
export function AdminRuntimeProvider({children,experience}:{
 children:React.ReactNode;experience?:AdminExperience;
}){
 const value=useMemo(()=>experience??createAdminExperience(),[experience]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminView(){
 const client=useContext(Context);
 if(!client)throw new Error('Falta AdminRuntimeProvider');
 const [view,setView]=useState<AdminSnapshot>(()=>client.snapshot());
 useEffect(()=>client.subscribe(()=>setView(client.snapshot())),[client]);
 // Caducidad del TTL de KYC visible incluso sin nuevos eventos, sin red.
 useEffect(()=>{
  const timer=setInterval(()=>setView(client.snapshot()),5000);
  return ()=>clearInterval(timer);
 },[client]);
 return {client,view};
}
