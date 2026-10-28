import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createAdminExperience} from './admin-experience.mjs';
import type {AdminExperience,AdminSnapshot} from './admin-experience.mjs';
import {getWebAdminAuth} from './WebAdminClient';
import {createF1AdminAuthorizedQaOptions} from './f1-admin-authorized-qa-options.mjs';
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
 // QA-only: no Admin G75 HTTP in the shipped runtime without independent
 // operator/Owner authorization and external server MFA+RBAC+PG evidence.
 const f1Qa=useMemo(()=>auth?createF1AdminAuthorizedQaOptions({
  origin:import.meta.env.VITE_F1_STAGING_ORIGIN,
  pinnedOrigin:import.meta.env.VITE_F1_STAGING_PINNED_ORIGIN,
  ownerApproved:import.meta.env.VITE_F1_OWNER_APPROVED==='true',
  externalHttpsVerified:import.meta.env.VITE_F1_EXTERNAL_HTTPS_VERIFIED==='true',
  g75ContractVerified:import.meta.env.VITE_F1_G75_CONTRACT_VERIFIED==='true',
  persistedPostgresVerified:import.meta.env.VITE_F1_PG_RUNTIME_VERIFIED==='true',
  serverMfaVerified:import.meta.env.VITE_F1_ADMIN_SERVER_MFA_VERIFIED==='true',
  serverRbacVerified:import.meta.env.VITE_F1_ADMIN_SERVER_RBAC_VERIFIED==='true',
  serverRevocationVerified:import.meta.env.VITE_F1_ADMIN_SERVER_REVOCATION_VERIFIED==='true'
 }):null,[auth]);
 const value=useMemo(()=>experience??createAdminExperience({
  authProvider:auth,f1RideAuditOptions:f1Qa
 }),[experience,auth,f1Qa]);
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
