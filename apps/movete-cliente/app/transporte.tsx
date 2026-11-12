/** Explicit AUTO/MOTO passenger choice, without mixing cargo/merchant modes. */
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {router} from 'expo-router';
import {AppState,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
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
 const [gpsBusy,setGpsBusy]=useState(false);
 const [searchBusy,setSearchBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 const mounted=useRef(true);
 const active=useRef(AppState.currentState!=='background'&&AppState.currentState!=='inactive');
 const gpsEpoch=useRef(0),searchEpoch=useRef(0);
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
    setPickup(null);setPickupAccuracy(null);
    setPickupNotice(result.code==='LOCATION_DENIED'
     ?'No hay permiso GPS. Podés activarlo desde los ajustes del teléfono.'
     :result.code==='GPS_NOT_PRECISE'||result.code==='UNKNOWN_ACCURACY'
     ?'La precisión es insuficiente. Movete a un lugar con mejor señal y reintentá.'
     :'GPS no disponible. No se repetirá automáticamente. Podés reintentar.');
    return;
   }
   setPickup(result.place);setOrigin(result.place.label);
   setPickupAccuracy(result.accuracyMeters);
   setPickupNotice('Origen obtenido del GPS. Confirmá que sea el punto correcto.');
  }finally{
   locationBudget.end('gps');
   if(mounted.current)setGpsBusy(false);
  }
 },[privateRevision,locationBudget]);
 useEffect(()=>{
  mounted.current=true;
  active.current=AppState.currentState!=='background';
  // One automatic GPS acquisition per screen entry. Permission dialogues
  // can toggle "inactive" then "active": never restart GPS for that event.
  if(active.current)void refreshPickup(false);
  const sub=AppState.addEventListener('change',status=>{
   if(status==='background'){
    active.current=false;gpsEpoch.current++;searchEpoch.current++;
    setSuggestions([]);
    setDestinationNotice('Escribí la dirección y tocá Buscar cuando vuelvas a la app.');
   }else if(status==='active'){
    active.current=true;
    // NO automatic re-entry into GPS or geocoder after a permission modal.
   }
  });
  return ()=>{mounted.current=false;active.current=false;
   gpsEpoch.current++;searchEpoch.current++;sub.remove();};
 },[refreshPickup]);
 async function findDestination(){
  if(!mounted.current||!active.current||destination.trim().length<4)return;
  const lease=locationBudget.beginDestination(destination);
  if(!lease.ok){
   setDestinationNotice(lease.code==='SEARCH_COOLDOWN'
    ?'Esperá unos segundos antes de buscar nuevamente.'
    :'Hay otra consulta de ubicación en curso. Intentá al terminar.');
   return;
  }
  const epoch=++searchEpoch.current;
  const query=destination.trim();
  setSearchBusy(true);setSuggestions([]);
  setDestinationNotice('Buscando direcciones. El teléfono realizará una sola consulta…');
  try{
   const result=await searchPassengerDestination(query);
   if(!mounted.current||!active.current||epoch!==searchEpoch.current)return;
   if(!result.ok){
    setDestinationNotice(result.code==='LOCATION_DENIED'
     ?'El buscador de Android requiere permiso de ubicación.'
     :'No se encontró una dirección verificable. Agregá calle y ciudad y volvé a buscar.');
    return;
   }
   setSuggestions(result.places);
   setDestinationNotice('Elegí el destino de esta lista.');
  }finally{
   locationBudget.end('destination');
   if(mounted.current)setSearchBusy(false);
  }
 }
 const choice=selectPassengerVehicle(vehicle);
 const routeReview=reviewLocalRouteDraft({origin,destination,stops:[],revision:0});
 const pointsSelected=pickup!==null&&dropoff!==null&&
  pickup.label===origin&&dropoff.label===destination;
 const canContinue=choice.ok&&routeReview.ok&&pointsSelected;
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
   <TextInput style={styles.field} value={origin} maxLength={120}
    accessibilityLabel="Origen de transporte" placeholder="Buscando ubicación GPS…"
    onChangeText={value=>{gpsEpoch.current++;setOrigin(value);setPickup(null);
     setPickupAccuracy(null);setFeedback('');
     setPickupNotice('Origen editado sin coordenadas verificadas. Usá el GPS.');}}/>
   <Text accessibilityLiveRegion="polite" style={styles.small}>{pickupNotice}</Text>
   {pickupAccuracy!==null&&<Text style={styles.small}>
    Precisión comunicada por Android: ±{Math.round(pickupAccuracy)} m. Confirmá el punto antes de viajar.
   </Text>}
   <Action secondary label={gpsBusy?'Consultando GPS…':'Actualizar ubicación GPS'}
    disabled={gpsBusy||searchBusy} onPress={()=>{void refreshPickup(true);}}/>
   <Text style={styles.text}>¿A dónde vas?</Text>
   <TextInput style={styles.field} value={destination} maxLength={120}
    accessibilityLabel="Destino de transporte" placeholder="Calle, comercio, barrio y ciudad"
    onChangeText={value=>{searchEpoch.current++;setDestination(value);setDropoff(null);
     setSuggestions([]);setFeedback('');
     setDestinationNotice('Escribí la calle y ciudad. Tocá Buscar para ver sugerencias.');}}/>
   <Action secondary label={searchBusy?'Buscando dirección…':'Buscar destinos'}
    disabled={gpsBusy||searchBusy||destination.trim().length<4||dropoff!==null}
    onPress={()=>{void findDestination();}}/>
   <Text accessibilityLiveRegion="polite" style={styles.small}>{destinationNotice}</Text>
   {suggestions.map((option,i)=><Pressable key={String(i)+'-'+option.latitude+'-'+option.longitude}
    accessibilityRole="button" onPress={()=>{
     setDestination(option.label);setDropoff(option);setSuggestions([]);
     setDestinationNotice('Destino seleccionado del buscador geográfico. Comprobá la dirección.');
    }} style={{padding:12,borderRadius:12,borderWidth:1,borderColor:'#D1E3E0'}}>
    <Text style={styles.text}>{option.label}</Text>
    <Text style={styles.small}>
     Dirección localizada en Paraguay · Confirmá el punto antes de viajar
    </Text>
   </Pressable>)}
   <Action secondary label="Intercambiar origen y destino"
    onPress={()=>{setOrigin(destination);setDestination(origin);
     setPickup(dropoff);setDropoff(pickup);
     setSuggestions([]);setFeedback('');
     setPickupNotice('Punto intercambiado. Verificá la ubicación antes de viajar.');
     setDestinationNotice('Punto intercambiado. Confirmá el destino.');}}/>
   <Text style={styles.small}>El origen procede del GPS con tu permiso. Para evitar bloqueos del teléfono, el destino se busca solo al tocar Buscar; luego elegís una dirección de la lista. Se conserva solo en memoria; las coordenadas aún requieren un contrato de ruta validado por el servidor para realizar reservas reales.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>3 · Continuá con tu viaje</Text>
   <Text accessibilityLiveRegion="polite" style={styles.text}>
    {choice.ok?(canContinue
     ?'Origen GPS y destino geográfico seleccionados. Falta verificar cobertura, tarifa y ruta por servidor antes de una reserva.'
     :'Seleccioná el origen GPS y un destino de las sugerencias; comprobá que sean distintos.'):'Seleccioná AUTO o MOTO para continuar.'}
   </Text>
   <Action large label={choice.ok?'Continuar con '+choice.kind:'Primero elegí un vehículo'}
    disabled={!canContinue} onPress={continueToRide}
    hint="Abre el formulario del vehículo elegido, sin reservar ni cobrar"/>
   {feedback!==''&&<Text accessibilityRole="alert" style={styles.small}>{feedback}</Text>}
   <Action secondary label="Volver al inicio" onPress={()=>router.back()}/>
  </Panel>
 </ScrollView>;
}
