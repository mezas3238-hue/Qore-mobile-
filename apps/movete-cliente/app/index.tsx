import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,styles} from '../src/ClientUI';
export default function ClientHome(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Movete Fácil Cliente</Text>
   <Text style={styles.heroSub}>Automóviles, envíos y comercios en una sola app de cliente. Las operaciones se habilitan solo con contratos y autorización certificados.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Tu próximo viaje en automóvil</Text>
   <Text style={styles.text}>Indicá origen, destino y el tipo de servicio que preferís. La tarifa y la disponibilidad deben venir del servidor.</Text>
   <Action label="Preparar viaje" onPress={()=>router.push('/viaje')}/>
   <Text style={styles.small}>Motocicleta para pasajeros permanece deshabilitada hasta completar todos los permisos y seguros.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Más servicios</Text>
   <Action secondary label="Envíos particulares" onPress={()=>router.push('/envios')}/>
   <Action secondary label="Comercios y pedidos" onPress={()=>router.push('/comercios')}/>
   <Action secondary label="Cotizaciones en Gs" onPress={()=>router.push('/cotizacion')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mis actividades</Text>
   <Action secondary label="Seguimiento" onPress={()=>router.push('/seguimiento')}/>
   <Action secondary label="Historial" onPress={()=>router.push('/historial')}/>
   <Action secondary label="Pagos simulados" onPress={()=>router.push('/pagos')}/>
   <Action secondary label="Seguridad y soporte" onPress={()=>router.push('/soporte')}/>
   <Action secondary label="Mi cuenta" onPress={()=>router.push('/cuenta')}/>
  </Panel>
 </ScrollView>;
}
