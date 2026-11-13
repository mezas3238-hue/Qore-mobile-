/** Explicit AUTO/MOTO passenger choice, without mixing cargo/merchant modes. */
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {router} from 'expo-router';
import {AppState,Linking,Platform,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView,usePassengerRideIntent} from '../src/ClientRuntime';
import {reviewLocalRouteDraft} from '../src/domain/client-route-editor.mjs';
import {selectPassengerVehicle} from '../src/domain/passenger-vehicle-choice.mjs';
import {getPassengerCurrentPickup,searchPassengerDestination}
 from '../src/native/client-location';
import type {PassengerPlace} from '../src/native/client-location';
import {isCurrentPassengerLocationResult}
 from '../src/domain/client-geolocation.mjs';
import {createClientLocationWorkBudget}
 from '../src/domain/client-location-work-budget.mjs';
import {createPassengerMapPreviewLinks}
 from '../src/domain/client-map-preview.mjs';
import {createGoogleMapsLaunchUrl,createGoogleMapsDirectionsUrl}
 from '../src/domain/client-google-maps-links.mjs';
import {consumeGoogleMapsShare}
 from '../src/domain/client-google-maps-share.mjs';
import {createClientDestinationAutocompleteGate}
 from '../src/domain/client-destination-autocomplete.mjs';
import type {PassengerVehicleKind} from '../src/domain/passenger-vehicle-choice.mjs';

