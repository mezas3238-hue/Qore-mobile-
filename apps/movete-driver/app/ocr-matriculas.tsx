import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Platform,ScrollView,Text,View} from 'react-native';
import {CameraView,useCameraPermissions} from 'expo-camera';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/DriverUI';
import {useVerifiedDriverRuntimeAuth} from '../src/DriverApplicationProviders';
import {recognizeDriverPlatePhoto} from '../src/native/driver-plate-recognizer';
import {discardDriverCameraCache} from '../src/native/driver-camera-qa-frame';
import {extractDriverPlateCandidates,addDriverPlateOcrSample,
 compareDriverUnverifiedOcrSamples}
 from '../src/domain/driver-plate-ocr-lab.mjs';
import type {DriverOcrSamples,DriverPlateOcrSource}
 from '../src/domain/driver-plate-ocr-lab.mjs';
import {OFFLINE_DRIVER_OCR_QA} from '../src/native/driver-offline-ocr-qa';

const enabled=OFFLINE_DRIVER_OCR_QA||(
 process.env.EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED==='true'&&
 process.env.EXPO_PUBLIC_QORE_G290_CAMERA_LAB_APPROVED==='true'&&
 process.env.EXPO_PUBLIC_QORE_G291_OCR_LAB_APPROVED==='true'&&
 process.env.EXPO_PUBLIC_LIVE_OPERATIONS_ENABLED!=='true');
const SOURCES:ReadonlyArray<{key:DriverPlateOcrSource;label:string}>=[
 {key:'registration',label:'Cédula verde (prueba)'},
 {key:'vehicle',label:'Chapa fotografiada (prueba)'},
 {key:'permit',label:'Habilitación (opcional)'}
];
const STATUS:Record<string,string>={
 unverified:'Aún faltan lecturas coherentes. No existe verificación documental.',
 text_equal_pending_review:'Los textos leídos coinciden, pero NO verifican que sean documentos o vehículos auténticos. Revisión obligatoria.',
 text_conflict_pending_review:'Diferencias entre las chapas leídas. Revisión obligatoria; no aprobar.'
};
export default function DriverPlateOcrLab(){
 const [permission,ask]=useCameraPermissions();
 const camera=useRef<CameraView|null>(null);
 const auth=useVerifiedDriverRuntimeAuth();
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const generation=useRef(0);
 const [source,setSource]=useState<DriverPlateOcrSource>('registration');
 const [samples,setSamples]=useState<DriverOcrSamples>({});
 const [notice,setNotice]=useState('Solo laboratorio local: utilizá chapas inventadas sobre una hoja de papel.');
 const reset=useCallback(()=>{
  generation.current+=1;
  setSamples({});setSource('registration');setNotice('Muestras descartadas. Ningún archivo fue enviado.');
 },[]);
 useEffect(()=>{
  const sub=AppState.addEventListener('change',state=>{
   if(state!=='active')reset();
  });
  return ()=>sub.remove();
 },[reset]);
 useEffect(()=>{
  const unsubscribe=auth?.subscribe?.(()=>reset());
  return ()=>unsubscribe?.();
 },[auth,reset]);
 const comparison=compareDriverUnverifiedOcrSamples(samples);
 const scan=async()=>{
  if(!enabled||Platform.OS==='web'||!camera.current||!ready||
   permission?.granted!==true||lock.current||
   (samples[source]?.length??0)>=2)return;
  lock.current=true;setBusy(true);
  const epoch=generation.current;
  let uri:string|undefined;
  try{
   const shot=await camera.current.takePictureAsync({
    quality:.92,base64:false,exif:false,skipProcessing:false
   });
   if(!shot?.uri)throw Error('CAMERA_IMAGE_MISSING');
   uri=shot.uri;
   const raw=await recognizeDriverPlatePhoto(uri);
   if(epoch!==generation.current)return; // Discard late OCR after logout/background.
   const candidates=extractDriverPlateCandidates(raw);
   const next=addDriverPlateOcrSample(samples,source,candidates);
   setSamples(next.samples);
   if(next.accepted){
    setNotice('Texto detectado localmente. Captura '+
     (next.samples[source]?.length??0)+'/2. No es una verificación legal.');
   }else{
    setNotice(next.reason==='INCONSISTENT_RECAPTURE'
     ?'Lecturas inconsistentes: las muestras de este documento se reiniciaron.'
     :'No hay una única matrícula claramente legible. Cambiá encuadre e intentá otra vez.');
   }
  }catch{
   if(epoch!==generation.current)return;
   setNotice('OCR nativo no disponible o captura fallida. Requiere una APK de desarrollo con ML Kit. No se envió ninguna imagen.');
  }finally{
   discardDriverCameraCache(uri);
   lock.current=false;setBusy(false);
  }
 };
 if(!enabled||Platform.OS==='web')return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Panel>
   <Text style={styles.heading}>OCR de matrículas — laboratorio OFF</Text>
   <Text style={styles.text}>Solo funciona en Android/iOS nativo STAGING autorizado o en la APK independiente G299 sin datos reales ni conexión a servidores. No funciona en Expo Go ni navegador.</Text>
   <Action label="Volver" secondary onPress={()=>router.back()}/>
  </Panel>
 </ScrollView>;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>OCR de matrículas</Text>
   <Text style={styles.heroSub}>Prueba local sin transmisión. Usá únicamente matrículas ficticias impresas, nunca documentos de identidad o vehículos auténticos en esta versión.</Text>
  </View>
  <Panel>
   {!permission?.granted?
    <>
     <Text style={styles.text}>El reconocimiento requiere acceso a cámara, sin grabación de audio.</Text>
     <Action label="Autorizar cámara" onPress={()=>{void ask();}}/>
    </>:
    <>
     <Text style={styles.heading}>Origen de la lectura</Text>
     {SOURCES.map(item=><Action key={item.key} label={
      item.label+' ('+(samples[item.key]?.length??0)+'/2)'
     } secondary={source!==item.key} disabled={busy}
      onPress={()=>setSource(item.key)}/>)}
     <View style={{height:310,overflow:'hidden',borderRadius:12,backgroundColor:'#152F38'}}>
      <CameraView ref={camera} style={{flex:1}} facing="back"
       onCameraReady={()=>setReady(true)}
       onMountError={()=>{setReady(false);setNotice('No se pudo abrir la cámara.');}}/>
     </View>
     <Text style={styles.small}>Hacé dos fotografías independientes por origen. El texto reconocido se compara solo dentro de este dispositivo y se descarta al salir o cambiar de cuenta.</Text>
     <Action label={busy?'Reconociendo…':'Leer matrícula con OCR nativo'}
      disabled={!ready||busy||(samples[source]?.length??0)>=2}
      onPress={()=>{void scan();}}/>
     <Text style={[styles.text,{color:palette.amber}]} accessibilityRole="alert">{notice}</Text>
     <Text style={styles.heading}>Resultado no vinculante</Text>
     <Text style={styles.text}>{STATUS[comparison.status]}</Text>
     <Text style={styles.small}>Confianza OCR no certificada; ningún resultado habilita Driver, matrículas, vehículos, despachos ni pagos.</Text>
     <Action label="Descartar todas las muestras" secondary disabled={busy}
      onPress={reset}/>
    </>
   }
   <Action label="Volver a mis documentos" secondary onPress={()=>{reset();router.back();}}/>
  </Panel>
 </ScrollView>;
}
