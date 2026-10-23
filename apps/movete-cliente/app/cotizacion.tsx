import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
export default function Fare(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Tarifa en guaraníes</Text>
   <Text style={styles.heroSub}>Cotización oficial calculada por el servidor, nunca por tu teléfono.</Text></View>
  <Panel><Text style={styles.heading}>Cotización no disponible</Text>
   <Text style={styles.text}>Aún no hay una tarifa confirmada. El importe en Gs, vigencia, ruta y versión tarifaria aparecerán cuando el servidor entregue una cotización autorizada.</Text>
   <Text style={styles.small}>Automóvil para pasajeros y motocicleta para envíos tienen tarifas distintas. No existe precio ficticio en esta vista.</Text>
  </Panel>
 </ScrollView>;
}
