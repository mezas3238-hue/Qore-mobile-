import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Platform,ScrollView,Text,View} from 'react-native';
import {CameraView,useCameraPermissions} from 'expo-camera';
import {Accelerometer} from 'expo-sensors';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/DriverUI';
import {inspectNativeDriverDocumentPhoto,discardDriverCameraCache}
 from '../src/native/driver-camera-qa-frame';
import {nextDriverAutoCaptureGate}
 from '../src/domain/driver-evidence-intelligence.mjs';
import {OFFLINE_DRIVER_OCR_QA} from '../src/native/driver-offline-ocr-qa';

const authorized=OFFLINE_DRIVER_OCR_QA||(
 process.env.EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED==='true'&&
 process.env.EXPO_PUBLIC_QORE_G290_CAMERA_LAB_APPROVED==='true'&&
 process.env.EXPO_PUBLIC_LIVE_OPERATIONS_ENABLED!=='true');
const messages:Record<string,string>={
 TOO_DARK:'Agregá luz.',TOO_BRIGHT:'Reducí la luz directa.',
 GLARE:'Evitá reflejos.',SHADOW:'Evitá sombras sobre el documento.',
 LOW_CONTRAST:'Usá un fondo con buen contraste.',
 OUT_OF_FOCUS:'Sostené el teléfono y permití que enfoque.',
 CAMERA_MOVING:'Mantené el teléfono quieto.',
 SUBJECT_NOT_VERIFIED_IN_FRAME:'Colocá el documento completo dentro del marco.',
 INVALID_FRAME:'La cámara no entregó una muestra válida.'
};
export default function DriverSmartCameraLab(){
 const [permission,requestPermission]=useCameraPermissions();
 const camera=useRef<CameraView|null>(null);
 const [ready,setReady]=useState(false);
 const [auto,setAuto]=useState(false);
 const [done,setDone]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('Captura local de prueba. No se guardan ni envían fotografías.');
 const [passes,setPasses]=useState(0);
 const lastAcc=useRef<{x:number;y:number;z:number}|null>(null);
 const motion=useRef(1);
 const lastShot=useRef(0);
 const cameraReadyAt=useRef(0);
 const count=useRef(0);
 const lock=useRef(false);
 const stop=()=>{
  setAuto(false);count.current=0;setPasses(0);
 };
 useEffect(()=>{
  if(!authorized||!ready||permission?.granted!==true)return;
  Accelerometer.setUpdateInterval(200);
  const subscription=Accelerometer.addListener(p=>{
   const last=lastAcc.current;
   if(last){
    const delta=Math.hypot(p.x-last.x,p.y-last.y,p.z-last.z);
    // Retain a short window of real motion samples, never fake stillness.
    motion.current=0.5*motion.current+0.5*delta;
   }
   lastAcc.current=p;
  });
  return ()=>{subscription.remove();lastAcc.current=null;motion.current=1;};
 },[ready,permission?.granted]);
 useEffect(()=>{
  const subscription=AppState.addEventListener('change',state=>{
   if(state!=='active')stop();
  });
  return ()=>subscription.remove();
 },[]);
 const shoot=useCallback(async(manual:boolean)=>{
  if(lock.current||!authorized||!ready||permission?.granted!==true||
   !camera.current||done)return;
  // CameraView onCameraReady does not signal autofocus lock. Allow the
  // continuous AF system time to settle before inspecting any sample.
  if(Date.now()-cameraReadyAt.current<1800){
   setNotice('Esperando enfoque automático. Mantené el teléfono quieto.');
   return;
  }
  lock.current=true;setBusy(true);
  const since=Date.now()-lastShot.current;
  lastShot.current=Date.now();
  let uri:string|undefined;
  try{
   const shot=await camera.current.takePictureAsync({
    quality:.88,base64:false,exif:false,skipProcessing:false
   });
   if(!shot?.uri)throw Error('CAMERA_NO_IMAGE');
   uri=shot.uri;
   const quality=await inspectNativeDriverDocumentPhoto(uri,motion.current);
   const gate=nextDriverAutoCaptureGate({
    previousCount:count.current,quality,elapsedMs:since,minimumGapMs:450
   });
   count.current=gate.nextCount;
   setPasses(gate.nextCount);
   // Manual shutter is a fallback for framing, not a bypass for focus.
   // Every candidate must pass full-image AND interior sharpness checks.
   if(quality.ready&&(gate.takePhoto||manual)){
    setAuto(false);setDone(true);
    setNotice(gate.takePhoto
     ?'Autocaptura local realizada tras tres muestras válidas. La fotografía se descartó; no se envió ni aprobó ningún documento.'
     :'Captura manual nítida en prueba local. La fotografía se descartó y no fue enviada.');
   }else{
    setNotice(quality.ready?'Enfoque aceptable. Mantené el teléfono estable ('+
     gate.nextCount+'/3).':
     'Foto rechazada, no aceptada: '+quality.reasons.map(x=>messages[x]??x).join(' '));
   }
  }catch{
   count.current=0;setPasses(0);
   setNotice('No se pudo analizar la fotografía. Intentá de nuevo. No se envió ningún archivo.');
   if(!manual)setAuto(false);
  }finally{
   discardDriverCameraCache(uri);
   lock.current=false;setBusy(false);
  }
 },[ready,permission?.granted,done]);
 useEffect(()=>{
  if(!auto||!ready||done||permission?.granted!==true)return;
  const id=setInterval(()=>{void shoot(false);},1200);
  return ()=>clearInterval(id);
 },[auto,ready,done,permission?.granted,shoot]);
 if(!authorized||Platform.OS==='web')return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Panel>
   <Text style={styles.heading}>Cámara inteligente — laboratorio</Text>
   <Text style={styles.text}>La cámara está deshabilitada. Requiere STAGING autorizado o la APK independiente de laboratorio G299, sin cuentas ni servidores. No funciona en Web.</Text>
   <Action secondary label="Volver a mis documentos" onPress={()=>router.back()}/>
  </Panel>
 </ScrollView>;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Cámara inteligente</Text>
   <Text style={styles.heroSub}>Laboratorio local: probá con una tarjeta u hoja de prueba sin datos personales. No uses documentación real mientras la carga privada no esté habilitada.</Text>
  </View>
  <Panel>
   {!permission?.granted?
    <>
     <Text style={styles.text}>La cámara necesita tu permiso. No se solicita micrófono.</Text>
     <Action label="Permitir cámara" onPress={()=>{void requestPermission();}}/>
    </>:
    <>
     {!done&&<View style={{height:340,borderRadius:14,overflow:'hidden',backgroundColor:'#18383E'}}>
      <CameraView ref={camera} style={{flex:1}} facing="back"
       autoFocus="off"
       onCameraReady={()=>{cameraReadyAt.current=Date.now();setReady(true);}}
       onMountError={()=>{stop();setReady(false);setNotice('Cámara no disponible en este dispositivo.');}}/>
      <View pointerEvents="none" style={{position:'absolute',left:'8%',top:'17%',
       width:'84%',height:'66%',borderWidth:3,borderColor:'#FFF',
       borderRadius:12}}/>
     </View>}
     <Text style={styles.text} accessibilityRole="alert">{notice}</Text>
     {!done&&<>
      <Text style={styles.small}>Esperá a que enfoque. La foto se rechaza si el interior está borroso, aunque sus bordes se vean nítidos. Se requieren tres muestras consecutivas nítidas y estables. Ninguna captura se acepta sin comprobar calidad.</Text>
      <Text style={styles.small}>Muestras aceptadas: {passes}/3.</Text>
      <Action label={auto?'Detener análisis automático':'Comenzar autocaptura'}
       disabled={!ready||busy} onPress={()=>auto?stop():(
        count.current=0,setPasses(0),setAuto(true)
       )}/>
      <Action label={busy?'Analizando enfoque…':'Comprobar nitidez y capturar manualmente'}
       secondary disabled={!ready||busy}
       onPress={()=>{stop();void shoot(true);}}/>
     </>}
     {done&&<Action label="Repetir prueba" secondary onPress={()=>{
      count.current=0;setPasses(0);setDone(false);setReady(false);cameraReadyAt.current=0;
      setNotice('Preparando nueva prueba local.');setAuto(false);
     }}/>}
    </>
   }
   <Action label="Volver a documentos" secondary onPress={()=>{stop();router.back();}}/>
  </Panel>
 </ScrollView>;
}
