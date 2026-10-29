import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,ScrollView,Text,View} from 'react-native';
import {router,useFocusEffect,useLocalSearchParams} from 'expo-router';
import {Action,Panel,styles} from '../src/DriverUI';
import {useDriverMotoJourney} from '../src/DriverMotoJourneyProvider';
import {useDriverKycExpiry} from '../src/DriverKycExpiryProvider';
import {useDriverWorkspace} from '../src/DriverWorkspaceProvider';

const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const STATUS:Record<string,string>={
 accepted:'Viaje MOTO asignado por PostgreSQL',
 arriving:'Llegada MOTO registrada en PostgreSQL',
 in_progress:'Trayecto MOTO iniciado en PostgreSQL',
 completed:'Viaje MOTO finalizado en PostgreSQL'
};
const NEXT:Record<string,string>={
 arriving:'Confirmar llegada MOTO',
 in_progress:'Confirmar recogida MOTO',
 completed:'Confirmar finalización MOTO'
};
/** No driver may start from a handset-supplied claim alone. G169 checks the
 * original G118 booking, JWT role/session and owner-scoped SQL on every GET.
 * G71 and real municipal authorization must permit acceptance beforehand. */
export default function DriverMotoTripScreen(){
 const args=useLocalSearchParams<{bookingKey?:string}>();
 const bookingKey=typeof args.bookingKey==='string'&&ID.test(args.bookingKey)
  ?args.bookingKey:null;
 const {state,enabled,open,refresh,advance}=useDriverMotoJourney();
 const kyc=useDriverKycExpiry();
 const workspace=useDriverWorkspace();
 const lock=useRef(false),pollLock=useRef(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{
  if(enabled&&bookingKey&&state.phase==='ready')void open(bookingKey);
 },[enabled,bookingKey,state.phase,open]);
 useFocusEffect(useCallback(()=>{
  let focused=true;
  const sync=async()=>{
   if(!focused||pollLock.current||AppState.currentState!=='active'
    ||state.bookingKey!==bookingKey||
    !['active','uncertain'].includes(state.phase))return;
   pollLock.current=true;
   try{await refresh();}finally{pollLock.current=false;}
  };
  const handle=setInterval(()=>{void sync();},10000);
  const app=AppState.addEventListener('change',s=>{
   if(s==='active')void sync();
  });
  return ()=>{focused=false;clearInterval(handle);app.remove();};
 },[refresh,bookingKey,state.bookingKey,state.phase]));
 const own=bookingKey!==null&&state.bookingKey===bookingKey
  &&state.tripId!==null;
 const legal=workspace.state.phase==='connected'&&
  kyc.snapshot?.state==='READY_QA'&&
  kyc.snapshot.accountBlocked===false;
 const canAdvance=enabled&&own&&legal&&state.phase==='active'
  &&!state.uncertain&&state.nextState!==null&&!busy;
 async function nextStep(){
  if(lock.current||!canAdvance)return;
  lock.current=true;setBusy(true);setNotice('');
  try{
   if(!await kyc.verifyForOffer()){
    setNotice('No se pudo comprobar vigencia documental. No se envió ninguna transición.');
    return;
   }
   await advance();
  }catch{
   setNotice('No se confirmó el paso. Consultá el estado original; no se repetirá automáticamente.');
  }finally{lock.current=false;setBusy(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Viaje MOTO · Driver</Text>
   <Text style={styles.heroSub}>Solo reserva original autorizada por el servidor de pruebas.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Asignación MOTO original G169</Text>
   {!enabled?<Text style={styles.text}>No existe conexión HTTPS STAGING aprobada.
    Los movimientos MOTO están bloqueados.</Text>:
    !bookingKey?<Text style={styles.text}>Falta una reserva MOTO con identificador válido.
     No se genera otra reserva.</Text>:
    state.phase==='loading'||state.phase==='ready'||state.phase==='submitting'?
     <Text style={styles.text}>Consultando la asignación real del servidor…</Text>:
    state.phase==='uncertain'?<Text accessibilityRole="alert" style={styles.text}>
     El servidor podría haber guardado el último paso. No se enviará otra operación sin recuperar y verificar su estado.</Text>:
    own&&['active','terminal'].includes(state.phase)?
     <>
      <Text style={styles.heading}>{STATUS[state.status??'']??'Estado no reconocido'}</Text>
      <Text style={styles.small}>Viaje original verificado · revisión {state.revision??'pendiente'}</Text>
      {state.phase==='terminal'&&<Text style={styles.text}>
       Finalizado en PostgreSQL QA. No confirma traslado físico ni cobro.</Text>}
     </>:
    <Text style={styles.text}>El servidor no ha confirmado que esta reserva MOTO pertenezca a tu identidad. No hay movimientos permitidos.</Text>}
   {canAdvance&&state.nextState&&<Action
    label={busy?'Revalidando documentación…':NEXT[state.nextState]}
    disabled={busy} onPress={()=>{void nextStep();}}/>}
   {notice!==''&&<Text accessibilityRole="alert" style={styles.text}>{notice}</Text>}
   {enabled&&bookingKey&&<Action
    label="Consultar el estado original sin repetir operaciones" secondary
    disabled={busy||state.phase==='submitting'||state.phase==='loading'}
    onPress={()=>{void (state.phase==='ready'?open(bookingKey):refresh());}}/>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Seguridad y autorización</Text>
   <Text style={styles.text}>Esta pantalla no acepta ofertas, no asigna conductores,
    no fabrica permisos municipales y no activa viajes reales.</Text>
   <Text style={styles.small}>Para cada paso, el servidor exige sesión Driver
    verificable y revisión exacta de la misma reserva MOTO.
    Nunca se inventan GPS, distancia, ingresos ni cobros.</Text>
  </Panel>
  <Action label="Volver al panel Driver" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}
