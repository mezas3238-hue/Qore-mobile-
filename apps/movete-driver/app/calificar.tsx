import React,{useMemo,useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import * as Crypto from 'expo-crypto';
import {Action,Panel,styles} from '../src/DriverUI';
import {getNativeDriverAuth} from '../src/NativeDriverAuth';
import {createDriverVerifiedRating} from '../src/domain/driver-verified-rating.mjs';
import type {DriverRatingBody} from '../src/domain/driver-verified-rating.mjs';

const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
type Kind=DriverRatingBody['serviceKind'];
type Incident=DriverRatingBody['incidentCode'];
const kinds:Kind[]=['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO'];
const titles:Record<Kind,string>={
 AUTO_RIDE:'Viaje AUTO',MOTO_RIDE:'Viaje MOTO',
 DELIVERY_AUTO:'Envío AUTO',DELIVERY_MOTO:'Envío MOTO'
};
const incidentOptions:{id:Incident;label:string}[]=[
 {id:null,label:'Sin incidente'},
 {id:'SUSPECTED_FRAUD',label:'Sospecha de fraude'},
 {id:'SAFETY',label:'Seguridad'},
 {id:'NO_SHOW',label:'No se presentó'},
 {id:'INCORRECT_ITEM',label:'Artículo incorrecto'},
 {id:'OTHER',label:'Otro incidente'}
];
export default function CalificarClienteDriver(){
 const params=useLocalSearchParams<{serviceId?:string;serviceKind?:string}>();
 const rating=useMemo(()=>{
  const approved=process.env.EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED==='true';
  const configured=approved&&
   process.env.EXPO_PUBLIC_G155_OWNER_APPROVED==='true'&&
   process.env.EXPO_PUBLIC_G155_BACKEND_CONTRACT_VERIFIED==='true'&&
   process.env.EXPO_PUBLIC_G155_ORIGINAL_COMPLETION_VERIFIED==='true'&&
   process.env.EXPO_PUBLIC_G155_EXTERNAL_RUNTIME_VERIFIED==='true'&&
   process.env.EXPO_PUBLIC_G155_PROVIDER_REVOCATION_VERIFIED==='true';
  return createDriverVerifiedRating({
   enabled:configured,ownerApproved:configured,
   contractVerified:configured,originalCompletionVerified:configured,
   externalRuntimeVerified:configured,providerRevocationVerified:configured,
   apiOrigin:process.env.EXPO_PUBLIC_QORE_STAGING_API_ORIGIN,
   pinnedOrigin:process.env.EXPO_PUBLIC_QORE_STAGING_API_ORIGIN,
   getSession:()=>getNativeDriverAuth()?.getSession()??Promise.resolve(null)
  });
 },[]);
 const [serviceKind,setServiceKind]=useState<Kind>(
  kinds.includes(params.serviceKind as Kind)?params.serviceKind as Kind:'AUTO_RIDE');
 const [serviceId,setServiceId]=useState(
  typeof params.serviceId==='string'&&ID.test(params.serviceId)?params.serviceId:'');
 const [stars,setStars]=useState(5);
 const [incident,setIncident]=useState<Incident>(null);
 const [working,setWorking]=useState(false);
 const [notice,setNotice]=useState('');
 const sending=useRef(false);
 const key=useRef<{signature:string;requestKey:string}|null>(null);
 const changed=()=>{key.current=null;setNotice('');};
 async function submit(){
  if(sending.current||!rating.isConfigured()||!ID.test(serviceId)){
   setNotice('La calificación requiere un servicio finalizado y STAGING autorizado.');
   return;
  }
  const signature=[serviceId,serviceKind,stars,incident].join('|');
  if(key.current?.signature!==signature)
   key.current={signature,requestKey:Crypto.randomUUID()};
  sending.current=true;setWorking(true);setNotice('');
  try{
   const result=await rating.submit({
    requestKey:key.current.requestKey,serviceId,serviceKind,
    ratedKind:'CLIENT',stars,incidentCode:incident
   });
   setNotice(result.ok?
    'Calificación verificada por el servidor de pruebas; no aplica sanciones automáticas.':
    'Sin confirmación ('+result.code+'). Conservá el mismo servicio, estrellas y clave original ante un resultado incierto.');
  }catch{setNotice('Resultado incierto; no generes una nueva clave para repetir.');}
  finally{sending.current=false;setWorking(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Calificar al cliente</Text>
   <Text style={styles.heroSub}>Solo tras completar un viaje o una entrega. El servidor verifica identidad, participación y finalización real del registro QA.</Text>
  </View>
  {!rating.isConfigured()&&<Panel><Text accessibilityRole="alert" style={styles.text}>
   Calificaciones deshabilitadas hasta que Auth, PostgreSQL y STAGING externo estén aprobados. No se enviará ninguna valoración.
  </Text></Panel>}
  <Panel>
   <Text style={styles.heading}>Tipo de servicio</Text>
   {kinds.map(kind=><Action key={kind} label={titles[kind]}
    secondary={serviceKind!==kind} onPress={()=>{setServiceKind(kind);changed();}}/>)}
   <Text style={styles.small}>ID del servicio original completado</Text>
   <TextInput style={styles.field} accessibilityLabel="ID original del servicio"
    autoCapitalize="none" autoCorrect={false}
    value={serviceId} onChangeText={v=>{setServiceId(v.trim().toLowerCase());changed();}}
    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/>
   <Text style={styles.heading}>Calificación del cliente</Text>
   <View style={[styles.row,{flexWrap:'wrap',justifyContent:'flex-start'}]}>
    {[1,2,3,4,5].map(n=><Action key={n} label={n+' ★'}
     secondary={stars!==n} onPress={()=>{setStars(n);changed();}}/>)}
   </View>
   <Text style={styles.heading}>¿Hubo un incidente?</Text>
   {incidentOptions.map(item=><Action key={item.id??'none'} label={item.label}
    secondary={incident!==item.id} onPress={()=>{setIncident(item.id);changed();}}/>)}
   <Text style={styles.small}>Las estrellas no prueban estafas ni modifican el despacho. Toda denuncia requiere evidencia, revisión humana y derecho de apelación.</Text>
   <Action label={working?'Enviando…':'Calificar al cliente'}
    disabled={working||!rating.isConfigured()||!ID.test(serviceId)}
    onPress={()=>{void submit();}}/>
   {notice!==''&&<Text accessibilityRole="alert" style={styles.text}>{notice}</Text>}
  </Panel>
  <Action label="Volver" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}
