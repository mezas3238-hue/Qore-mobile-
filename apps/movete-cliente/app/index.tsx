import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {validateRideDraft} from '../src/domain/capabilities.mjs';
export default function ClientHome(){
 const [pickup,setPickup]=useState('');
 const [destination,setDestination]=useState('');
 const [result,setResult]=useState('');
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Movete Fácil Cliente</Text>
   <Text style={styles.heroSub}>Automóviles, envíos y comercios en una sola app de cliente. Versión de QA sin solicitudes reales.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Prepará tu viaje en automóvil</Text>
   <Text style={styles.text}>Origen</Text>
   <TextInput style={styles.field} value={pickup} onChangeText={setPickup}
    placeholder="Punto de origen" accessibilityLabel="Origen del viaje" maxLength={120}/>
   <Text style={styles.text}>Destino</Text>
   <TextInput style={styles.field} value={destination} onChangeText={setDestination}
    placeholder="Punto de destino" accessibilityLabel="Destino del viaje" maxLength={120}/>
   <Text style={styles.small}>Solo automóvil: la moto para pasajeros no está habilitada. Una zona cubierta no implica que haya vehículos disponibles.</Text>
   <Action label="Validar borrador de viaje (DEMO)" onPress={()=>{
    const checked=validateRideDraft({pickup,destination,vehicleKind:'AUTO'});
    setResult(checked.ok?'Borrador válido. No se solicitó conductor ni se calculó un precio.':checked.reason);
   }}/>
   {result!==''&&<Text accessibilityRole="alert" style={[styles.text,{color:palette.primary}]}>{result}</Text>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Más servicios</Text>
   <Action secondary label="Envíos particulares" onPress={()=>router.push('/envios')}/>
   <Action secondary label="Comercios y pedidos" onPress={()=>router.push('/comercios')}/>
   <Action secondary label="Cotizaciones en Gs" onPress={()=>router.push('/cotizacion')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mis actividades</Text>
   <Action secondary label="Seguimiento" onPress={()=>router.push('/seguimiento')}/>
   <Action secondary label="Historial" onPress={()=>router.push('/historial')}/>
   <Action secondary label="Pagos simulados" onPress={()=>router.push('/pagos')}/>
   <Action secondary label="Seguridad y soporte" onPress={()=>router.push('/soporte')}/>
   <Action secondary label="Mi cuenta" onPress={()=>router.push('/cuenta')}/>
  </Panel>
 </ScrollView>;
}
