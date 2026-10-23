import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
export default function Account(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Mi cuenta</Text>
   <Text style={styles.heroSub}>Perfil y sesión exclusiva de Cliente.</Text></View>
  <Panel><Text style={styles.heading}>Acceso todavía no habilitado</Text>
   <Text style={styles.text}>El registro y la autenticación requieren el contrato seguro de pasajeros del backend. No hay una sesión iniciada ni credenciales almacenadas en esta aplicación.</Text>
   <Text style={styles.small}>Los accesos de Driver y Administrador no funcionan en Movete Fácil Cliente.</Text>
  </Panel>
 </ScrollView>;
}
