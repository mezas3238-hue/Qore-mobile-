import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {createClientExperience} from './domain/client-experience.mjs';
import type {ClientExperience,ClientSnapshot} from './domain/client-experience.mjs';
import {getNativePassengerAuth} from './NativePassengerAuth';
import {getNativeG95RecoveryStore} from './NativeG95RecoveryStore';
import {getNativeG101RecoveryStore} from './NativeG101RecoveryStore';
import type {NativePassengerAuth} from './domain/native-passenger-auth.mjs';
import {createF1AuthorizedQaHttpOptions} from './domain/f1-authorized-qa-http-options.mjs';
import {createF1AuthorizedHistoryRecoveryOptions} from './domain/f1-authorized-history-recovery-options.mjs';
import {createPassengerRideIntent} from './domain/passenger-ride-intent.mjs';
import type {PassengerRideIntent} from './domain/passenger-ride-intent.mjs';

const ExperienceContext=createContext<ClientExperience|null>(null);
const PassengerRideIntentContext=createContext<PassengerRideIntent|null>(null);
export function usePassengerRideIntent():PassengerRideIntent{
 const value=useContext(PassengerRideIntentContext);
 if(!value)throw Error('Ruta de pasajeros requiere ClientRuntimeProvider');
 return value;
}
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
 const g95RecoveryStore=useMemo(()=>getNativeG95RecoveryStore(),[]);
 const motoRecoveryStore=useMemo(()=>getNativeG101RecoveryStore(),[]);
 // Stage enrollment is a manual, independently reviewed decision. A simple
 // Render /liveness 200 cannot switch on pricing, booking or GPS.
 const qaHttp=useMemo(()=>createF1AuthorizedQaHttpOptions({
  origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
  pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN,
  ownerApproved:process.env.EXPO_PUBLIC_F1_OWNER_APPROVED==='true',
  backendContractVerified:process.env.EXPO_PUBLIC_F1_G73_CONTRACT_VERIFIED==='true',
  persistedRuntimeVerified:process.env.EXPO_PUBLIC_F1_PG_RUNTIME_VERIFIED==='true',
  routeProviderVerified:process.env.EXPO_PUBLIC_F1_ROUTE_PROVIDER_VERIFIED==='true',
  subsidyContractVerified:process.env.EXPO_PUBLIC_F1_G93_SUBSIDY_CONTRACT_VERIFIED==='true',
  financialContractVerified:process.env.EXPO_PUBLIC_F1_G94_FINANCIAL_STATUS_VERIFIED==='true',
  cancellationContractVerified:process.env.EXPO_PUBLIC_F1_G95_CANCEL_CONTRACT_VERIFIED==='true'
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
 const motoG101=useMemo(()=>{
  // Even G101 PostgreSQL loopback SUCCESS is NOT external HTTP+legal proof.
  const approved=process.env.EXPO_PUBLIC_MOTO_OWNER_APPROVED==='true'
   &&process.env.EXPO_PUBLIC_MOTO_G101_CONTRACT_VERIFIED==='true'
   &&process.env.EXPO_PUBLIC_MOTO_EXTERNAL_RUNTIME_VERIFIED==='true'
   &&process.env.EXPO_PUBLIC_MOTO_LEGAL_VERIFIED==='true'
   &&process.env.EXPO_PUBLIC_MOTO_ROUTE_PROVIDER_VERIFIED==='true'
   &&process.env.EXPO_PUBLIC_MOTO_PASSENGER_RLS_VERIFIED==='true'
   &&process.env.EXPO_PUBLIC_MOTO_IDEMPOTENCY_VERIFIED==='true';
  return approved&&motoRecoveryStore?{
   enabled:true,contractCertified:true,externalRuntimeVerified:true,
   motoLegalVerified:true,motoRouteVerified:true,
   passengerRlsVerified:true,idempotencyVerified:true,
   origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
   pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN
  }:null;
 },[motoRecoveryStore]);
 // G121 is a read-only opt-in, never inferred from CI/liveness.
 const g121Options=useMemo(()=>({
  enabled:process.env.EXPO_PUBLIC_G121_OWNER_APPROVED==='true',
  ownerApproved:process.env.EXPO_PUBLIC_G121_OWNER_APPROVED==='true',
  contractCertified:process.env.EXPO_PUBLIC_G121_CONTRACT_VERIFIED==='true',
  externalRuntimeVerified:process.env.EXPO_PUBLIC_G121_EXTERNAL_RUNTIME_VERIFIED==='true',
  passengerRlsVerified:process.env.EXPO_PUBLIC_G121_PASSENGER_RLS_VERIFIED==='true',
  origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
  pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN
 }),[]);
 const client=useMemo(()=>experience??createClientExperience({
  authProvider:nativeAuth,autoG73HttpOptions:qaHttp,g95RecoveryStore,
  deliveryRegistrationOptions:g121Options,
  motoPassengerHttpOptions:motoG101,motoRecoveryStore,
  historyGatewayOptions:recoveryHttp?.historyGatewayOptions??null,
  statusGatewayOptions:recoveryHttp?.statusGatewayOptions??null
 }),[experience,nativeAuth,qaHttp,recoveryHttp,g95RecoveryStore,motoG101,motoRecoveryStore,g121Options]);
 useEffect(()=>{
  if(!nativeAuth)return;
  let active=true;
  void (async()=>{
   const auth=await client.refreshSession();
   // Preserve the previously certified R75 manual G95 recovery contract.
   // MOTO G101 is already bootstrapped by refreshSession; do not double-read.
   if(active&&auth.ok===true&&g95RecoveryStore
    &&qaHttp?.cancellationContractCertified===true)
    await client.restoreG95Cancellation();
  })();
  return ()=>{active=false;};
 },[client,nativeAuth,qaHttp,g95RecoveryStore]);
 // Solo RAM, nunca enlaces, AsyncStorage ni campos de URL con direcciones.
 const passengerRideIntent=useMemo(()=>createPassengerRideIntent(),[]);
 useEffect(()=>{
  let previous=client.snapshot().privateViewRevision;
  return client.subscribe(()=>{
   const current=client.snapshot().privateViewRevision;
   if(current!==previous){passengerRideIntent.clear();previous=current;}
  });
 },[client,passengerRideIntent]);
 const [simpleMode,setSimpleMode]=useState(false);
 const simplePreferences=useMemo(()=>({simpleMode,setSimpleMode}),[simpleMode]);
 return <ExperienceContext.Provider value={client}>
  <PassengerRideIntentContext.Provider value={passengerRideIntent}>
   <NativeAuthContext.Provider value={nativeAuth}>
    <SimpleModeContext.Provider value={simplePreferences}>{children}</SimpleModeContext.Provider>
   </NativeAuthContext.Provider>
  </PassengerRideIntentContext.Provider>
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
