import React,{useEffect,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,styles} from '../src/DriverUI';
import {readDriverSosPreference,requestTrustedContactCallPermission,
 saveDriverSosPreference} from '../src/DriverSosPhone';
import {normalizeTrustedNumber} from '../src/domain/g298-driver-sos-dial.mjs';
type Destination='EMERGENCY_911'|'TRUSTED_CONTACT';
export default function DriverSosConfiguration(){
 const [destination,setDestination]=useState<Destination>('EMERGENCY_911');
 const [trustedNumber,setTrustedNumber]=useState('');
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;void readDriverSosPreference().then(p=>{
  if(!live)return;
  setDestination(p.destination);setTrustedNumber(p.trustedNumber);
 });return()=>{live=false;};},[]);
 const save=async()=>{
  if(busy)return;
  setBusy(true);setStatus('');
  try{
   const number=destination==='TRUSTED_CONTACT'?normalizeTrustedNumber(trustedNumber):'';
   if(destination==='TRUSTED_CONTACT'&&!number){
    setStatus('Ingresá un número telefónico válido, sin códigos adicionales.');
    return;
   }
   const saved=await saveDriverSosPreference({destination,trustedNumber:number??''});
   if(!saved){
    setStatus('No se pudo guardar: iniciá sesión Driver verificada y reintentá.');
    return;
   }
   if(destination==='TRUSTED_CONTACT'){
    const permission=await requestTrustedContactCallPermission();
    setStatus(permission
     ?'Contacto guardado. Al tocar 🆘, Android podrá iniciar su llamada directa.'
     :'Contacto guardado. Sin permiso de llamadas directas, se abrirá el marcador del teléfono.');
   }else{
    setStatus('911 configurado. Android abrirá el marcador de emergencias para confirmar la llamada.');
   }
  }catch{setStatus('No se pudo guardar la preferencia en el almacenamiento seguro.');}
  finally{setBusy(false);}
 };
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>🆘 Configurar SOS</Text>
   <Text style={styles.heroSub}>Elegí una sola opción antes de salir a trabajar. El ícono aparecerá en la esquina superior derecha de tus pantallas de viaje.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Destino al pulsar el ícono</Text>
   <Action secondary={destination!=='EMERGENCY_911'}
    label={destination==='EMERGENCY_911'?'✓ Llamar al 911':'Llamar al 911'}
    onPress={()=>setDestination('EMERGENCY_911')}/>
   <Action secondary={destination!=='TRUSTED_CONTACT'}
    label={destination==='TRUSTED_CONTACT'?'✓ Contacto de confianza':'Contacto de confianza'}
    onPress={()=>setDestination('TRUSTED_CONTACT')}/>
   {destination==='TRUSTED_CONTACT'&&<>
    <Text style={styles.small}>Teléfono de tu contacto (Paraguay o formato internacional)</Text>
    <TextInput value={trustedNumber} onChangeText={setTrustedNumber}
     style={styles.field} keyboardType="phone-pad"
     placeholder="0981 123 456"
     accessibilityLabel="Número del contacto de confianza"
     autoComplete="tel" editable={!busy}/>
   </>}
   <Action disabled={busy}
    label={busy?'Guardando…':'Guardar mi opción de SOS'}
    onPress={()=>{void save();}}/>
   {status!==''&&<Text accessibilityRole="alert" style={styles.small}>{status}</Text>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Cómo se realiza la llamada</Text>
   <Text style={styles.text}>Contacto: llamada telefónica directa solo si Android otorgó el permiso. 911: Android exige abrir el marcador y confirmar la llamada.</Text>
   <Text style={styles.small}>El sistema de llamadas puede cubrir el mapa temporalmente. El viaje no se cancela. La preferencia se guarda cifrada en este dispositivo y asociada a la cuenta Driver verificada.</Text>
   <Text style={styles.small}>Sin confirmación telefónica no podemos afirmar que la llamada llegó a su destinatario. No hagas pruebas reales al 911.</Text>
  </Panel>
  <Action label="Volver a Driver" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}
