import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,palette,styles} from '../src/DriverUI';
import {validateDriverDraft} from '../src/domain/capabilities.mjs';
export default function DriverDocuments(){
 const [fullName,setFullName]=useState('');
 const [plate,setPlate]=useState('');
 const [kind,setKind]=useState<'AUTO'|'MOTO'>('AUTO');
 const [result,setResult]=useState('');
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Documentación del conductor</Text>
   <Text style={styles.heroSub}>La verificación deberá completarse en almacenamiento privado y revisión administrativa; nunca se aprueba desde el teléfono.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Borrador local</Text>
   <Text style={styles.text}>Nombre completo</Text>
   <TextInput style={styles.field} value={fullName} onChangeText={setFullName}
    placeholder="Nombre y apellido" accessibilityLabel="Nombre del conductor" maxLength={90}/>
   <Text style={styles.text}>Chapa del vehículo</Text>
   <TextInput style={styles.field} value={plate} onChangeText={setPlate}
    autoCapitalize="characters" placeholder="ABC123" accessibilityLabel="Chapa" maxLength={12}/>
   <Text style={styles.text}>Clase de vehículo</Text>
   <View style={[styles.row,{justifyContent:'flex-start'}]}>
    <View style={{flex:1}}><Action label="Automóvil" secondary={kind!=='AUTO'} onPress={()=>setKind('AUTO')}/></View>
    <View style={{flex:1}}><Action label="Motocicleta" secondary={kind!=='MOTO'} onPress={()=>setKind('MOTO')}/></View>
   </View>
   <Action label="Validar borrador en el dispositivo" onPress={()=>{
    const checked=validateDriverDraft({fullName,plate,vehicleKind:kind});
    setResult(checked.ok?'Borrador válido. No se enviaron documentos ni se aprobó el vehículo.':checked.reason);
   }}/>
   {result!==''&&<Text accessibilityRole="alert" style={[styles.text,{color:palette.teal}]}>{result}</Text>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Revisión administrativa</Text>
   <Text style={styles.text}>Pendiente de conexión a la identidad verificada, al almacenamiento privado de licencias y al panel de aprobación.</Text>
   <Text style={styles.small}>La autorización de motos para paquetes no habilita automáticamente viajes con pasajeros.</Text>
  </Panel>
 </ScrollView>;
}
