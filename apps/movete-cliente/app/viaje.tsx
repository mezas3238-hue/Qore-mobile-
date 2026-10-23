import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {validateRideDraft} from '../src/domain/capabilities.mjs';
type Service='economico'|'confort'|'xl';
const OPTIONS:{code:Service;title:string;description:string}[]=[
 {code:'economico',title:'Económico',description:'Preferencia por costo accesible'},
 {code:'confort',title:'Confort',description:'Preferencia por viaje cómodo'},
 {code:'xl',title:'XL',description:'Preferencia por vehículo de mayor capacidad'}
];
export default function RideRequest(){
 const [pickup,setPickup]=useState('');
 const [destination,setDestination]=useState('');
 const [service,setService]=useState<Service>('economico');
 const [validated,setValidated]=useState(false);
 const [feedback,setFeedback]=useState('');
 function editPickup(text:string){setPickup(text);setValidated(false);setFeedback('');}
 function editDestination(text:string){setDestination(text);setValidated(false);setFeedback('');}
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Pedí un automóvil</Text>
   <Text style={styles.heroSub}>Una solicitud segura comienza con dos puntos válidos. La búsqueda de conductores todavía no está conectada.</Text></View>
  <Panel>
   <Text style={styles.heading}>Paso 1 · Tu ruta</Text>
   <Text style={styles.text}>Origen</Text>
   <TextInput style={styles.field} value={pickup} onChangeText={editPickup}
     maxLength={120} placeholder="Ej.: Centro de San Lorenzo" accessibilityLabel="Origen del viaje"/>
   <Text style={styles.text}>Destino</Text>
   <TextInput style={styles.field} value={destination} onChangeText={editDestination}
     maxLength={120} placeholder="Ej.: Villa Morra, Asunción" accessibilityLabel="Destino del viaje"/>
   <Text style={styles.small}>Los puntos escritos todavía no se verifican en un mapa ni con geocodificación. No se ha calculado distancia.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Paso 2 · Tipo de servicio</Text>
   {OPTIONS.map(option=><View key={option.code}>
    <Action label={option.title} secondary={service!==option.code}
      onPress={()=>{setService(option.code);setValidated(false);setFeedback('');}}/>
    <Text style={styles.small}>{option.description}. Su disponibilidad depende del backend.</Text>
   </View>)}
   <Text style={styles.small}>Moto pasajeros: no disponible por requisitos de habilitación. La moto solo podrá usarse para envíos compatibles y legalmente autorizados.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Paso 3 · Validación local</Text>
   <Action label="Revisar borrador" onPress={()=>{
    const result=validateRideDraft({pickup,destination,vehicleKind:'AUTO'});
    setValidated(result.ok);
    setFeedback(result.ok?'Ruta preparada. No hay tarifa, disponibilidad ni conductor confirmados.':result.reason);
   }}/>
   {feedback!==''&&<Text accessibilityRole="alert" style={[styles.text,{color:palette.primary}]}>{feedback}</Text>}
   {validated&&<View>
    <Text style={styles.text}>Preferencia de servicio: {OPTIONS.find(o=>o.code===service)?.title}</Text>
    <Text style={styles.text}>Estado: pendiente de cotización y autorización servidor.</Text>
    <Text style={styles.small}>Sin precio, GPS, ETA ni patente hasta contar con evidencia real y sesión verificada.</Text>
   </View>}
   <Action label="Confirmar y buscar conductor — no disponible" disabled onPress={()=>{}}/>
   <Text style={styles.small}>Este botón solo se habilitará cuando exista cotización G7 vigente, identidad Passenger validada, zona elegible y API de viajes certificada por A.</Text>
  </Panel>
 </ScrollView>;
}
