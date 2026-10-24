import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,styles} from '../src/DriverUI';
import {useDriverWorkspace} from '../src/DriverWorkspaceProvider';

/** G50 chat entry: no live RPC/HTTPS provider integration, so NO send controls. */
export default function DriverMessages(){
 const {state}=useDriverWorkspace();
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Mensajes privados</Text>
   <Text style={styles.heroSub}>Conversaciones entre cliente y conductor o repartidor asignado.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Mensajería protegida — preparación G50</Text>
   <Text style={styles.text}>El almacenamiento y los contratos del chat están en pruebas. El servicio todavía no está conectado a esta aplicación.</Text>
   <Text style={styles.small}>Estado de Driver: {state.phase==='connected'?
    'sesión de pruebas verificada para consultas':'sin sesión de chat autorizada'}.</Text>
   <Text style={styles.small}>No se habilitan mensajes sin asignación vigente, servidor HTTPS autenticado y confirmación de persistencia.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Protección durante los viajes</Text>
   <Text style={styles.text}>Cambiar de conductor invalida la conversación anterior. Los avisos push no llevarán el texto. Usar comunicación solo cuando sea seguro hacerlo.</Text>
  </Panel>
  <Action label="Volver a Driver" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}
