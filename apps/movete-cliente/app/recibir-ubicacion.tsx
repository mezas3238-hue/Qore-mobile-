/**
 * G331: one explicit geocoder action after Google Maps sharing; the passenger
 * must still choose the verified Paraguayan address and confirm on Transporte.
 * No per-keystroke search, background tracking, booking or route price.
 */
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {router} from 'expo-router';
import {useIncomingShare} from 'expo-sharing';
import {AppState,Pressable,ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {readGoogleMapsShare,stageGoogleMapsShare,
 stageGoogleMapsGeocodedCandidate} from '../src/domain/client-google-maps-share.mjs';
import {requestPassengerDestinationGeocoderPermission,
 searchPassengerDestination} from '../src/native/client-location';
import type {PassengerPlace} from '../src/native/client-location';

export default function ReceiveMapsLocation(){
 const {sharedPayloads,resolvedSharedPayloads,isResolving,
  clearSharedPayloads,error}=useIncomingShare();
 const candidate=useMemo(()=>readGoogleMapsShare(sharedPayloads,resolvedSharedPayloads),
  [sharedPayloads,resolvedSharedPayloads]);
 const [checking,setChecking]=useState(false);
 const [places,setPlaces]=useState<readonly PassengerPlace[]>([]);
 const [notice,setNotice]=useState('');
 const mounted=useRef(true),foreground=useRef(AppState.currentState==='active');
 const requestEpoch=useRef(0),requestBusy=useRef(false);

 useEffect(()=>{
  mounted.current=true;
  foreground.current=AppState.currentState==='active';
  const sub=AppState.addEventListener('change',state=>{
   foreground.current=state==='active';
   if(state==='background'){
    requestEpoch.current++;requestBusy.current=false;
    setChecking(false);setPlaces([]);
   }
  });
  return ()=>{mounted.current=false;foreground.current=false;
   requestEpoch.current++;sub.remove();};
 },[]);
 useEffect(()=>{
  // If Android resolves an updated share while a search is in flight, never
  // display candidates from the previous shared destination.
  requestEpoch.current++;requestBusy.current=false;
  setChecking(false);setPlaces([]);setNotice('');
 },[candidate.ok?candidate.query:null]);

 function cancel(){
  requestEpoch.current++;requestBusy.current=false;
  clearSharedPayloads();router.replace('/transporte');
 }
 function manual(){
  if(!candidate.ok||!stageGoogleMapsShare(candidate.query))return;
  requestEpoch.current++;requestBusy.current=false;
  clearSharedPayloads();router.replace('/transporte');
 }
 async function locateSharedPlace(){
  if(!candidate.ok||requestBusy.current||!foreground.current)return;
  requestBusy.current=true;
  const serial=++requestEpoch.current,query=candidate.query;
  setChecking(true);setPlaces([]);
  setNotice('Buscando una sola vez en el GPS del teléfono…');
  try{
   const allowed=await requestPassengerDestinationGeocoderPermission();
   if(serial!==requestEpoch.current||!mounted.current||!foreground.current)return;
   if(!allowed){
    setNotice('No hay permiso de ubicación. Podés continuar con la búsqueda manual.');
    return;
   }
   const result=await searchPassengerDestination(query);
   if(serial!==requestEpoch.current||!mounted.current||!foreground.current)return;
   if(result.ok){
    setPlaces(result.places);
    setNotice('Elegí el lugar correcto de Paraguay. Después confirmarás el punto en Movete Fácil.');
   }else{
    setNotice(result.code==='LOCATION_DENIED'
     ?'El teléfono necesita permiso de ubicación para verificar direcciones.'
     :'No se encontró una dirección verificable. Podés buscarla manualmente.');
   }
  }catch{
   if(serial===requestEpoch.current&&mounted.current)
    setNotice('No se pudo consultar la dirección. Podés continuar manualmente.');
  }finally{
   if(serial===requestEpoch.current&&mounted.current){
    requestBusy.current=false;setChecking(false);
   }
  }
 }
 function selectVerifiedPlace(place:PassengerPlace){
  if(!candidate.ok||requestBusy.current)return;
  if(!stageGoogleMapsGeocodedCandidate(candidate.query,place)){
   setNotice('Ese punto no se pudo verificar. Elegí otro.');
   return;
  }
  requestEpoch.current++;clearSharedPayloads();router.replace('/transporte');
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag">
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Recibir lugar de Google Maps</Text>
   <Text style={styles.text}>
    Recibimos un lugar compartido. Podemos buscarlo directamente con el
    geocodificador de tu teléfono, sin API de pago ni seguimiento continuo.
    Un viaje no se crea por compartir una dirección.
   </Text>
   {candidate.ok?<View style={{gap:12}}>
    <Text style={styles.text}>Lugar compartido:</Text>
    <Text style={{fontSize:19,fontWeight:'700',color:'#183044'}}>
     {candidate.query}
    </Text>
    <Action label={checking?'Buscando ubicación…':'Buscar el lugar automáticamente'}
     busy={checking} disabled={checking}
     onPress={()=>{void locateSharedPlace();}}/>
    <Text accessibilityLiveRegion="polite" style={styles.small}>{notice}</Text>
    {places.map((place,i)=><Pressable
     key={i+'-'+place.latitude+'-'+place.longitude}
     accessibilityRole="button"
     accessibilityLabel={'Elegir '+place.label}
     onPress={()=>selectVerifiedPlace(place)}
     style={styles.card}>
     <Text style={{fontSize:16,fontWeight:'700',color:'#183044'}}>{place.label}</Text>
     <Text style={styles.small}>Punto verificado en Paraguay. Tocá para revisarlo y confirmarlo en tu viaje.</Text>
    </Pressable>)}
    <Action secondary label="Continuar con búsqueda manual"
     disabled={checking} onPress={manual}/>
   </View>:isResolving&&candidate.code==='PLACE_NAME_REQUIRED'
    ?<Text accessibilityLiveRegion="polite" style={styles.text}>
      Comprobando el enlace compartido de Google Maps. Solo se aceptará
      un lugar identificable que puedas verificar antes de confirmar.
     </Text>
    :<Text accessibilityRole="alert" style={styles.text}>
      {candidate.code==='PLACE_NAME_REQUIRED'
       ?'El enlace no contiene un nombre verificable. Buscá el destino en Movete Fácil.'
       :'No se recibió un lugar válido de Google Maps. Podés regresar y buscarlo manualmente.'}
     </Text>}
   {error&&<Text accessibilityRole="alert" style={styles.small}>
    No se pudo interpretar el contenido compartido.</Text>}
   <Action secondary label="Volver a transporte" onPress={cancel}/>
   <Text style={styles.small}>
    Las coordenadas solo pasan al borrador local tras elegir un resultado
    geocodificado. Movete Fácil vuelve a pedir confirmación del destino
    y no calcula tarifas ni asigna conductores en este paso.
   </Text>
  </Panel>
 </ScrollView>;
}
