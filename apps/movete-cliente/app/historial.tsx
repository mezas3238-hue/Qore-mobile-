import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
export default function ClientHistory(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Mi historial</Text>
   <Text style={styles.heroSub}>Viajes y entregas de mi identidad verificada, sin datos de otras cuentas.</Text></View>
  <Panel><Text style={styles.heading}>Todavía no hay servicios</Text>
   <Text style={styles.text}>No hay viajes ni envíos reales conectados en esta compilación. Cuando se habilite STAGING, el servidor filtrará registros por tu sesión.</Text></Panel>
 </ScrollView>;
}
