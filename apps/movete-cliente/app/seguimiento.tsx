import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
const LABEL:Record<string,string>={
 idle:'Sin viaje activo',searching:'Buscando automóvil',assigned:'Conductor asignado',
 arriving:'Conductor en camino',in_progress:'En viaje',completed:'Finalizado',
 cancelled:'Cancelado',failed:'Servicio no completado'
};
export default function ClientTracking(){
 const {client,view}=useClientView();
 const state=view.tracking;
 const canSync=view.authenticated&&state.subscriptionActive&&!state.syncing;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Seguimiento</Text>
   <Text style={styles.heroSub}>Solo se muestra la asignación confirmada y autorizada por el servidor.</Text></View>
  {!view.authenticated||!state.subscriptionActive?
   <Panel><Text style={styles.heading}>Sin servicio activo</Text>
    <Text style={styles.text}>No hay sesión de pasajero ni viaje conectado. Nunca mostramos un automóvil o su ubicación sin datos verificados.</Text>
   </Panel>:
   <Panel>
    <Text style={styles.heading}>{LABEL[state.state]??'Estado pendiente'}</Text>
    <Text style={styles.text}>Revisión del servidor: {state.revision>=0?String(state.revision):'No disponible'}</Text>
    {state.assignedDriver?<Text style={styles.text}>Conductor: {state.assignedDriver.name} · Patente: {state.assignedDriver.plate}</Text>
     :<Text style={styles.text}>Identidad del conductor oculta hasta aceptación persistida y verificación.</Text>}
    {state.position&&state.etaMinutes!==null?<Text style={styles.text}>Llegada estimada verificada: {state.etaMinutes} min.</Text>
     :<Text style={styles.small}>GPS o tiempo estimado no disponibles, sin consentimiento o desactualizados.</Text>}
    {state.lastError&&<Text accessibilityRole="alert" style={styles.small}>Sincronización: {state.lastError}. La ubicación caducada está oculta.</Text>}
    <Action label={state.syncing?'Sincronizando…':'Actualizar desde el servidor'} disabled={!canSync}
      onPress={()=>{void client.syncTracking();}}/>
    <Text style={styles.small}>No se inventan tiempos, mapas ni confirmaciones por notificación push.</Text>
   </Panel>}
 </ScrollView>;
}
