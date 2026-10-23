import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {createClientExperience} from './domain/client-experience.mjs';
import type {ClientExperience,ClientSnapshot} from './domain/client-experience.mjs';

const ExperienceContext=createContext<ClientExperience|null>(null);

/**
 * Default sin Auth/API: nada se conecta por accidente. El integrador de A
 * podrá inyectar dependencias revisadas, sin tocar las vistas ni el Driver.
 */
export function ClientRuntimeProvider({children,experience}:{
 children:React.ReactNode;experience?:ClientExperience;
}){
 const client=useMemo(()=>experience??createClientExperience(),[experience]);
 return <ExperienceContext.Provider value={client}>{children}</ExperienceContext.Provider>;
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
