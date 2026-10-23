import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
export default function Payments(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Pagos y recibos</Text>
   <Text style={styles.heroSub}>Ambiente de pruebas: sin dinero, tarjetas ni transacciones reales.</Text></View>
  <Panel><Text style={styles.heading}>Pago simulado inactivo</Text>
   <Text style={styles.text}>Se habilitarán únicamente métodos SIMULATED_CASH y SIMULATED_CARD cuando existan cotización vigente, sesión y contrato G7 certificados.</Text>
   <Text style={styles.small}>Nunca ingreses números de tarjeta ni datos financieros reales en este entorno.</Text>
  </Panel>
 </ScrollView>;
}
