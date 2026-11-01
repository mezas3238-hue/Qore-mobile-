import React,{useState} from 'react';
import {Platform,ScrollView,Switch,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/DriverUI';
import {OFFLINE_DRIVER_OCR_QA} from '../src/native/driver-offline-ocr-qa';
import {DRIVER_OFFLINE_QA_CHECKS,buildDriverOfflineQaChecklist}
 from '../src/domain/driver-offline-qa-checklist.mjs';
import type {DriverOfflineQaKey} from '../src/domain/driver-offline-qa-checklist.mjs';

const prompts:Record<DriverOfflineQaKey,{title:string;instruction:string}>={
 permission_prompt:{
  title:'Permiso Android de cámara',
  instruction:'Comprobar que pide cámara, no micrófono, y que cancelar no cierra la aplicación.'
 },
 ocr_consistent:{
  title:'Dos lecturas iguales',
  instruction:'Imprimir la matrícula FICTICIA ABCD123 en dos tarjetas de prueba y leer dos veces cada origen.'
 },
 ocr_conflict:{
  title:'Dos lecturas distintas',
  instruction:'Usar ABCD123 y ABCD124 en tarjetas ficticias y verificar que aparece conflicto, nunca aprobación.'
 },
 autocapture_or_manual:{
  title:'Encuadre y autocaptura',
  instruction:'Probar iluminación y bordes de una hoja de prueba. Si no detecta la tarjeta, usar captura manual.'
 },
 background_discards:{
  title:'Salir y volver',
  instruction:'Poner la app en segundo plano y regresar. Las lecturas deben reiniciarse, incluso si OCR estaba ocupado.'
 },
 local_photos_absent:{
  title:'No guardar en Galería',
  instruction:'Comprobar que las capturas de prueba no aparecen en Fotos/Galería. La caché privada requiere auditoría adicional.'
 }
};
export default function DriverOfflineQaHome(){
 const [values,setValues]=useState<Partial<Record<DriverOfflineQaKey,boolean>>>({});
 const report=buildDriverOfflineQaChecklist(values);
 if(!OFFLINE_DRIVER_OCR_QA||Platform.OS==='web')
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
   <Panel><Text style={styles.heading}>Laboratorio QA no autorizado</Text>
    <Text style={styles.text}>Esta pantalla solo funciona en la APK Android de prueba G301, sin credenciales ni backend.</Text>
    <Action label="Volver" secondary onPress={()=>router.back()}/>
   </Panel>
  </ScrollView>;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Movete Driver OCR QA</Text>
   <Text style={styles.heroSub}>Laboratorio local Android. NO ES LA APP PARA TRABAJAR. Utilizá únicamente tarjetas inventadas; jamás documentos reales ni rostros.</Text>
  </View>
  <View style={styles.badge}><Text style={styles.badgeText}>SIN LOGIN · SIN INTERNET · SIN VIAJES</Text></View>
  <Panel>
   <Text style={styles.heading}>Probar la cámara</Text>
   <Text style={styles.text}>Comprobar permiso de cámara, enfoque y captura de un rectángulo de papel sin información personal.</Text>
   <Action label="Abrir cámara inteligente local" onPress={()=>router.push('/camara-inteligente')}/>
   <Text style={styles.heading}>Probar reconocimiento de chapa</Text>
   <Text style={styles.text}>Se leen dos veces los textos impresos de cédula verde simulada y chapa simulada. Una coincidencia nunca aprueba un vehículo.</Text>
   <Action label="Abrir OCR ML Kit de prueba" onPress={()=>router.push('/ocr-matriculas')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Comprobaciones manuales</Text>
   <Text style={styles.small}>Marcá solo lo observado en tu propio teléfono. La lista no se guarda ni se envía y desaparece al cerrar la aplicación. No equivale a certificación de hardware, KYC o permisos legales.</Text>
   <Text style={[styles.text,{fontWeight:'800',color:palette.teal}]}>
    Observaciones locales: {report.count}/{report.total}
   </Text>
   {DRIVER_OFFLINE_QA_CHECKS.map(key=><View key={key} style={{paddingVertical:8,gap:4}}>
    <View style={[styles.row,{alignItems:'center'}]}>
     <Text style={[styles.text,{flex:1,fontWeight:'700',color:palette.ink}]}>{prompts[key].title}</Text>
     <Switch accessibilityLabel={'Observado: '+prompts[key].title}
      value={values[key]===true}
      onValueChange={checked=>setValues(previous=>({...previous,[key]:checked}))}/>
    </View>
    <Text style={styles.small}>{prompts[key].instruction}</Text>
   </View>)}
   <Action label="Reiniciar mis observaciones" secondary onPress={()=>setValues({})}/>
   <Text style={styles.small}>Aunque marques las seis, Driver y vehículo continúan SIN autorización. Las cinco pruebas externas de negocio se certifican por separado.</Text>
  </Panel>
 </ScrollView>;
}
