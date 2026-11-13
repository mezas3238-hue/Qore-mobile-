/**
 * G325: interactive pickup GPS / destination device-geocoder picker for AUTO
 * and MOTO. Selection stays in component RAM; it never creates a booking,
 * passes GPS to an HTTP endpoint, or saves addresses in persistent storage.
 *
 * A map is only opened after an explicit tap. Android/Apple Maps do not send
 * a selected place back to this app, so confirmation uses a verified native
 * geocoder candidate instead of pretending an external map returned a pin.
 */
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {AppState,Linking,Modal,Platform,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import Constants from 'expo-constants';
import {ClientNativeMapPicker} from './native/ClientNativeMapPicker';
import {Action,palette,styles} from './ClientUI';
import {getPassengerCurrentPickup,searchPassengerDestination,
 requestPassengerGeocoderPermission} from './native/client-location';
import type {PassengerPlace} from './native/client-location';
import {createClientLocationWorkBudget} from './domain/client-location-work-budget.mjs';
import {createPassengerMapPreviewLinks} from './domain/client-map-preview.mjs';

export function PassengerPlaceFields({origin,destination,editable,onOriginChange,onDestinationChange}:{
 origin:string;destination:string;editable:boolean;
 onOriginChange:(label:string)=>void;onDestinationChange:(label:string)=>void;
}){
 const [gpsBusy,setGpsBusy]=useState(false);
 const [searchBusy,setSearchBusy]=useState(false);
 const [originNotice,setOriginNotice]=useState('');
 const [destinationNotice,setDestinationNotice]=useState('');
 const [gpsAccuracy,setGpsAccuracy]=useState<number|null>(null);
 const [pickerOpen,setPickerOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [candidates,setCandidates]=useState<readonly PassengerPlace[]>([]);
 const [selected,setSelected]=useState<PassengerPlace|null>(null);
 const [mapNotice,setMapNotice]=useState('');
 const [nativeMapKind,setNativeMapKind]=useState<'pickup'|'destination'|null>(null);
 const [nativePickup,setNativePickup]=useState<PassengerPlace|null>(null);
 const [nativeDropoff,setNativeDropoff]=useState<PassengerPlace|null>(null);
 // Reuse A's native map component only with approved SDK credentials.
 // No blank/billable Android map without explicit build-time opt-in.
 const nativeMapReady=Platform.OS==='ios'||
  (Platform.OS==='android'&&Constants.expoConfig?.extra?.qoreAndroidMapsReady===true);
 const budget=useMemo(()=>createClientLocationWorkBudget(),[]);
 const mounted=useRef(true);
 const foreground=useRef(AppState.currentState==='active');
 // Async GPS must use CURRENT route locks and callbacks, not a stale render
 // captured before a server quote, booking or account revision changed.
 const editableNow=useRef(editable);
 const originChangeNow=useRef(onOriginChange);
 editableNow.current=editable;
 originChangeNow.current=onOriginChange;
 const epoch=useRef(0);
 useEffect(()=>{
  mounted.current=true;
  foreground.current=AppState.currentState==='active';
  const sub=AppState.addEventListener('change',state=>{
   foreground.current=state==='active';
   if(state==='background'){
    // External Maps temporarily backgrounds this app. Preserve the chosen
    // candidate so the passenger can confirm it after returning from Maps.
    epoch.current++;setCandidates([]);setMapNotice('');
   }
  });
  return ()=>{mounted.current=false;foreground.current=false;epoch.current++;sub.remove();};
 },[]);
 async function locatePickup(){
  if(!editable||gpsBusy||searchBusy||!foreground.current)return;
  const lease=budget.beginGps({manual:true});
  if(!lease.ok){
   setOriginNotice(lease.code==='GPS_COOLDOWN'
    ?'El GPS ya se consultó. Esperá un momento antes de repetir.'
    :'Hay otra consulta de ubicación en curso.');
   return;
  }
  const request=++epoch.current;
  setGpsBusy(true);setOriginNotice('Buscando tu ubicación GPS…');
  try{
   const result=await getPassengerCurrentPickup();
   if(!mounted.current||!foreground.current||request!==epoch.current||!editableNow.current)return;
   if(!result.ok){
    setGpsAccuracy(null);
    setOriginNotice(result.code==='LOCATION_DENIED'
     ?'Activá el permiso de ubicación para obtener tu origen.'
     :result.code==='GPS_NOT_PRECISE'
      ?'La señal GPS es imprecisa. Probá nuevamente desde un lugar abierto.'
      :'No se obtuvo tu ubicación. Podés reintentar sin activar seguimiento.');
    return;
   }
   setGpsAccuracy(result.accuracyMeters);
   originChangeNow.current(result.place.label);
   setNativePickup(result.place);
   if(nativeMapReady)setNativeMapKind('pickup');
   setOriginNotice('Origen ubicado por GPS. Revisá que el punto sea correcto.');
  }catch{
   if(mounted.current)setOriginNotice('GPS no disponible. Reintentá manualmente.');
  }finally{
   budget.end('gps');
   if(mounted.current)setGpsBusy(false);
  }
 }
 function closePicker(){
  epoch.current++;setPickerOpen(false);setQuery('');setCandidates([]);setSelected(null);
  setMapNotice('');setSearchBusy(false);
 }
 async function openDestinationPicker(){
  if(!editable||gpsBusy||searchBusy||!foreground.current)return;
  epoch.current++;setQuery('');setCandidates([]);setSelected(null);
  setMapNotice('');setDestinationNotice('');
  if(nativeMapReady)setNativeMapKind('destination');
  else setPickerOpen(true);
  const permitted=await requestPassengerGeocoderPermission();
  if(!mounted.current||!foreground.current)return;
  if(!permitted)setDestinationNotice(
   'Para buscar direcciones Android necesita permiso de ubicación. Podés activarlo en ajustes.'
  );
 }
 async function searchPlace(){
  const candidate=query.trim();
  if(!editable||!pickerOpen||!foreground.current||searchBusy)return;
  const lease=budget.beginDestination(candidate);
  if(!lease.ok){
   setDestinationNotice(lease.code==='SEARCH_COOLDOWN'
    ?'Esperá unos segundos antes de buscar otra vez.'
    :lease.code==='LOCATION_BUSY'?'Otra consulta GPS sigue en curso.'
    :'Escribí al menos cuatro caracteres de la dirección.');
   return;
  }
  const request=++epoch.current;
  setCandidates([]);setSelected(null);setSearchBusy(true);
  setDestinationNotice('Buscando el lugar en Paraguay…');
  try{
   const result=await searchPassengerDestination(candidate);
   if(!mounted.current||!foreground.current||request!==epoch.current)return;
   if(result.ok){
    setCandidates(result.places);
    setDestinationNotice('Elegí una dirección para comprobar su marcador.');
   }else setDestinationNotice(result.code==='LOCATION_DENIED'
    ?'Se requiere permiso de ubicación. Activá el permiso y reintentá.'
    :'No encontramos ese lugar. Probá con calle, barrio y ciudad.');
  }catch{
   if(mounted.current)setDestinationNotice('No se pudo buscar el lugar. Reintentá.');
  }finally{
   budget.end('destination');
   if(mounted.current)setSearchBusy(false);
  }
 }
 async function viewSelectedMap(place:PassengerPlace|null=selected){
  if(!place)return;
  const urls=createPassengerMapPreviewLinks(place,Platform.OS);
  if(!urls){setMapNotice('Las coordenadas no son válidas.');return;}
  try{
   await Linking.openURL(urls.primary);
   if(mounted.current)setMapNotice('Revisá el marcador en el mapa y volvé para confirmar.');
  }catch{
   try{
    await Linking.openURL(urls.fallback);
    if(mounted.current)setMapNotice('Revisá el marcador y regresá para confirmar.');
   }catch{
    if(mounted.current)setMapNotice('No hay una aplicación de mapas disponible.');
   }
  }
 }
 function confirmDestination(){
  if(!editable||!selected||!pickerOpen||searchBusy||!foreground.current)return;
  onDestinationChange(selected.label);
  closePicker();
 }
 async function searchNativeMap(queryText:string){
  const lease=budget.beginDestination(queryText);
  if(!lease.ok)return {ok:false as const,code:lease.code};
  try{return await searchPassengerDestination(queryText);}
  finally{budget.end('destination');}
 }
 function confirmNativeMap(place:PassengerPlace){
  if(!editableNow.current||!nativeMapKind)return;
  if(nativeMapKind==='pickup'){
   setNativePickup(place);setGpsAccuracy(null);
   originChangeNow.current(place.label);
   setOriginNotice('Recogida confirmada en el mapa.');
  }else{
   setNativeDropoff(place);
   onDestinationChange(place.label);
   setDestinationNotice('Destino confirmado en el mapa.');
  }
  setNativeMapKind(null);
 }
 return <>
  <ClientNativeMapPicker visible={nativeMapKind!==null}
   kind={nativeMapKind??'destination'}
   initial={nativeMapKind==='pickup'?nativePickup:nativeDropoff}
   origin={nativePickup}
   onClose={()=>{setNativeMapKind(null);}}
   onConfirm={confirmNativeMap}
   onSearch={searchNativeMap}/>
  <Text style={styles.text}>Origen</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Origen: detectar mi ubicación GPS"
   accessibilityState={{disabled:!editable||gpsBusy||searchBusy}}
   disabled={!editable||gpsBusy||searchBusy}
   onPress={()=>{void locatePickup();}}
   style={[styles.field,{justifyContent:'center',opacity:editable?1:0.55}]}>
   <Text style={{color:palette.ink,fontSize:16}}>
    {gpsBusy?'Localizando…':origin||'Tocá aquí para detectar tu ubicación GPS'}
   </Text>
  </Pressable>
  <Text accessibilityLiveRegion="polite" style={styles.small}>
   {originNotice||'Tocá Origen para localizar tu posición actual una sola vez.'}
   {gpsAccuracy!==null?' Precisión aproximada: ±'+Math.round(gpsAccuracy)+' m.':''}
  </Text>
  <Text style={styles.text}>Destino</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Destino: abrir buscador de lugares GPS"
   accessibilityState={{disabled:!editable||gpsBusy||searchBusy}}
   disabled={!editable||gpsBusy||searchBusy}
   onPress={()=>{void openDestinationPicker();}}
   style={[styles.field,{justifyContent:'center',opacity:editable?1:0.55}]}>
   <Text style={{color:palette.ink,fontSize:16}}>
    {destination||'Tocá para buscar y verificar tu destino'}
   </Text>
  </Pressable>
  <Text style={styles.small}>Buscá una dirección y verificá el marcador en Google Maps o Apple Maps. No se inicia un viaje al elegirla.</Text>
  <Modal visible={pickerOpen} animationType="slide" onRequestClose={closePicker}
   presentationStyle="pageSheet">
   <ScrollView style={styles.page} contentContainerStyle={styles.content}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Text accessibilityRole="header" style={[styles.heading,{fontSize:24}]}>
     Elegí tu destino
    </Text>
    <Text style={styles.text}>Escribí un lugar, calle, barrio o comercio de Paraguay.</Text>
    <TextInput style={styles.field} accessibilityLabel="Buscar lugar de destino"
     autoFocus value={query} maxLength={120}
     placeholder="Ej.: Avenida Brasil, Ciudad del Este"
     onChangeText={text=>{epoch.current++;setQuery(text);setCandidates([]);
      setSelected(null);setMapNotice('');setDestinationNotice('');}}
     onSubmitEditing={()=>{void searchPlace();}}
     returnKeyType="search"/>
    <Action label={searchBusy?'Buscando…':'Buscar en GPS'} busy={searchBusy}
     disabled={searchBusy||query.trim().length<4}
     onPress={()=>{void searchPlace();}}/>
    <Text accessibilityLiveRegion="polite" style={styles.small}>{destinationNotice}</Text>
    {candidates.map((place,index)=>
     <Pressable key={index+'-'+place.latitude+'-'+place.longitude}
      accessibilityRole="button"
      onPress={()=>{setSelected(place);setMapNotice('');
       // User selected a candidate: open the native map for visual checking.
       void viewSelectedMap(place);}}
      style={[styles.card,{borderColor:selected===place?palette.primary:palette.border}]}>
      <Text style={{fontSize:16,fontWeight:'700',color:palette.ink}}>{place.label}</Text>
      <Text style={styles.small}>Tocá para seleccionar este punto geográfico.</Text>
     </Pressable>
    )}
    {selected!==null&&<>
     <Text style={styles.text}>Destino elegido: {selected.label}</Text>
     <Action secondary label="Comprobar el marcador en el mapa"
      onPress={()=>{void viewSelectedMap();}}/>
     <Text accessibilityLiveRegion="polite" style={styles.small}>{mapNotice}</Text>
     <Action label="Confirmar este destino" onPress={confirmDestination}/>
    </>}
    <Action secondary label="Cancelar y volver al viaje" onPress={closePicker}/>
    <Text style={styles.small}>La selección procede del geocodificador del teléfono. El mapa externo permite inspeccionar el punto, pero no devuelve selecciones a Movete Fácil. La ruta y la tarifa todavía necesitan validación del servidor.</Text>
   </ScrollView>
  </Modal>
 </>;
}
