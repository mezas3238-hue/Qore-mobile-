import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {validateDeliveryDraft} from '../src/domain/capabilities.mjs';
export default function ClientDeliveries(){
 const [pickup,setPickup]=useState('');
 const [destination,setDestination]=useState('');
 const [weight,setWeight]=useState('');
 const [vehicleKind,setVehicleKind]=useState<'AUTO'|'MOTO'>('MOTO');
 const [result,setResult]=useState('');
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Solicitar un envío</Text>
   <Text style={styles.heroSub}>Formulario independiente del transporte de pasajeros. No realiza pedidos comerciales reales.</Text></View>
  <Panel>
   <Text style={styles.heading}>Borrador de entrega</Text>
   <TextInput style={styles.field} value={pickup} onChangeText={setPickup}
    placeholder="Dirección de recogida" accessibilityLabel="Recogida" maxLength={120}/>
   <TextInput style={styles.field} value={destination} onChangeText={setDestination}
    placeholder="Dirección de entrega" accessibilityLabel="Entrega" maxLength={120}/>
   <TextInput style={styles.field} value={weight} onChangeText={setWeight}
    placeholder="Peso en gramos" accessibilityLabel="Peso del paquete" keyboardType="numeric" maxLength={6}/>
   <View style={[styles.row,{justifyContent:'flex-start'}]}>
    <View style={{flex:1}}><Action label="Moto envío" secondary={vehicleKind!=='MOTO'} onPress={()=>setVehicleKind('MOTO')}/></View>
    <View style={{flex:1}}><Action label="Auto envío" secondary={vehicleKind!=='AUTO'} onPress={()=>setVehicleKind('AUTO')}/></View>
   </View>
   <Text style={styles.small}>Los envíos de productos restringidos no están habilitados. Se verificará documentación, capacidad del vehículo y legalidad antes de operar.</Text>
   <Action label="Validar envío DEMO" onPress={()=>{
    const checked=validateDeliveryDraft({pickup,destination,vehicleKind,grams:Number(weight)});
    setResult(checked.ok?'Borrador válido. No se creó un envío en el servidor.':checked.reason);
   }}/>
   {result!==''&&<Text accessibilityRole="alert" style={[styles.text,{color:palette.primary}]}>{result}</Text>}
  </Panel>
 </ScrollView>;
}
