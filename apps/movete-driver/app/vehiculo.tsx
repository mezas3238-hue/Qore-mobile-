import React,{useEffect,useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,palette,styles} from '../src/DriverUI';
import {useVerifiedDriverRuntimeAuth} from '../src/DriverApplicationProviders';
import {useDriverWorkspace} from '../src/DriverWorkspaceProvider';
import {submitDriverPendingVehicle,validateDriverPendingVehicleDraft}
 from '../src/domain/driver-vehicle-pending.mjs';
import type {DriverPendingVehicleKind,DriverPendingVehicleService}
 from '../src/domain/driver-vehicle-pending.mjs';

const enabled=process.env.EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED==='true'&&
 process.env.EXPO_PUBLIC_QORE_G287_VEHICLE_DRAFT_APPROVED==='true';
const errors:Record<string,string>={
 STAGING_VEHICLE_DRAFT_DISABLED:'Envío deshabilitado en esta compilación.',
 STAGING_ORIGIN_NOT_PINNED:'Falta comprobar el servidor STAGING autorizado.',
 INVALID_REAL_VEHICLE_DRAFT:'Revisá los campos del vehículo y la capacidad indicada.',
 VERIFIED_DRIVER_SESSION_UNAVAILABLE:'Iniciá sesión como Driver y verificá tu cuenta.',
 STAGING_REDIRECT_DENIED:'El servidor solicitó un redireccionamiento no permitido.',
 DRIVER_SESSION_REVOKED:'La sesión venció. Volvé a iniciar sesión.',
 DRIVER_ROLE_DENIED:'Esta cuenta no está autorizada para registrar vehículos.',
 VEHICLE_FIELDS_REJECTED:'El servidor rechazó uno o más datos del vehículo.',
 VEHICLE_RATE_LIMIT:'Se alcanzó el límite temporal de solicitudes.',
 STAGING_MUNICIPALITY_UNCONFIGURED:'El área de servicio aún no está configurada en el servidor STAGING. No tenés que ingresar códigos de municipio.',
 VEHICLE_PENDING_CONFLICT:'La solicitud no fue aceptada. Revisá los datos y no crees una nueva solicitud automáticamente.',
 VEHICLE_RECEIPT_INVALID:'No pudimos comprobar el comprobante de recepción.',
 VEHICLE_RECEIPT_UNCONFIRMED:'No se pudo confirmar la recepción. Conservamos la misma clave para un reintento manual.'
};
export default function DriverVehiclePending(){
 const auth=useVerifiedDriverRuntimeAuth();
 const {state:workspace}=useDriverWorkspace();
 const [kind,setKind]=useState<DriverPendingVehicleKind>('AUTO');
 const [service,setService]=useState<DriverPendingVehicleService>('economico');
 const [plate,setPlate]=useState('');
 const [brand,setBrand]=useState('');
 const [model,setModel]=useState('');
 const [year,setYear]=useState('');
 const [capacity,setCapacity]=useState('4');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [received,setReceived]=useState(false);
 const key=useRef<string|null>(null);
 const lock=useRef(false);
 const generation=useRef(0);
 const clearReceipt=()=>{
  generation.current+=1;
  key.current=null;
  setNotice('');setReceived(false);
 };
 useEffect(()=>{
  const unsub=auth?.subscribe?.(()=>{
   generation.current+=1;
   key.current=null;
   setNotice('');setReceived(false);
   setPlate('');setBrand('');setModel('');
  });
  return ()=>{generation.current++;unsub?.();};
 },[auth]);
 const draft={
  kind,service,
  plate:plate.trim().toUpperCase(),brand:brand.trim(),model:model.trim(),
  year:Number(year),passengerCapacity:Number(capacity)
 };
 const canSend=enabled&&workspace.phase==='connected'&&!busy&&!received;
 async function submit(){
  if(!canSend||lock.current)return;
  // Never automatically retry an uncertain write. Keep this idempotency key
  // for a manual retry of the IDENTICAL form and SAME Driver only.
  if(!validateDriverPendingVehicleDraft(draft)){
   setNotice(errors.INVALID_REAL_VEHICLE_DRAFT);return;
  }
  lock.current=true;setBusy(true);setNotice('');
  const epoch=generation.current;
  if(key.current===null)key.current=Crypto.randomUUID();
  try{
   const result=await submitDriverPendingVehicle({
    draft,requestKey:key.current,
    auth:auth!,
    apiOrigin:process.env.EXPO_PUBLIC_QORE_STAGING_API_ORIGIN??'',
    approvedStagingHost:process.env.EXPO_PUBLIC_QORE_STAGING_API_HOST??'',
    allowedByOwner:enabled,liveEnabled:false,request:fetch
   });
   if(epoch!==generation.current)return;
   if(result.ok){
    setReceived(true);
    setNotice('Solicitud recibida: PENDIENTE. No estás habilitado para hacer viajes.');
   }else setNotice(errors[result.code]??'La solicitud no está confirmada.');
  }catch{if(epoch===generation.current)
   setNotice('No se confirmó el envío. No cambies los datos antes de volver a intentar.');}
  finally{lock.current=false;setBusy(false);}
 }
 const field=(label:string,value:string,change:(s:string)=>void,options?:{
   numeric?:boolean;max?:number;uppercase?:boolean
 })=><>
   <Text style={styles.text}>{label}</Text>
   <TextInput style={styles.field} value={value}
    onChangeText={s=>{clearReceipt();change(options?.uppercase?s.toUpperCase():s);}}
    placeholder={label} accessibilityLabel={label}
    keyboardType={options?.numeric?'number-pad':'default'}
    autoCapitalize={options?.uppercase?'characters':'sentences'}
    maxLength={options?.max??80} editable={!busy&&!received}/>
  </>;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Registrar mi vehículo</Text>
   <Text style={styles.heroSub}>Solo STAGING. Enviá datos auténticos de tu automóvil o moto. La solicitud queda pendiente hasta la revisión documental y legal.</Text>
  </View>
  <Panel>
   {!enabled&&<Text accessibilityRole="alert" style={[styles.text,{color:palette.amber}]}>
    La recepción de vehículos todavía no está autorizada en esta versión de Driver. No se enviarán datos.
   </Text>}
   {workspace.phase!=='connected'&&<Text style={styles.small}>
    Iniciá sesión como conductor y conectá el backend STAGING aprobado para presentar la solicitud.
   </Text>}
   <Text style={styles.heading}>Tipo de vehículo</Text>
   <View style={styles.row}>
    <View style={{flex:1}}><Action label="AUTO" secondary={kind!=='AUTO'}
     disabled={busy||received} onPress={()=>{clearReceipt();setKind('AUTO');
      setService('economico');setCapacity('4');}}/></View>
    <View style={{flex:1}}><Action label="MOTO" secondary={kind!=='MOTO'}
     disabled={busy||received} onPress={()=>{clearReceipt();setKind('MOTO');
      setService('moto_pasajero');setCapacity('1');}}/></View>
   </View>
   {kind==='AUTO'&&<>
    <Text style={styles.text}>Categoría solicitada</Text>
    <View style={styles.row}>
     {(['economico','confort','xl'] as const).map(option=>
      <View key={option} style={{flex:1}}><Action label={option.toUpperCase()}
       secondary={service!==option} disabled={busy||received}
       onPress={()=>{clearReceipt();setService(option);setCapacity(option==='xl'?'6':'4');}}/></View>)}
    </View>
   </>}
   {field('Matrícula real',plate,setPlate,{max:12,uppercase:true})}
   {field('Marca',brand,setBrand,{max:80})}
   {field('Modelo',model,setModel,{max:80})}
   {field('Año de fabricación',year,setYear,{numeric:true,max:4})}
   {field('Capacidad de pasajeros (sin conductor)',capacity,setCapacity,{numeric:true,max:1})}
   <Text style={styles.small}>
    La matrícula y los detalles solo se envían por HTTPS a Railway STAGING
    con tu sesión Driver. No adjuntes fotos ni documentos en este formulario.
   </Text>
   <Action label={received?'Solicitud recibida — pendiente':busy?'Enviando…':'Enviar solicitud pendiente'}
    disabled={!canSend} onPress={()=>{void submit();}}/>
   {notice!==''&&<Text accessibilityRole="alert" style={[styles.text,{color:received?palette.teal:palette.amber}]}>{notice}</Text>}
   <Text style={styles.small}>
    No se aprueba automáticamente el vehículo ni la licencia. Las solicitudes
    comerciales y los viajes permanecen deshabilitados.
   </Text>
  </Panel>
 </ScrollView>;
}
