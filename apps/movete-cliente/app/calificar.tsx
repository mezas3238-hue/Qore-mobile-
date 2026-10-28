import React,{useMemo,useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import * as Crypto from 'expo-crypto';
import {Action,Panel,styles} from '../src/ClientUI';
import {getNativePassengerAuth} from '../src/NativePassengerAuth';
import {useClientView} from '../src/ClientRuntime';
import {createG155VerifiedRatingClient}
 from '../src/domain/g155-verified-rating-client.mjs';
import type {G155RatingKind,G155TargetKind,G155IncidentCode}
 from '../src/domain/g155-verified-rating-client.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds:readonly G155RatingKind[]=['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE'];
const labels:Record<G155RatingKind,string>={
 AUTO_RIDE:'Viaje en auto',MOTO_RIDE:'Viaje en moto',
 DELIVERY_AUTO:'Envío en auto',DELIVERY_MOTO:'Envío en moto',COMMERCE:'Comercio'
};
const incidentOptions:{id:G155IncidentCode|null;label:string}[]=[
 {id:null,label:'Sin incidente'},
 {id:'SUSPECTED_FRAUD',label:'Posible estafa'},
 {id:'SAFETY',label:'Problema de seguridad'},
 {id:'NO_SHOW',label:'No se presentó'},
 {id:'INCORRECT_ITEM',label:'Producto incorrecto'},
 {id:'OTHER',label:'Otro incidente'}
];
export default function CalificarServicio(){
 const params=useLocalSearchParams<{serviceId?:string;serviceKind?:string}>();
 const {view}=useClientView();
 const nativeAuth=useMemo(()=>getNativePassengerAuth(),[]);
 const gateway=useMemo(()=>createG155VerifiedRatingClient({
  enabled:process.env.EXPO_PUBLIC_G155_OWNER_APPROVED==='true',
  ownerApproved:process.env.EXPO_PUBLIC_G155_OWNER_APPROVED==='true',
  contractVerified:process.env.EXPO_PUBLIC_G155_BACKEND_CONTRACT_VERIFIED==='true',
  originalCompletionVerified:process.env.EXPO_PUBLIC_G155_ORIGINAL_COMPLETION_VERIFIED==='true',
  externalRuntimeVerified:process.env.EXPO_PUBLIC_G155_EXTERNAL_RUNTIME_VERIFIED==='true',
  providerRevocationVerified:process.env.EXPO_PUBLIC_G155_PROVIDER_REVOCATION_VERIFIED==='true',
  origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
  pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN,
  getSession:()=>nativeAuth?.readSession()??Promise.resolve(null)
 }),[nativeAuth]);
 const initialKind=kinds.includes(params.serviceKind as G155RatingKind)
  ?params.serviceKind as G155RatingKind:'AUTO_RIDE';
 const [kind,setKind]=useState<G155RatingKind>(initialKind);
 const [serviceId,setServiceId]=useState(
  typeof params.serviceId==='string'&&UUID.test(params.serviceId)?params.serviceId:'');
 const [target,setTarget]=useState<G155TargetKind>('DRIVER');
 const [stars,setStars]=useState(5);
 const [incident,setIncident]=useState<G155IncidentCode|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const key=useRef<{signature:string;requestKey:string}|null>(null);
 const lock=useRef(false);
 const targets:readonly G155TargetKind[]=kind==='COMMERCE'
  ?['MERCHANT','COURIER']:kind==='AUTO_RIDE'||kind==='MOTO_RIDE'
  ?['DRIVER']:['COURIER'];
 const actualTarget=targets.includes(target)?target:targets[0];
 async function submit(){
  if(lock.current)return;
  if(!gateway.isConfigured()||!view.authenticated||
   !UUID.test(serviceId)||serviceId!==serviceId.toLowerCase()){
   setMessage('Necesitás sesión verificada, código del servicio original y autorización STAGING.');
   return;
  }
  const signature=[view.account?.subject,serviceId,kind,actualTarget,stars,incident].join('|');
  if(key.current?.signature!==signature)
   key.current={signature,requestKey:Crypto.randomUUID()};
  const requestKey=key.current.requestKey;
  const startRevision=view.privateViewRevision;
  lock.current=true;setBusy(true);setMessage('');
  try{
   const response=await gateway.submit({
    requestKey,serviceId,serviceKind:kind,ratedKind:actualTarget,
    stars,incidentCode:incident
   });
   if(startRevision!==view.privateViewRevision)return;
   if(response.ok){
    setMessage('Calificación verificada en ensayo. ID: '+response.ratingId+
     '. No genera bloqueo automático ni cambia el despacho.');
   }else{
    setMessage('Sin confirmación: '+response.code+
     '. Conservá el mismo servicio y puntuación al reintentar.');
   }
  }catch{
   setMessage('Resultado desconocido: no crees otra calificación para este servicio.');
  }finally{lock.current=false;setBusy(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Text accessibilityRole="header" style={styles.heading}>Calificar un servicio</Text>
  <Text style={styles.text}>Las opiniones son privadas y vinculadas a servicios completados.
   Solo sus participantes pueden calificar. Las denuncias requieren investigación:
   nadie será expulsado automáticamente por recibir pocas estrellas.</Text>
  {!gateway.isConfigured()&&<Panel><Text style={styles.small}>
   Calificaciones STAGING todavía deshabilitadas hasta verificar servidor,
   autorización y PostgreSQL externos. No se enviará ninguna valoración.
  </Text></Panel>}
  <Panel>
   <Text style={styles.heading}>Servicio realizado</Text>
   {kinds.map(value=><Action key={value} label={labels[value]}
    selected={kind===value} secondary={kind!==value}
    onPress={()=>{setKind(value);setTarget(value==='COMMERCE'?'MERCHANT':
     value.endsWith('RIDE')?'DRIVER':'COURIER');key.current=null;setMessage('');}}/>)}
   <Text style={styles.small}>ID original de viaje, envío o pedido</Text>
   <TextInput accessibilityLabel="Identificador del servicio completado"
    autoCapitalize="none" autoCorrect={false}
    value={serviceId} onChangeText={v=>{setServiceId(v.trim().toLowerCase());key.current=null;setMessage('');}}
    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={styles.field}/>
   <Text style={styles.heading}>¿A quién calificás?</Text>
   {targets.map(value=><Action key={value} label={{
    DRIVER:'Al conductor',COURIER:'Al repartidor',MERCHANT:'Al comercio'
   }[value]} selected={actualTarget===value} secondary={actualTarget!==value}
    onPress={()=>{setTarget(value);key.current=null;setMessage('');}}/>)}
   <Text style={styles.heading}>Calificación</Text>
   <View style={styles.row}>
    {[1,2,3,4,5].map(n=><Action key={n} label={n+' ★'}
     selected={stars===n} secondary={stars!==n}
     onPress={()=>{setStars(n);key.current=null;setMessage('');}}/>)}
   </View>
   <Text style={styles.heading}>¿Querés reportar un incidente?</Text>
   {incidentOptions.map(opt=><Action key={opt.id??'none'} label={opt.label}
    selected={incident===opt.id} secondary={incident!==opt.id}
    onPress={()=>{setIncident(opt.id);key.current=null;setMessage('');}}/>)}
   <Action label={busy?'Enviando calificación…':'Enviar calificación verificada'}
    busy={busy} disabled={busy||!gateway.isConfigured()||!view.authenticated}
    onPress={()=>void submit()}/>
   {message!==''&&<Text accessibilityRole="alert" style={styles.small}>{message}</Text>}
  </Panel>
 </ScrollView>;
}
