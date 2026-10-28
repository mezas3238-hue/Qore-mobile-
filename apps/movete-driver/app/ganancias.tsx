import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/DriverUI';
export default function DriverEarnings(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Mis ganancias</Text>
   <Text style={styles.heroSub}>Solo las liquidaciones persistidas y autorizadas por el backend aparecerán aquí.</Text></View>
  <Panel><Text style={styles.heading}>Gs. 0 — DEMOSTRACIÓN</Text>
   <Text style={styles.text}>No hay ingresos ni saldos reales. No se generan cobros, depósitos ni retiros.</Text></Panel>
  <Panel><Text style={styles.heading}>Comisiones y liquidaciones</Text>
   <Text style={styles.text}>La plataforma calculará comisiones y recibos en el servidor a partir de tarifas versionadas, nunca con importes inventados en el dispositivo.</Text></Panel>
 </ScrollView>;
}
