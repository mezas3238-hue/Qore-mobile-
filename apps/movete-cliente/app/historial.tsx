import React from 'react';
import {FlatList,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
const kind:Record<string,string>={RIDE:'Automóvil',DELIVERY:'Envío',MERCHANT_ORDER:'Pedido comercial'};
const safeMessage:Record<string,string>={
 INVALID_OR_EXPIRED_CURSOR:'La consulta venció. Reiniciá desde la primera página.',
 AUTH_REQUIRED:'La sesión caducó. Volvé a iniciar sesión.',
 FORBIDDEN:'La cuenta no tiene acceso a este historial.',
 INVALID_HISTORY_DTO:'El servidor no devolvió datos válidos para esta cuenta.',
 CURSOR_REPEATED:'Se detectó un cursor repetido. Reiniciá la consulta.',
 NETWORK_OR_TIMEOUT:'Sin conexión segura. Podés intentar de nuevo.',
 RATE_LIMITED:'Hay demasiadas consultas. Intentá más tarde.',
 SERVICE_UNAVAILABLE:'El servicio de historial no está disponible.',
 HISTORY_READ_IN_FLIGHT:'Ya se está consultando el historial.'
};
export default function ClientHistory(){
 const {client,view}=useClientView();
 const list=view.authenticated?view.history?.items??[]:[];
 return <FlatList
  style={styles.page}
  contentContainerStyle={styles.content}
  data={list}
  keyExtractor={item=>item.serviceId}
  initialNumToRender={12}
  maxToRenderPerBatch={18}
  windowSize={7}
  ListHeaderComponent={
   <View style={styles.hero}>
    <Text style={styles.heroText}>Mi historial</Text>
    <Text style={styles.heroSub}>Servicios propios, sin límite global de registros. La lista se muestra en partes para cuidar la memoria.</Text>
   </View>
  }
  ListEmptyComponent={<Panel>
    <Text style={styles.heading}>Todavía no hay servicios consultados</Text>
    <Text style={styles.text}>No hay historial autorizado conectado a esta sesión. No mostramos viajes, envíos ni recibos de otras cuentas.</Text>
   </Panel>}
  renderItem={({item})=><Panel>
    <Text style={styles.heading}>{kind[item.kind]??'Servicio'}</Text>
    <Text style={styles.text}>Estado: {item.status}</Text>
    <Text style={styles.small}>Registrado: {new Date(item.createdAt).toLocaleString('es-PY')} · Revisión {item.revision}</Text>
    <Text style={styles.small}>El comprobante y el total no se inventan ni se calculan en esta vista.</Text>
   </Panel>}
  ListFooterComponent={<Panel>
    <Text style={styles.small}>{view.historyConfigured
      ?'Consulta segura habilitada para esta sesión de prueba.'
      :'Lectura no disponible hasta certificar la API y permisos del pasajero.'}</Text>
    {view.historyLoadError&&<Text accessibilityRole="alert" style={styles.small}>
      No se pudo validar el historial: {safeMessage[view.historyLoadError]??'No se pudo completar la consulta.'}
    </Text>}
    {view.historyLoadError&&view.historyConfigured&&view.authenticated&&
      <Action label="Reiniciar consulta desde la primera página"
       disabled={view.historyLoading}
       onPress={()=>{void client.loadHistoryPage({reset:true});}}/>}
    {view.history?.nextCursor
      ?<Action label={view.historyLoading?'Consultando…':'Cargar más servicios'}
        disabled={!view.historyConfigured||view.historyLoading}
        onPress={()=>{void client.loadHistoryPage();}}/>
      :<Action label={view.historyLoading?'Consultando…':'Consultar historial'}
        disabled={!view.authenticated||!view.historyConfigured||view.historyLoading}
        onPress={()=>{void client.loadHistoryPage({reset:true});}}/>}
    <Text style={styles.small}>Los resultados se obtienen por páginas, sin limitar el total de servicios registrados.</Text>
   </Panel>}
 />;
}
