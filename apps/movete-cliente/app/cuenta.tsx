import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
export default function Account(){
 const {client,view}=useClientView();
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Mi cuenta</Text>
   <Text style={styles.heroSub}>Acceso independiente de Movete Fácil Cliente.</Text></View>
  {view.authenticated&&view.account?
   <Panel>
    <Text style={styles.heading}>Sesión pasajero</Text>
    <Text style={styles.text}>Cuenta: {view.account.subject}</Text>
    <Text style={styles.small}>No se expone el JWT. Driver y Admin no usan esta sesión.</Text>
    <Action label="Cerrar sesión y borrar datos temporales" onPress={()=>{void client.signOut();}}/>
   </Panel>:
   <Panel><Text style={styles.heading}>Acceso todavía no conectado</Text>
    <Text style={styles.text}>El ingreso requiere la autenticación segura y los permisos de pasajero del backend. No se almacenan claves de administración ni documentos de conductores.</Text>
    <Text style={styles.small}>No hay una sesión iniciada en esta compilación de prueba.</Text>
   </Panel>}
 </ScrollView>;
}
