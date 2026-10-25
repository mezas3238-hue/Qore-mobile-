import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {createClientExperience} from './domain/client-experience.mjs';
import type {ClientExperience,ClientSnapshot} from './domain/client-experience.mjs';
import {getNativePassengerAuth} from './NativePassengerAuth';
import type {NativePassengerAuth} from './domain/native-passenger-auth.mjs';
import {createF1AuthorizedQaHttpOptions} from './domain/f1-authorized-qa-http-options.mjs';
import {createF1AuthorizedHistoryRecoveryOptions} from './domain/f1-authorized-history-recovery-options.mjs';

const ExperienceContext=createContext<ClientExperience|null>(null);
const NativeAuthContext=createContext<NativePassengerAuth|null>(null);
export const useNativePassengerAuth=()=>useContext(NativeAuthContext);
// Preferencia de presentación en RAM: no guarda identidades, rutas ni tokens.
// No se presenta como una configuración persistida en el servidor.
const SimpleModeContext=createContext<{
 simpleMode:boolean;setSimpleMode:(enabled:boolean)=>void;
}|null>(null);
export function useClientSimpleMode(){
 const value=useContext(SimpleModeContext);
 if(!value)throw new Error('Modo simple requiere ClientRuntimeProvider');
 return value;
}

/**
 * Default sin Auth/API: nada se conecta por accidente. El integrador de A
 * podrá inyectar dependencias revisadas, sin tocar las vistas ni el Driver.
 */
export function ClientRuntimeProvider({children,experience}:{
 children:React.ReactNode;experience?:ClientExperience;
}){
 const nativeAuth=useMemo(()=>getNativePassengerAuth(),[]);
 // Stage enrollment is a manual, independently reviewed decision. A simple
 // Render /liveness 200 cannot switch on pricing, booking or GPS.
 const qaHttp=useMemo(()=>createF1AuthorizedQaHttpOptions({
  origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
  pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN,
  ownerApproved:process.env.EXPO_PUBLIC_F1_OWNER_APPROVED==='true',
  backendContractVerified:process.env.EXPO_PUBLIC_F1_G73_CONTRACT_VERIFIED==='true',
  persistedRuntimeVerified:process.env.EXPO_PUBLIC_F1_PG_RUNTIME_VERIFIED==='true',
  routeProviderVerified:process.env.EXPO_PUBLIC_F1_ROUTE_PROVIDER_VERIFIED==='true'
 }),[]);
 // Independent G26 history + G11 status attestations. A G73 booking gate,
 // /liveness response or Expo web export NEVER enable this recovery path.
 const recoveryHttp=useMemo(()=>createF1AuthorizedHistoryRecoveryOptions({
  origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
  pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN,
  ownerApproved:process.env.EXPO_PUBLIC_F1_OWNER_APPROVED==='true',
  persistedRuntimeVerified:process.env.EXPO_PUBLIC_F1_PG_RUNTIME_VERIFIED==='true',
  historyContractVerified:process.env.EXPO_PUBLIC_F1_HISTORY_CONTRACT_VERIFIED==='true',
  statusContractVerified:process.env.EXPO_PUBLIC_F1_STATUS_CONTRACT_VERIFIED==='true',
  passengerRlsVerified:process.env.EXPO_PUBLIC_F1_PASSENGER_RLS_VERIFIED==='true'
 }),[]);
 const client=useMemo(()=>experience??createClientExperience({
  authProvider:nativeAuth,autoG73HttpOptions:qaHttp,
  historyGatewayOptions:recoveryHttp?.historyGatewayOptions??null,
  statusGatewayOptions:recoveryHttp?.statusGatewayOptions??null
 }),[experience,nativeAuth,qaHttp,recoveryHttp]);
 useEffect(()=>{if(nativeAuth)void client.refreshSession();},[client,nativeAuth]);
 const [simpleMode,setSimpleMode]=useState(false);
 const simplePreferences=useMemo(()=>({simpleMode,setSimpleMode}),[simpleMode]);
 return <ExperienceContext.Provider value={client}>
  <NativeAuthContext.Provider value={nativeAuth}>
   <SimpleModeContext.Provider value={simplePreferences}>{children}</SimpleModeContext.Provider>
  </NativeAuthContext.Provider>
 </ExperienceContext.Provider>;
}
export function useClientView(){
 const client=useContext(ExperienceContext);
 if(!client)throw new Error('La vista requiere ClientRuntimeProvider');
 const [view,setView]=useState<ClientSnapshot>(()=>client.snapshot());
 useEffect(()=>client.subscribe(()=>setView(client.snapshot())),[client]);
 useFocusEffect(useCallback(()=>{
  // Evita que un precio vencido o GPS viejo queden visibles sin eventos.
  // Solo refresca la vista enfocada; nunca consulta red por este timer.
  setView(client.snapshot());
  const interval=setInterval(()=>setView(client.snapshot()),5000);
  return ()=>clearInterval(interval);
 },[client]));
 return {client,view};
}
