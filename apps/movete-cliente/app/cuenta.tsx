import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView,useClientSimpleMode,useNativePassengerAuth} from '../src/ClientRuntime';
import {createF1StagingConnectivityProbe} from '../src/domain/f1-staging-connectivity.mjs';
export default function Account(){
 const {client,view}=useClientView();
 const {simpleMode,setSimpleMode}=useClientSimpleMode();
 const auth=useNativePassengerAuth();
 const connectivity=React.useMemo(()=>createF1StagingConnectivityProbe({
  origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
  pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN
 }),[]);
 const [checkingBackend,setCheckingBackend]=useState(false);
 const [backendMessage,setBackendMessage]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function checkBackend(){
  if(checkingBackend||!connectivity.isConfigured())return;
  setCheckingBackend(true);setBackendMessage('');
  try{
   const result=await connectivity.check();
   setBackendMessage(result.ok
    ?'El servidor STAGING responde por HTTPS. Esto NO certifica todavía la base de datos, rutas, tarifas, conductores ni reservas.'
    :'No se pudo comprobar el servidor STAGING configurado. No se habilitarán solicitudes ni cobros.');
  }catch{
   setBackendMessage('El servidor de pruebas no está disponible; no se habilitarán viajes.');
  }finally{setCheckingBackend(false);}
 }
 async function logIn(){
  if(!auth||busy)return;
  const secret=password;
  setPassword('');setBusy(true);setMessage('');
  try{
   const result=await auth.signIn(email.trim(),secret);
   if(!result.ok){
    setMessage(result.code==='PASSENGER_ROLE_NOT_VERIFIED'
     ?'La cuenta no está habilitada como pasajero; no se permitirá solicitar viajes.'
     :'No se pudo verificar el acceso. Revisá tus credenciales y la conexión segura.');
    return;
   }
   const refreshed=await client.refreshSession();
   setMessage(refreshed.ok
    ?'Sesión de pasajero verificada con el servidor. Los viajes todavía requieren el backend compartido habilitado.'
    :'La sesión no pudo certificarse; las solicitudes siguen bloqueadas.');
  }catch{setMessage('Autenticación temporalmente no disponible.');}
  finally{setBusy(false);}
 }
 async function logOut(){
  if(busy)return;
  setBusy(true);setPassword('');setMessage('');
  try{
   const result=await client.signOut();
   setMessage(result.ok?'Sesión cerrada.':'Datos locales borrados; no se confirmó la revocación remota.');
  }finally{setBusy(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Mi cuenta</Text>
   <Text style={styles.heroSub}>Identidad independiente de Movete Fácil Cliente.</Text></View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Accesibilidad · Modo simple</Text>
   <Text style={styles.text}>Botones más grandes y acceso directo a las tareas esenciales.</Text>
   <Action label={simpleMode?'Desactivar modo simple':'Activar modo simple'}
    secondary={!simpleMode} selected={simpleMode} onPress={()=>setSimpleMode(!simpleMode)}/>
  </Panel>
  {view.authenticated&&view.account?
   <Panel>
    <Text accessibilityRole="header" style={styles.heading}>Pasajero verificado</Text>
    <Text style={styles.small}>ID de cuenta: {view.account.subject}</Text>
    <Text style={styles.small}>Sesión autenticada y rol pasajero confirmado por Auth/RLS.
     Driver y Admin no comparten esta sesión.</Text>
    <Action label="Cerrar sesión y borrar datos temporales" disabled={busy}
     onPress={()=>{void logOut();}}/>
   </Panel>:
   <Panel>
    <Text accessibilityRole="header" style={styles.heading}>Ingresar como pasajero</Text>
    {auth?<React.Fragment>
     <Text style={styles.small}>Ingreso contra Supabase Auth mediante conexión TLS.
      La contraseña no se guarda en esta pantalla.</Text>
     <TextInput style={styles.field} value={email} onChangeText={setEmail}
      placeholder="Correo electrónico" autoCapitalize="none"
      autoComplete="email" keyboardType="email-address" textContentType="username"
      accessibilityLabel="Correo de la cuenta pasajero" editable={!busy}/>
     <TextInput style={styles.field} value={password} onChangeText={setPassword}
      placeholder="Contraseña" autoCapitalize="none" secureTextEntry
      autoComplete="current-password" textContentType="password"
      accessibilityLabel="Contraseña" editable={!busy}/>
     <Action label={busy?'Verificando…':'Ingresar de forma segura'}
      disabled={busy||!email.trim()||!password} onPress={()=>{void logIn();}}/>
    </React.Fragment>:<Text style={styles.text}>
     Todavía falta configurar el entorno privado de pruebas y la clave pública
     autorizada del servicio de autenticación. No se conectará a un backend
     desconocido ni se guardarán claves de administración.
    </Text>}
   </Panel>}
  {message!==''&&<Panel><Text accessibilityRole="alert"
   accessibilityLiveRegion="polite" style={styles.text}>{message}</Text></Panel>}
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Conexión con Movete Fácil</Text>
   {connectivity.isConfigured()?<>
    <Text style={styles.small}>Comprobación HTTPS del servidor STAGING autorizado.
     No envía identidad, contraseña ni ubicación.</Text>
    <Action label={checkingBackend?'Comprobando…':'Comprobar conexión del servidor'}
     disabled={checkingBackend} onPress={()=>{void checkBackend();}}/>
   </>:<Text style={styles.small}>No hay servidor STAGING autorizado y fijado
    para esta instalación. Las solicitudes siguen deshabilitadas.</Text>}
   {backendMessage!==''&&<Text accessibilityRole="alert"
    accessibilityLiveRegion="polite" style={styles.small}>{backendMessage}</Text>}
  </Panel>
  <Panel>
   <Text style={styles.small}>La autenticación no activa por sí sola viajes, GPS,
    cobros ni despachos. Esas funciones requieren un backend HTTPS y una base
    persistente certificados para esta instalación.</Text>
  </Panel>
 </ScrollView>;
}
