import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
export default function ClientTracking(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Seguimiento</Text>
   <Text style={styles.heroSub}>Estado del servicio, conductor aceptado y llegada, solo cuando lo confirme el servidor.</Text></View>
  <Panel><Text style={styles.heading}>Sin servicio activo</Text>
   <Text style={styles.text}>No se muestra un GPS simulado como si fuera real. La posición y el tiempo estimado aparecerán únicamente con consentimiento, asignación confirmada y ubicación vigente.</Text></Panel>
 </ScrollView>;
}
