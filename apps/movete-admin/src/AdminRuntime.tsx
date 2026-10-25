import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createAdminExperience} from './admin-experience.mjs';
import type {AdminExperience,AdminSnapshot} from './admin-experience.mjs';
import {getWebAdminAuth} from './WebAdminClient';
import type {WebAdminAuth} from './web-admin-auth.mjs';
const Context=createContext<AdminExperience|null>(null);
const AuthContext=createContext<WebAdminAuth|null>(null);
export const useWebAdminAuth=()=>useContext(AuthContext);
/**
 * Por defecto sin Auth/Admin API. Inyectar dependencias auditadas de A
 * requiere trabajo explícito de integración; aquí no se inicia sesión.
 */
export function AdminRuntimeProvider({children,experience}:{
 children:React.ReactNode;experience?:AdminExperience;
}){
 const auth=useMemo(()=>getWebAdminAuth(),[]);
 const value=useMemo(()=>experience??createAdminExperience({authProvider:auth}),[experience,auth]);
 useEffect(()=>{if(auth)void value.refreshSession();},[auth,value]);
 return <Context.Provider value={value}>
  <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
 </Context.Provider>;
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
