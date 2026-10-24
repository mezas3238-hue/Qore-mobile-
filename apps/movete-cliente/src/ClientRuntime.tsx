import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {createClientExperience} from './domain/client-experience.mjs';
import type {ClientExperience,ClientSnapshot} from './domain/client-experience.mjs';

const ExperienceContext=createContext<ClientExperience|null>(null);
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
 const client=useMemo(()=>experience??createClientExperience(),[experience]);
 const [simpleMode,setSimpleMode]=useState(false);
 const simplePreferences=useMemo(()=>({simpleMode,setSimpleMode}),[simpleMode]);
 return <ExperienceContext.Provider value={client}>
  <SimpleModeContext.Provider value={simplePreferences}>{children}</SimpleModeContext.Provider>
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
