import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {validateRideDraft} from '../src/domain/capabilities.mjs';
export default function ClientHome(){
 const [pickup,setPickup]=useState('');
 const [destination,setDestination]=useState('');
 const [vehicleKind,setVehicleKind]=useState<'AUTO'|'MOTO'>('AUTO');
 const [result,setResult]=useState('');
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Movete Fácil Cliente</Text>
   <Text style={styles.heroSub}>Pedí un automóvil o prepará un envío. Esta versión no reserva ni factura servicios reales.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Preparar un viaje</Text>
   <Text style={styles.text}>Desde dónde salís</Text>
   <TextInput style={styles.field} value={pickup} onChangeText={setPickup}
    placeholder="Punto de origen" accessibilityLabel="Origen del viaje" maxLength={120}/>
   <Text style={styles.text}>A dónde vas</Text>
   <TextInput style={styles.field} value={destination} onChangeText={setDestination}
    placeholder="Punto de destino" accessibilityLabel="Destino del viaje" maxLength={120}/>
   <View style={[styles.row,{justifyContent:'flex-start'}]}>
    <View style={{flex:1}}><Action label="Automóvil" secondary={vehicleKind!=='AUTO'} onPress={()=>setVehicleKind('AUTO')}/></View>
    <View style={{flex:1}}><Action label="Motocicleta" secondary disabled onPress={()=>setVehicleKind('MOTO')}/></View>
   </View>
   <Text style={styles.small}>Los viajes con pasajeros en moto están deshabilitados hasta completar la autorización legal y operativa por zona.</Text>
   <Action label="Validar solicitud DEMO" onPress={()=>{
    const checked=validateRideDraft({pickup,destination,vehicleKind});
    setResult(checked.ok?'Solicitud local válida. Todavía no se buscó ni notificó a ningún conductor.':checked.reason);
   }}/>
   {result!==''&&<Text accessibilityRole="alert" style={[styles.text,{color:palette.primary}]}>{result}</Text>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Envíos</Text>
   <Text style={styles.text}>Enviá documentos, paquetes y pedidos habilitados, usando vehículos compatibles con peso y tamaño.</Text>
   <Action secondary label="Preparar un envío" onPress={()=>router.push('/envios')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mis servicios</Text>
   <Action secondary label="Seguimiento" onPress={()=>router.push('/seguimiento')}/>
   <Action secondary label="Historial" onPress={()=>router.push('/historial')}/>
  </Panel>
 </ScrollView>;
}
