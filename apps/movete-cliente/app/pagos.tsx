import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
export default function Payments(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Pagos y recibos</Text>
   <Text style={styles.heroSub}>Integración financiera pendiente de proveedor, seguridad y conciliación certificados.</Text></View>
  <Panel><Text accessibilityRole="header" style={styles.heading}>Pago no habilitado</Text>
   <Text style={styles.text}>El contrato actual solo cubre métodos sintéticos de QA y no es la arquitectura financiera final. La app real requerirá cotización vigente, PSP autorizado, tokenización, receipt y conciliación del servidor.</Text>
   <Text style={styles.small}>No ingreses números de tarjeta ni datos financieros hasta que el proveedor real esté integrado y certificado.</Text>
  </Panel>
 </ScrollView>;
}