export default function ChoosePassengerVehicle(){
 const {view}=useClientView({polling:false});
 // A JWT/Passenger epoch change must erase unsent address fields from the
 // visible form, not only from its in-memory intent cache.
 return <PrivatePassengerVehicleForm key={view.privateViewRevision}
  privateRevision={view.privateViewRevision}/>;
}
function PrivatePassengerVehicleForm({privateRevision}:{privateRevision:number}){
 const intent=usePassengerRideIntent();
 const [vehicle,setVehicle]=useState<PassengerVehicleKind|null>(null);
 const [origin,setOrigin]=useState('');
 const [destination,setDestination]=useState('');
 const [pickup,setPickup]=useState<PassengerPlace|null>(null);
 const [dropoff,setDropoff]=useState<PassengerPlace|null>(null);
 const [pickupAccuracy,setPickupAccuracy]=useState<number|null>(null);
 const [pickupNotice,setPickupNotice]=useState('Localizando tu origen con GPS…');
 const [destinationNotice,setDestinationNotice]=useState('Escribí el lugar o calle y elegí una sugerencia.');
 const [suggestions,setSuggestions]=useState<readonly PassengerPlace[]>([]);
 const [pickupSuggestions,setPickupSuggestions]=useState<readonly PassengerPlace[]>([]);
 const [pickupConfirmed,setPickupConfirmed]=useState(false);
 const [destinationConfirmed,setDestinationConfirmed]=useState(false);
 const [mapNotice,setMapNotice]=useState('');
 const [editingPickup,setEditingPickup]=useState(false);
 const [destinationFocused,setDestinationFocused]=useState(false);
 // External Google Maps is user-triggered; no SDK/API key or background polling.
 const [gpsBusy,setGpsBusy]=useState(false);
 const [searchBusy,setSearchBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 const mounted=useRef(true);
 const active=useRef(AppState.currentState!=='background'&&AppState.currentState!=='inactive');
 const gpsEpoch=useRef(0),searchEpoch=useRef(0);
 const lastPickupFixAt=useRef<number|null>(null);
 const autocompleteGate=useMemo(()=>createClientDestinationAutocompleteGate(),[]);
 // One native operation at a time, with an explicit cooldown and no loop.
 const locationBudget=useMemo(()=>createClientLocationWorkBudget(),[]);
 const isValid=(epoch:number)=>isCurrentPassengerLocationResult({
  requestEpoch:epoch,currentEpoch:gpsEpoch.current,
  privateRevision,activeRevision:privateRevision,appActive:active.current
 })&&mounted.current;
 const refreshPickup=useCallback(async(manual=false)=>{
  if(!active.current)return;
  const permit=locationBudget.beginGps({manual});
  if(!permit.ok){
   if(manual&&mounted.current)
    setPickupNotice(permit.code==='GPS_COOLDOWN'
     ?'El GPS ya fue consultado. Reintentá más tarde para evitar sobrecargar el celular.'
     :'Una consulta de ubicación ya está en curso.');
   return;
  }
  const epoch=++gpsEpoch.current;
  setGpsBusy(true);setPickupNotice('Consultando GPS una sola vez…');
  try{
   const result=await getPassengerCurrentPickup();
   if(!isValid(epoch))return;
   if(!result.ok){
    setPickup(null);setPickupAccuracy(null);setPickupConfirmed(false);
    lastPickupFixAt.current=null;
    setPickupNotice(result.code==='LOCATION_DENIED'
     ?'No hay permiso GPS. Podés activarlo desde los ajustes del teléfono.'
     :result.code==='GPS_NOT_PRECISE'||result.code==='UNKNOWN_ACCURACY'
     ?'La precisión es insuficiente. Movete a un lugar con mejor señal y reintentá.'
     :'GPS no disponible. No se repetirá automáticamente. Podés reintentar.');
    return;
   }
   setPickup(result.place);setOrigin(result.place.label);
   lastPickupFixAt.current=Date.now();
   setPickupConfirmed(false);setPickupSuggestions([]);
   setPickupAccuracy(result.accuracyMeters);
   setPickupNotice('Origen obtenido del GPS. Confirmá que sea el punto correcto.');
  }finally{
   locationBudget.end('gps');
   if(mounted.current)setGpsBusy(false);
  }
 },[privateRevision,locationBudget]);
 useEffect(()=>{
  // Shared Maps place is a proposed SEARCH TEXT, never a trusted coordinate.
  // Consume exactly once from RAM, never through a URL or persistent storage.
  const shared=consumeGoogleMapsShare();
  if(shared){
   searchEpoch.current++;setDestination(shared.query);setDropoff(null);
   setDestinationConfirmed(false);setSuggestions([]);
   setDestinationNotice('Lugar recibido de Google Maps. Tocá Buscar destinos, elegí el resultado de Paraguay y confirmalo.');
   setMapNotice('Google Maps compartió el nombre, no una ubicación geográfica certificada.');
  }
 },[]);
 useEffect(()=>{
  mounted.current=true;
  active.current=AppState.currentState!=='background';
  // One automatic GPS acquisition per screen entry. Permission dialogues
  // can toggle "inactive" then "active": never restart GPS for that event.
  if(active.current)void refreshPickup(false);
  const sub=AppState.addEventListener('change',status=>{
   if(status==='background'){
    active.current=false;gpsEpoch.current++;searchEpoch.current++;
    setDestinationFocused(false);setSuggestions([]);setPickupSuggestions([]);
    setDestinationNotice('Escribí la dirección y tocá Buscar cuando vuelvas a la app.');
   }else if(status==='active'){
    active.current=true;
    // NO automatic re-entry into GPS or geocoder after a permission modal.
   }
  });
  return ()=>{mounted.current=false;active.current=false;
   gpsEpoch.current++;searchEpoch.current++;sub.remove();};
 },[refreshPickup]);
 async function findPlace(kind:'pickup'|'destination'){
  const query=(kind==='pickup'?origin:destination).trim();
  if(!mounted.current||!active.current||query.length<4)return;
  // Same serialized/cooldown native geocoder for both ends of the trip.
  const lease=locationBudget.beginDestination(query);
  if(!lease.ok){
   const note=lease.code==='SEARCH_COOLDOWN'
    ?'Esperá unos segundos antes de buscar nuevamente.'
    :'Hay otra consulta de ubicación en curso. Intentá al terminar.';
   if(kind==='pickup')setPickupNotice(note);else setDestinationNotice(note);
   return;
  }
  const epoch=++searchEpoch.current;
  setSearchBusy(true);setSuggestions([]);setPickupSuggestions([]);
  if(kind==='pickup')setPickupNotice('Buscando puntos de recogida en Paraguay…');
  else setDestinationNotice('Buscando direcciones en Paraguay…');
  try{
   if(kind==='destination')autocompleteGate.markStarted(query);
   const result=await searchPassengerDestination(query);
   if(!mounted.current||!active.current||epoch!==searchEpoch.current)return;
   if(!result.ok){
    const note=result.code==='LOCATION_DENIED'
     ?'El buscador de Android requiere permiso de ubicación.'
     :'No se encontró un lugar verificable. Agregá calle y ciudad y volvé a buscar.';
    if(kind==='pickup')setPickupNotice(note);else setDestinationNotice(note);
    return;
   }
   if(kind==='pickup'){
    setPickupSuggestions(result.places);
    setPickupNotice('Elegí el punto de recogida y confirmalo en el mapa.');
   }else{
    setSuggestions(result.places);
    setDestinationNotice('Elegí una de las direcciones sugeridas para confirmar el destino.');
   }
  }finally{
   locationBudget.end('destination');
   if(mounted.current)setSearchBusy(false);
  }
 }
 // After a brief pause in typing, search automatically and show candidates.
 // One native geocoder at a time; G319 budget enforces a 3-second cooldown.
 // Do not re-query on focus/foreground loops or every keystroke.
 useEffect(()=>{
  if(!destinationFocused||!active.current||gpsBusy||searchBusy||dropoff!==null)return;
  const plan=autocompleteGate.plan(destination);
  if(!plan)return;
  const handle=setTimeout(()=>void findPlace('destination'),plan.delayMs);
  return ()=>clearTimeout(handle);
 },[destination,destinationFocused,dropoff,gpsBusy,searchBusy,autocompleteGate]);
 async function openPlaceOnMap(place:PassengerPlace|null){
  if(!place)return;
  const links=createPassengerMapPreviewLinks(place,Platform.OS);
  if(!links){setMapNotice('No se pudo preparar la vista del mapa.');return;}
  // Only an explicit button tap shares this one point with a map provider.
  // No background tracking, periodic GPS or address in a URL.
  try{
   await Linking.openURL(links.primary);
   if(mounted.current)setMapNotice('Comprobá el marcador en el mapa y regresá para confirmar el punto.');
  }catch{
   try{
    await Linking.openURL(links.fallback);
    if(mounted.current)setMapNotice('Comprobá el marcador en el navegador y regresá para confirmar el punto.');
   }catch{
    if(mounted.current)setMapNotice('No hay aplicación de mapas disponible. Podés verificar la dirección antes de continuar.');
   }
  }
 }
 async function openPersonalGoogleMaps(kind:'pickup'|'destination'){
  // No Maps SDK, no app key. The user explicitly initiates Google Maps.
  const url=createGoogleMapsLaunchUrl(kind,pickup);
  if(!url)return;
  try{
   await Linking.openURL(url);
   if(!mounted.current)return;
   if(kind==='pickup')
    setMapNotice('Google Maps muestra tu recogida. Regresá a Movete Fácil y confirmá el origen.');
   else
    setMapNotice('Buscá el lugar en Google Maps. Al regresar, escribí la dirección elegida abajo y seleccioná el resultado verificable.');
  }catch{
   if(mounted.current)setMapNotice('No se pudo abrir Google Maps. Usá el buscador de direcciones de Movete Fácil.');
  }
 }
 const choice=selectPassengerVehicle(vehicle);
 const routeReview=reviewLocalRouteDraft({origin,destination,stops:[],revision:0});
 const pointsSelected=pickup!==null&&dropoff!==null&&
  pickup.label===origin&&dropoff.label===destination&&
  pickupConfirmed&&destinationConfirmed;
 const canContinue=choice.ok&&routeReview.ok&&pointsSelected;
 async function openConfirmedRoadRoute(){
  // User-tap only: Maps owns any road route, distance, and travel time.
  // No local price or trip claim is derived from its navigation screen.
  if(!pointsSelected||!pickup||!dropoff)return;
  const url=createGoogleMapsDirectionsUrl(pickup,dropoff);
  if(!url){setMapNotice('Revisá los dos puntos antes de abrir la ruta.');return;}
  try{
   await Linking.openURL(url);
   if(mounted.current)setMapNotice(
    'Google Maps muestra un recorrido orientativo. La tarifa y la cobertura de Movete Fácil deben verificarse en el servidor.'
   );
  }catch{
   if(mounted.current)setMapNotice('No fue posible abrir la ruta en Google Maps.');
  }
 }
 function continueToRide(){
  // Navegar no cotiza, reserva ni inicia un despacho.
  if(!canContinue)return;
  const saved=intent.save({
   ownerRevision:privateRevision,kind:choice.kind,
   origin:routeReview.route.origin,destination:routeReview.route.destination
  });
  if(!saved.ok){setFeedback('La ruta no pudo prepararse. Revisá las direcciones.');return;}
  setFeedback('');
  // Solo route names: NUNCA se incluyen direcciones en URL, analytics o logs.
  if(choice.kind==='AUTO')router.push('/viaje');
  else if(choice.kind==='MOTO')router.push('/moto');
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>¿Cómo querés viajar?</Text>
   <Text style={styles.heroSub}>Elegí el vehículo para tu traslado. AUTO y MOTO son viajes de pasajeros diferentes de ENVÍOS y COMERCIOS.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>1 · Elegí tu vehículo</Text>
   <Action large label="AUTO · Viajar en automóvil" selected={vehicle==='AUTO'}
    secondary={vehicle!=='AUTO'} onPress={()=>setVehicle('AUTO')}/>
   <Text style={styles.small}>Transporte de pasajeros en automóvil. La comisión de la plataforma se configura desde Admin Web por el propietario y se aplica en el servidor. El subsidio al pasajero es 10 % según la política vigente.</Text>
   <Action large label="MOTO · Viajar en motocicleta" selected={vehicle==='MOTO'}
    secondary={vehicle!=='MOTO'} onPress={()=>setVehicle('MOTO')}/>
   <Text style={styles.small}>Transporte de pasajeros en motocicleta. La comisión de la plataforma se configura desde Admin Web por el propietario y se aplica en el servidor, sin copiar la del AUTO. El subsidio al pasajero es 10 %; además, la MOTO requiere requisitos legales y de seguridad específicos.</Text>
   <Text style={styles.small}>Elegir un vehículo no garantiza un conductor disponible, cobertura, precio ni reserva. La tarifa final en guaraníes debe venir del servidor autorizado.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>2 · Origen y destino</Text>
   <Text style={styles.text}>¿Dónde te buscamos?</Text>
   <Pressable accessibilityRole="button"
    accessibilityLabel="Detectar mi ubicación automáticamente con GPS"
    style={styles.field} disabled={gpsBusy} onPress={()=>{
     if(pickup!==null&&lastPickupFixAt.current!==null&&
      Date.now()-lastPickupFixAt.current<30000){
      setPickupNotice('Tu posición GPS ya está detectada. Comprobá el punto y confirmalo.');
     }else void refreshPickup(true);
    }}>
    <Text style={{fontSize:16,color:'#183044'}}>
     {gpsBusy?'Localizando con GPS…':origin||'Tocá para detectar tu posición GPS'}
    </Text>
   </Pressable>
   <Action secondary label={editingPickup?'Ocultar edición de recogida':'Elegir otro punto de recogida'}
    onPress={()=>setEditingPickup(v=>!v)}/>
   {editingPickup&&<>
    <TextInput style={styles.field} value={origin} maxLength={120}
     accessibilityLabel="Escribir otra recogida en Paraguay"
     placeholder="Calle, barrio y ciudad"
     onChangeText={value=>{gpsEpoch.current++;searchEpoch.current++;setOrigin(value);
      setPickup(null);setPickupAccuracy(null);setPickupConfirmed(false);
      setPickupSuggestions([]);setFeedback('');
      setPickupNotice('Origen editado: buscá la dirección para obtener coordenadas verificadas.');}}/>
    <Action secondary label={searchBusy?'Buscando…':'Buscar otro punto de recogida'}
     disabled={gpsBusy||searchBusy||origin.trim().length<4}
     onPress={()=>{void findPlace('pickup');}}/>
   </>}
   {pickupSuggestions.map((option,i)=><Pressable key={'pickup-'+i+'-'+option.latitude+'-'+option.longitude}
    accessibilityRole="button" onPress={()=>{
     setOrigin(option.label);setPickup(option);setPickupAccuracy(null);
     lastPickupFixAt.current=null;setPickupConfirmed(false);setPickupSuggestions([]);
     setPickupNotice('Recogida localizada en Paraguay. Comprobá el punto en Google Maps.');
    }} style={{padding:12,borderRadius:12,borderWidth:1,borderColor:'#D1E3E0'}}>
    <Text style={styles.text}>{option.label}</Text>
   </Pressable>)}
   <Text accessibilityLiveRegion="polite" style={styles.small}>{pickupNotice}</Text>
   {pickupAccuracy!==null&&<Text style={styles.small}>
    Precisión comunicada por Android: ±{Math.round(pickupAccuracy)} m. Confirmá el punto antes de viajar.
   </Text>}
   {pickup!==null&&<Text style={styles.small}>
    Punto GPS: {pickup.latitude.toFixed(6)}, {pickup.longitude.toFixed(6)}
   </Text>}
   <Action secondary label={gpsBusy?'Consultando GPS…':'Actualizar ubicación GPS'}
    disabled={gpsBusy||searchBusy} onPress={()=>{void refreshPickup(true);}}/>
   {pickup!==null&&pickup.label===origin&&<>
    <Action secondary label="Comprobar recogida en Google Maps (opcional)"
     onPress={()=>{void openPlaceOnMap(pickup);}}/>
    <Action label={pickupConfirmed?'Recogida confirmada':'Confirmar punto de recogida'}
     disabled={pickupConfirmed} onPress={()=>{setPickupConfirmed(true);
      setPickupNotice('Punto de recogida confirmado por el pasajero.');}}/>
   </>}
   <Text style={styles.text}>¿A dónde vas?</Text>
   <TextInput style={styles.field} value={destination} maxLength={120}
    accessibilityLabel="Buscar destino, sugerencias automáticas"
    placeholder="Escribí calle, local, barrio o lugar"
    returnKeyType="search"
    onFocus={()=>setDestinationFocused(true)}
    onSubmitEditing={()=>{void findPlace('destination');}}
    onChangeText={value=>{
     searchEpoch.current++;setDestination(value);setDropoff(null);
     setDestinationConfirmed(false);setSuggestions([]);setFeedback('');
     setDestinationNotice(value.trim().length>=4
      ?'Buscando opciones al dejar de escribir…'
      :'Escribí al menos cuatro caracteres para recibir opciones.');
    }}/>
   <Text accessibilityLiveRegion="polite" style={styles.small}>{destinationNotice}</Text>
   {suggestions.map((option,i)=><Pressable key={String(i)+'-'+option.latitude+'-'+option.longitude}
    accessibilityRole="button" onPress={()=>{
     setDestination(option.label);setDropoff(option);setSuggestions([]);
     setDestinationFocused(false);setDestinationConfirmed(false);
     setDestinationNotice('Destino geocodificado. Comprobá el marcador y confirmá el lugar.');
    }} style={{padding:12,minHeight:52,borderRadius:12,borderWidth:1,borderColor:'#D1E3E0'}}>
    <Text style={styles.text}>{option.label}</Text>
    <Text style={styles.small}>
     Dirección localizada en Paraguay · Confirmá el punto antes de viajar
    </Text>
   </Pressable>)}
   <Action secondary label={searchBusy?'Buscando…':'Buscar de nuevo (opcional)'}
    disabled={gpsBusy||searchBusy||destination.trim().length<4||dropoff!==null}
    onPress={()=>{void findPlace('destination');}}/>
   <Action secondary label="Buscar con Google Maps (opcional)"
    onPress={()=>{void openPersonalGoogleMaps('destination');}}/>
   {dropoff!==null&&dropoff.label===destination&&<>
    <Action secondary label="Ver destino en Google Maps"
     onPress={()=>{void openPlaceOnMap(dropoff);}}/>
    <Action label={destinationConfirmed?'Destino confirmado':'Confirmar destino'}
     disabled={destinationConfirmed} onPress={()=>{setDestinationConfirmed(true);
      setDestinationNotice('Destino confirmado por el pasajero.');}}/>
   </>}
   {pointsSelected&&<Action secondary label="Ver recorrido en mi Google Maps"
    hint="Abre Google Maps para ver la ruta; no reserva ni cotiza"
    onPress={()=>{void openConfirmedRoadRoute();}}/>}
   {mapNotice!==''&&<Text accessibilityLiveRegion="polite" style={styles.small}>{mapNotice}</Text>}
   <Action secondary label="Intercambiar origen y destino"
    onPress={()=>{setOrigin(destination);setDestination(origin);
     setPickup(dropoff);setDropoff(pickup);setPickupAccuracy(null);
     lastPickupFixAt.current=null;setDestinationFocused(false);
     setPickupConfirmed(false);setDestinationConfirmed(false);
     setSuggestions([]);setPickupSuggestions([]);setFeedback('');
     setPickupNotice('Punto intercambiado. Verificá la ubicación antes de viajar.');
     setDestinationNotice('Punto intercambiado. Confirmá el destino.');}}/>
   <Text style={styles.small}>El campo de origen obtiene la ubicación del GPS del teléfono;
    al escribir el destino aparecen opciones del buscador geográfico de Android sin API key
    de Google Maps. Si no aparece el lugar, podés buscarlo manualmente o usar Google Maps
    como apoyo. Las coordenadas se confirman en Movete Fácil; no hay seguimiento en segundo
    plano. El servidor debe validar la ruta y tarifa antes de reservar.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>3 · Continuá con tu viaje</Text>
   <Text accessibilityLiveRegion="polite" style={styles.text}>
    {choice.ok?(canContinue
     ?'Origen GPS y destino geográfico seleccionados. Falta verificar cobertura, tarifa y ruta por servidor antes de una reserva.'
     :'Verificá y confirmá la recogida y el destino; comprobá que sean distintos.'):'Seleccioná AUTO o MOTO para continuar.'}
   </Text>
   <Action large label={choice.ok?'Continuar con '+choice.kind:'Primero elegí un vehículo'}
    disabled={!canContinue} onPress={continueToRide}
    hint="Abre el formulario del vehículo elegido, sin reservar ni cobrar"/>
   {feedback!==''&&<Text accessibilityRole="alert" style={styles.small}>{feedback}</Text>}
   <Action secondary label="Volver al inicio" onPress={()=>router.back()}/>
  </Panel>
 </ScrollView>;
}
