import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/DriverUI';
import {router} from 'expo-router';
export default function DriverOffers(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Mis ofertas privadas</Text>
   <Text style={styles.heroSub}>Los viajes y envíos se muestran solo al conductor o repartidor autenticado correspondiente.</Text></View>
  <Panel>
   <Text style={styles.heading}>Sin ofertas conectadas</Text>
   <Text style={styles.text}>Esta compilación no tiene una sesión JWT de STAGING ni un servicio de push real. No se mostrarán solicitudes ficticias como si fueran trabajos disponibles.</Text>
   <Text style={styles.small}>Infraestructura preparada: G13 con reclamaciones protegidas y G15 con consulta privada, pendiente de conexión a Auth verificado en esta aplicación.</Text>
  </Panel>
  <Panel><Text style={styles.heading}>Seguridad de las asignaciones</Text>
   <Text style={styles.text}>Aceptar, rechazar y reasignar serán operaciones transaccionales del backend. Una oferta caducada no podrá aceptarse desde aquí.</Text>
  </Panel>
  <Action label="Volver al panel Driver" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}
