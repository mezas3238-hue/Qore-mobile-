import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView,useClientSimpleMode} from '../src/ClientRuntime';
export default function Account(){
 const {client,view}=useClientView();
 const {simpleMode,setSimpleMode}=useClientSimpleMode();
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Mi cuenta</Text>
   <Text style={styles.heroSub}>Acceso independiente de Movete Fácil Cliente.</Text></View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Accesibilidad · Modo simple</Text>
   <Text style={styles.text}>Botones más grandes y acceso directo a las tareas esenciales desde Inicio. Podés cambiarlo cuando quieras.</Text>
   <Action label={simpleMode?'Desactivar modo simple':'Activar modo simple'}
    secondary={!simpleMode} selected={simpleMode}
    onPress={()=>setSimpleMode(!simpleMode)}/>
   <Text style={styles.small}>Preferencia temporal en esta aplicación. No se guarda en el servidor ni modifica tarifas, permisos o funciones de seguridad.</Text>
  </Panel>
  {view.authenticated&&view.account?
   <Panel>
    <Text accessibilityRole="header" style={styles.heading}>Sesión pasajero</Text>
    <Text style={styles.text}>Cuenta: {view.account.subject}</Text>
    <Text style={styles.small}>No se expone el JWT. Driver y Admin no usan esta sesión.</Text>
    <Action label="Cerrar sesión y borrar datos temporales" onPress={()=>{void client.signOut();}}/>
   </Panel>:
   <Panel><Text accessibilityRole="header" style={styles.heading}>Acceso todavía no conectado</Text>
    <Text style={styles.text}>El ingreso requiere la autenticación segura y los permisos de pasajero del backend. No se almacenan claves de administración ni documentos de conductores.</Text>
    <Text style={styles.small}>No hay una sesión Passenger autenticada en esta instalación.</Text>
   </Panel>}
 </ScrollView>;
}
