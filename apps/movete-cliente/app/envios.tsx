import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {DELIVERY_CATEGORIES,validateDeliveryForm} from '../src/domain/delivery-form.mjs';
type Kind='AUTO'|'MOTO';
export default function ClientDeliveries(){
 const [pickup,setPickup]=useState('');
 const [destination,setDestination]=useState('');
 const [weight,setWeight]=useState('');
 const [length,setLength]=useState('');
 const [width,setWidth]=useState('');
 const [height,setHeight]=useState('');
 const [category,setCategory]=useState('PARCEL');
 const [restricted,setRestricted]=useState(false);
 const [vehicleKind,setVehicleKind]=useState<Kind>('MOTO');
 const [result,setResult]=useState('');
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Preparar un envío</Text>
   <Text style={styles.heroSub}>Documentos, paquetes y compras habilitadas en auto o moto de carga. No reserva repartidores.</Text></View>
  <Panel>
   <Text style={styles.heading}>Origen y entrega</Text>
   <TextInput style={styles.field} value={pickup} onChangeText={setPickup}
    placeholder="Dirección de recogida" accessibilityLabel="Origen del envío" maxLength={120}/>
   <TextInput style={styles.field} value={destination} onChangeText={setDestination}
    placeholder="Dirección de entrega" accessibilityLabel="Destino del envío" maxLength={120}/>
   <Text style={styles.heading}>Categoría</Text>
   {DELIVERY_CATEGORIES.map(item=><Action key={item.code} label={item.label}
     secondary={category!==item.code} onPress={()=>setCategory(item.code)}/>)}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Vehículo de carga</Text>
   <View style={[styles.row,{justifyContent:'flex-start'}]}>
    <View style={{flex:1}}><Action label="Moto envíos" secondary={vehicleKind!=='MOTO'} onPress={()=>setVehicleKind('MOTO')}/></View>
    <View style={{flex:1}}><Action label="Auto envíos" secondary={vehicleKind!=='AUTO'} onPress={()=>setVehicleKind('AUTO')}/></View>
   </View>
   <Text style={styles.small}>Moto pasajeros NO autorizada. Moto para carga exige elegibilidad, permisos y límites que debe confirmar el backend.</Text>
   <Text style={styles.heading}>Peso y dimensiones</Text>
   <TextInput style={styles.field} value={weight} onChangeText={setWeight}
    placeholder="Peso en gramos" accessibilityLabel="Peso en gramos" keyboardType="numeric" maxLength={6}/>
   <TextInput style={styles.field} value={length} onChangeText={setLength}
    placeholder="Largo en cm" accessibilityLabel="Largo en centímetros" keyboardType="numeric" maxLength={3}/>
   <TextInput style={styles.field} value={width} onChangeText={setWidth}
    placeholder="Ancho en cm" accessibilityLabel="Ancho en centímetros" keyboardType="numeric" maxLength={3}/>
   <TextInput style={styles.field} value={height} onChangeText={setHeight}
    placeholder="Alto en cm" accessibilityLabel="Alto en centímetros" keyboardType="numeric" maxLength={3}/>
   <Action label={restricted?'Artículos restringidos: SÍ':'Artículos restringidos: NO'} secondary={!restricted} onPress={()=>setRestricted(!restricted)}/>
   <Text style={styles.small}>No aceptamos artículos restringidos. La declaración NO no implica aprobación de productos ni de la ruta.</Text>
   <Action label="Validar envío DEMO" onPress={()=>{
    const checked=validateDeliveryForm({pickup,destination,vehicleKind,
      grams:Number(weight),lengthCm:Number(length),widthCm:Number(width),heightCm:Number(height),
      category,restrictedItemDeclared:restricted});
    setResult(checked.ok?'Borrador local válido. No hay cotización ni pedido al servidor; capacidad y legalidad requieren verificación.':checked.reason);
   }}/>
   {result!==''&&<Text accessibilityRole="alert" style={[styles.text,{color:palette.primary}]}>{result}</Text>}
  </Panel>
 </ScrollView>;
}
