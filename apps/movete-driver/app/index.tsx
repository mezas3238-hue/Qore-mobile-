import React,{useEffect,useRef,useState} from 'react';
import {ScrollView,Switch,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/DriverUI';
import {useDriverKycExpiry} from '../src/DriverKycExpiryProvider';
import {useDriverCurrentTrip} from '../src/DriverCurrentTripProvider';
import {useDriverWorkspace} from '../src/DriverWorkspaceProvider';
import {useNativeDriverAuth} from '../src/DriverApplicationProviders';
import {verifyResumableDriverAutoTrip} from '../src/domain/driver-accepted-ride-resume.mjs';
export default function DriverHome(){
 const [demoAvailable,setDemoAvailable]=useState(false);
 const auth=useNativeDriverAuth();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [authBusy,setAuthBusy]=useState(false);
 const [authenticated,setAuthenticated]=useState(false);
 const [authMessage,setAuthMessage]=useState('');
 const [resuming,setResuming]=useState(false);
 const [resumeNotice,setResumeNotice]=useState('');
 const resumeLock=useRef(false);
 useEffect(()=>{
  let active=true;
  const verify=async()=>{
   if(!auth)return;
   try{
    const session=await auth.getSession();
    if(active)setAuthenticated(session?.role==='driver');
   }catch{if(active)setAuthenticated(false);}
  };
  void verify();
  const unsubscribe=auth?.subscribe?.(()=>{void verify();});
  return ()=>{active=false;unsubscribe?.();};
 },[auth]);
 async function signIn(){
  if(!auth||authBusy)return;
  const secret=password;setPassword('');setAuthBusy(true);setAuthMessage('');
  try{
   const result=await auth.signIn(email,secret);
   if(!result.ok){
    setAuthenticated(false);
    setAuthMessage(result.code==='DRIVER_ROLE_NOT_VERIFIED'
     ?'Esta cuenta no tiene rol exclusivo de conductor verificado.'
     :'No fue posible verificar credenciales, identidad y rol.');
    return;
   }
   setAuthenticated((await auth.getSession())?.role==='driver');
   setAuthMessage('Identidad Driver verificada. Sin backend autorizado, las ofertas siguen bloqueadas.');
  }catch{setAuthenticated(false);setAuthMessage('Sin conexión segura confirmada.');}
  finally{setAuthBusy(false);}
 }
 async function signOut(){
  if(!auth||authBusy)return;
  setAuthBusy(true);setPassword('');setAuthenticated(false);
  try{await auth.signOut();setAuthMessage('Sesión Driver cerrada.');}
  catch{setAuthMessage('Acceso oculto; no se confirmó revocación remota.');}
  finally{setAuthBusy(false);}
 }
 const {state,refresh}=useDriverWorkspace();
 const kyc=useDriverKycExpiry();
 const currentTrip=useDriverCurrentTrip();
 const phase:Record<string,string>={
  'not-configured':'STAGING sin conectar — no hay sesión de conductor',
  'signed-out':'Sesión de conductor cerrada',
  'authorization-required':'Cuenta sin autorización Driver verificada',
  'loading':'Comprobando identidad y estado en el servidor',
  'offline':'Sin conexión confirmada — datos privados ocultos',
  'connected':'Sesión Driver de STAGING validada para consulta'
 };
 async function continueVerifiedTrip(){
  const old=currentTrip.state.trip;
  if(resumeLock.current||!currentTrip.enabled||!old||
   currentTrip.state.phase!=='active'||state.phase!=='connected'||
   kyc.snapshot?.state!=='READY_QA')return;
  resumeLock.current=true;setResuming(true);setResumeNotice('');
  try{
   const proof=await verifyResumableDriverAutoTrip({
    expectedTripId:old.tripId,minimumRevision:old.revision,
    recoverCurrent:currentTrip.refresh
   });
   if(proof.ok)router.push({pathname:'/viaje',
    params:{tripId:proof.tripId}});
   else setResumeNotice('La asignación cambió o no pudo volver a verificarse. No se abrirá un viaje sin autorización del servidor.');
  }finally{resumeLock.current=false;setResuming(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Movete Fácil Driver</Text>
   <Text style={styles.heroSub}>Aplicación exclusiva para conductores y repartidores. Todos los movimientos de esta versión son locales y de prueba.</Text>
  </View>
  <View style={styles.badge}><Text style={styles.badgeText}>DEMO • SIN VIAJES REALES</Text></View>
  <Panel>
   <Text style={styles.heading}>Acceso seguro de conductor</Text>
   {auth?(authenticated?
    <>
     <Text style={styles.text}>Cuenta Driver autenticada. No significa habilitación de KYC, GPS ni viajes.</Text>
     <Action label="Cerrar sesión Driver" secondary disabled={authBusy}
      onPress={()=>{void signOut();}}/>
    </>:
    <>
     <Text style={styles.small}>Cuenta Driver exclusiva, validada por Auth y roles del servidor.</Text>
     <TextInput style={styles.field} value={email} onChangeText={setEmail}
      autoCapitalize="none" keyboardType="email-address" autoComplete="email"
      accessibilityLabel="Correo conductor" editable={!authBusy} placeholder="Correo"/>
     <TextInput style={styles.field} value={password} onChangeText={setPassword}
      secureTextEntry autoComplete="current-password" autoCapitalize="none"
      accessibilityLabel="Contraseña conductor" editable={!authBusy} placeholder="Contraseña"/>
     <Action label={authBusy?'Verificando…':'Ingresar como Driver'}
      disabled={authBusy||!email||!password} onPress={()=>{void signIn();}}/>
    </>
   ):<Text style={styles.small}>Falta configurar la identidad pública del STAGING autorizado.
    No se almacenan credenciales de servidor en el celular.</Text>}
   {authMessage!==''&&<Text accessibilityRole="alert" style={styles.small}>{authMessage}</Text>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Conexión privada de Driver</Text>
   <Text accessibilityRole="text" style={styles.text}>{phase[state.phase]}</Text>
   <Text style={styles.small}>Los datos de ofertas y documentación se consultan únicamente con una sesión autorizada. Esta compilación no incluye credenciales ni acceso productivo.</Text>
   <Action label="Volver a comprobar sesión STAGING" secondary
    disabled={state.phase==='not-configured'||state.phase==='loading'}
    onPress={()=>{void refresh();}}/>
   <Text style={styles.small}>Licencia revisada: {state.phase==='connected'?
    state.currentLicenseApproved?'aprobada en la revisión':'pendiente, rechazada o no verificada':'sin consultar'}. Ningún resultado habilita viajes reales.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Vigencia documental y avisos</Text>
   <Text accessibilityRole="alert" style={[styles.text,{
    color:kyc.snapshot?.state==='READY_QA'?palette.teal:palette.amber,
    fontWeight:'800'
   }]}>{kyc.notice.text}</Text>
   <Action label="Renovar o comprobar documentos" secondary
    onPress={()=>router.push('/documentos')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Recuperar mi viaje activo</Text>
   <Text style={styles.small}>Después de cerrar o reiniciar la aplicación, el servidor identifica exclusivamente el viaje AUTO que sigue asignado a esta cuenta Driver. No se usan identificadores guardados en el teléfono.</Text>
   {!currentTrip.enabled?<Text style={styles.text}>Función disponible al conectar backend STAGING autorizado y PostgreSQL. No hay viaje comercial habilitado.</Text>:
    currentTrip.state.phase==='active'&&currentTrip.state.trip?
     <>
      <Text style={styles.text}>Viaje asignado confirmado por servidor · etapa {currentTrip.state.trip.status} · revisión {currentTrip.state.trip.revision}</Text>
      <Action label={resuming?'Verificando asignación…':'Continuar mi viaje asignado'}
       disabled={resuming||state.phase!=='connected'||
        kyc.snapshot?.state!=='READY_QA'}
       onPress={()=>{void continueVerifiedTrip();}}/>
     </>:
     <Text style={styles.text}>{
      currentTrip.state.phase==='none'?'El servidor no encontró un viaje AUTO activo para esta cuenta.':
      currentTrip.state.phase==='loading'?'Consultando asignación privada…':
      currentTrip.state.phase==='offline'?'No se pudo verificar la asignación. No mostramos datos antiguos.':
      'Iniciá sesión Driver verificada para recuperar tu viaje.'
     }</Text>}
   {resumeNotice!==''&&<Text accessibilityRole="alert"
    style={styles.text}>{resumeNotice}</Text>}
   <Action label="Consultar mi asignación en el servidor" secondary
    disabled={!currentTrip.enabled||currentTrip.state.phase==='loading'}
    onPress={()=>{void currentTrip.refresh();}}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mi disponibilidad</Text>
   <View style={styles.row}>
    <Text style={[styles.text,{flex:1}]}>{demoAvailable?'Disponible en la simulación':'No disponible en la simulación'}</Text>
    <Switch value={demoAvailable&&kyc.snapshot?.accountBlocked===false} onValueChange={setDemoAvailable} disabled={kyc.snapshot?.accountBlocked!==false} trackColor={{true:palette.teal}} accessibilityLabel="Disponibilidad local de demostración"/>
   </View>
   <Text style={styles.small}>Este interruptor no publica tu GPS ni te pone disponible en la red de conductores.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mi cuenta de conductor</Text>
   <Text style={styles.text}>Registrá tus datos y revisá los requisitos antes de solicitar una aprobación administrativa.</Text>
   <Action label="Documentación y vehículo" onPress={()=>router.push('/documentos')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Viajes y envíos</Text>
   <Text style={styles.text}>Aquí aparecerán solamente ofertas dirigidas a tu identidad verificada por el backend.</Text>
   <Action label="Consultar mis ofertas" secondary onPress={()=>router.push('/ofertas')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mensajes con clientes</Text>
   <Text style={styles.text}>La mensajería privada requiere asignación vigente y backend autenticado; permanece bloqueada.</Text>
   <Action label="Ver estado de mensajería" secondary onPress={()=>router.push('/mensajes')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mis ingresos</Text>
   <Action label="Ver ganancias y liquidaciones" secondary onPress={()=>router.push('/ganancias')}/>
  </Panel>
 </ScrollView>;
}
