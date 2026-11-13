import React,{useMemo} from 'react';
import {router} from 'expo-router';
import {useIncomingShare} from 'expo-sharing';
import {ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {readGoogleMapsShare,stageGoogleMapsShare} from '../src/domain/client-google-maps-share.mjs';

export default function ReceiveMapsLocation(){
 const {sharedPayloads,clearSharedPayloads,error}=useIncomingShare();
 const candidate=useMemo(()=>readGoogleMapsShare(sharedPayloads),[sharedPayloads]);
 function cancel(){clearSharedPayloads();router.replace('/transporte');}
 function accept(){
  if(!candidate.ok||!stageGoogleMapsShare(candidate.query))return;
  clearSharedPayloads();router.replace('/transporte');
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag">
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>
    Recibir lugar de Google Maps
   </Text>
   <Text style={styles.text}>Este lugar se compartió desde otra aplicación.
    Solo se utilizará para buscarlo y confirmar su posición en Paraguay.
    Ningún viaje ni pago se realizará automáticamente.</Text>
   {candidate.ok?<View style={{gap:12}}>
    <Text style={styles.text}>Lugar recibido:</Text>
    <Text style={{fontSize:19,fontWeight:'700',color:'#183044'}}>{candidate.query}</Text>
    <Text style={styles.small}>Al continuar, verificá el resultado y confirmá el destino
     dentro de Movete Fácil. Google Maps no garantiza coordenadas desde enlaces compartidos.</Text>
    <Action label="Buscar y confirmar este destino" onPress={accept}/>
   </View>:<Text accessibilityRole="alert" style={styles.text}>
    {candidate.code==='PLACE_NAME_REQUIRED'
     ?'El enlace corto de Google Maps no contiene un nombre verificable. Regresá y escribí el lugar en el buscador de Movete Fácil.'
     :'No se recibió un lugar válido de Google Maps. Podés regresar y buscarlo manualmente.'}
   </Text>}
   {error&&<Text accessibilityRole="alert" style={styles.small}>
    No se pudo interpretar el contenido compartido.</Text>}
   <Action secondary label="Volver a transporte" onPress={cancel}/>
  </Panel>
 </ScrollView>;
}
