import React,{useEffect,useRef,useState} from 'react';
import {Platform,ScrollView,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/DriverUI';
import {OFFLINE_DRIVER_OCR_QA} from '../src/native/driver-offline-ocr-qa';
import {runNativeDriverDocumentScannerQa}
 from '../src/native/driver-native-mlkit-scanner';

/**
 * G310 replaces periodic CameraView shutter sampling. The ML Kit native
 * viewfinder does automatic edge detection and capture (when enabled by GMS).
 * Only after the user saves the page is its real image inspected for blur.
 * Nothing is uploaded, persisted or approved.
 */
const authorized=OFFLINE_DRIVER_OCR_QA||(
 process.env.EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED==='true'&&
 process.env.EXPO_PUBLIC_QORE_G290_CAMERA_LAB_APPROVED==='true'&&
 process.env.EXPO_PUBLIC_LIVE_OPERATIONS_ENABLED!=='true');
const meanings:Record<string,string>={
 INVALID_SCAN:'No se recibió un único documento válido.',
 OUT_OF_FOCUS:'La imagen sigue borrosa. Acercá o alejá la cámara y dejá enfocar.',
 TOO_DARK:'No hay suficiente luz.',
 TOO_BRIGHT:'Demasiada luz sobre el documento.',
 GLARE:'Hay reflejos que impiden una lectura clara.',
 SHADOW:'El documento tiene sombras oscuras.',
 LOW_CONTRAST:'Usá un fondo que contraste con el documento.',
 SUBJECT_NOT_VERIFIED_IN_FRAME:'El documento no quedó bien encuadrado.',
 NATIVE_SCANNER_UNAVAILABLE:'El escáner nativo no está disponible. Verificá Google Play Services.',
 ANDROID_ONLY:'Esta prueba requiere Android.'
};
export default function DriverSmartCameraLab(){
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState(
  'Escáner Android ML Kit: no toma fotos periódicas desde Movete Fácil.');
 const [passed,setPassed]=useState(false);
 const mounted=useRef(true);
 const lock=useRef(false);
 useEffect(()=>{
  mounted.current=true;
  return ()=>{mounted.current=false;};
 },[]);
 async function scan(){
  if(lock.current||!authorized||Platform.OS!=='android')return;
  lock.current=true;setBusy(true);setPassed(false);
  setNotice('Abrí el escáner y mantené el documento quieto hasta que enfoque. Usá solo papeles ficticios.');
  try{
   const report=await runNativeDriverDocumentScannerQa();
   if(!mounted.current)return;
   if(report.status==='accepted'){
    setPassed(true);
    setNotice('La imagen escaneada superó el análisis local de nitidez. No se conservó ni envió ningún documento; aún falta certificar el enfoque en tu Android.');
   }else if(report.status==='cancelled'){
    setNotice('Captura cancelada. No hay foto aceptada.');
   }else{
    const reasons=report.reasons.map(x=>meanings[x]??'Calidad no verificada.');
    setNotice('Captura RECHAZADA. '+reasons.join(' ')+' No se guardó ninguna imagen.');
   }
  }catch{
   if(mounted.current)setNotice('No se pudo iniciar el escáner. Ninguna captura fue aceptada.');
  }finally{
   lock.current=false;if(mounted.current)setBusy(false);
  }
 }
 if(!authorized||Platform.OS!=='android')return <ScrollView style={styles.page}
  contentContainerStyle={styles.content}>
  <Panel><Text style={styles.heading}>Escáner nativo deshabilitado</Text>
   <Text style={styles.text}>Solo disponible en Android QA autorizado, sin documentos reales ni viajes comerciales.</Text>
   <Action secondary label="Volver" onPress={()=>router.back()}/>
  </Panel>
 </ScrollView>;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Cámara inteligente ML Kit</Text>
   <Text style={styles.heroSub}>Escaneo nativo del documento con detección automática de bordes. No hay disparos repetidos del obturador de la app.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Prueba de enfoque — solo papeles ficticios</Text>
   <Text style={styles.text}>La captura automática la gestiona el escáner de Google Play Services. Después de guardar, Movete Fácil vuelve a revisar la nitidez del interior y rechaza resultados borrosos.</Text>
   <Text style={styles.small}>Es necesario disponer de Google Play Services y sus modelos. La primera apertura puede descargar componentes. No fotografíes cédula real, habilitación, licencia ni rostros.</Text>
   <Action label={busy?'Escáner en uso…':'Abrir escáner inteligente ML Kit'}
    disabled={busy} onPress={()=>{void scan();}}/>
   <View accessibilityRole="alert" style={{padding:12,borderRadius:12,
    backgroundColor:passed?'#E2F2EF':'#FFF0D4'}}>
    <Text style={[styles.text,{color:passed?palette.teal:palette.amber}]}>
     {notice}
    </Text>
   </View>
   <Text style={styles.small}>Este laboratorio no aprueba documentos ni habilita al conductor. La aceptación definitiva depende de la prueba física y de una posterior revisión administrativa.</Text>
   <Action secondary label="Volver a documentación" onPress={()=>router.back()}/>
  </Panel>
 </ScrollView>;
}
