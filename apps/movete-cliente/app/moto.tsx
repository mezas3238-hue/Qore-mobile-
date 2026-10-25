/** MOTO_RIDE Passenger: independent, local-only route review until A certifies API. */
import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import {reviewMotoRideDraft} from '../src/domain/moto-ride-draft.mjs';

export default function PassengerMoto(){
 const {view}=useClientView();
 // Remount on subject/JWT revision: never preserve a previous rider's route.
 return <PrivateMoto key={view.privateViewRevision} authenticated={view.authenticated}/>;
}
function PrivateMoto({authenticated}:{authenticated:boolean}){
 const [origin,setOrigin]=useState('');
 const [destination,setDestination]=useState('');
 const [safetyAcknowledged,setSafetyAcknowledged]=useState(false);
 const [reviewed,setReviewed]=useState<ReturnType<typeof reviewMotoRideDraft>|null>(null);
 function edit(setter:(value:string)=>void,value:string){
  setter(value);setReviewed(null);
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>MOTO · Viaje de pasajeros</Text>
   <Text style={styles.heroSub}>Transporte de personas en motocicleta, separado de MOTO ENVÍOS. Preparación privada; sin reserva ni búsqueda de motociclista todavía.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Origen y destino</Text>
   <TextInput style={styles.field} value={origin} maxLength={120}
    accessibilityLabel="Origen del viaje MOTO"
    placeholder="¿Dónde te buscamos?"
    onChangeText={value=>edit(setOrigin,value)}/>
   <TextInput style={styles.field} value={destination} maxLength={120}
    accessibilityLabel="Destino del viaje MOTO"
    placeholder="¿A dónde vas?"
    onChangeText={value=>edit(setDestination,value)}/>
   <Text style={styles.small}>Las direcciones permanecen en este formulario y no se transmiten. El GPS y la ruta solo podrán venir de permisos y proveedor verificado.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Seguridad del pasajero</Text>
   <Text style={styles.text}>El servicio requiere motociclista autorizado, documentación y seguro válidos, casco homologado y verificación de las condiciones legales de cada zona. No garantizamos cobertura ni disponibilidad.</Text>
   <Action label={safetyAcknowledged?'Requisitos de seguridad: leídos':'Leer y reconocer requisitos de seguridad'}
    selected={safetyAcknowledged} secondary={!safetyAcknowledged}
    onPress={()=>{setSafetyAcknowledged(!safetyAcknowledged);setReviewed(null);}}/>
   <Text style={styles.small}>Reconocer estas condiciones no sustituye la comprobación legal del servidor, KYC, permiso de pasajeros o seguro.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Revisá tu ruta MOTO</Text>
   <Action label="Revisar ruta local (sin reservar)" onPress={()=>
    setReviewed(reviewMotoRideDraft({origin,destination,safetyAcknowledged}))}/>
   {reviewed&&<View accessibilityLiveRegion="polite">
    {reviewed.ok?<Text style={styles.text}>Origen: {reviewed.origin}\nDestino: {reviewed.destination}\nModalidad: MOTO pasajeros (MOTO_RIDE). Ruta revisada solo en este teléfono.</Text>:
     <Text style={styles.text}>{reviewed.reason}</Text>}
   </View>}
   {!authenticated&&<Text style={styles.small}>Para contratar el servicio cuando se habilite, se exigirá identidad de pasajero validada.</Text>}
   <Action label="Cotizar MOTO y solicitar conductor — pendiente de A" disabled
    hint="Sin endpoints MOTO_RIDE, certificación legal, tarifa del servidor ni autorización comercial"
    onPress={()=>{}}/>
   <Text style={styles.small}>No hay cotización, subsidio aplicado, conductor asignado, mapa real, ETA, chat ni viaje iniciado. Ningún importe se calcula en este dispositivo.</Text>
  </Panel>
 </ScrollView>;
}
