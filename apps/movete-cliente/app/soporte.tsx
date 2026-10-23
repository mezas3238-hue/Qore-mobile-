import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
export default function Support(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Seguridad y soporte</Text>
   <Text style={styles.heroSub}>Privacidad, incidentes y acompañamiento.</Text></View>
  <Panel><Text style={styles.heading}>Canal de incidentes pendiente</Text>
   <Text style={styles.text}>Todavía no hay un canal de atención conectado. Esta pantalla no envía reportes ni activa asistencia de emergencia.</Text>
   <Text style={styles.small}>Si existe un peligro inmediato, usá los servicios locales de emergencia. No dependas de esta versión de prueba.</Text>
  </Panel>
  <Panel><Text style={styles.heading}>Protección de datos</Text>
   <Text style={styles.text}>La identidad del conductor se muestra solo tras asignación persistida y autorizada; su ubicación requiere consentimiento y datos GPS recientes.</Text></Panel>
 </ScrollView>;
}
