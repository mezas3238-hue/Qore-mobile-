import React from 'react';
import {FlatList,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';

const LABELS:Record<'RIDE'|'DELIVERY'|'MERCHANT_ORDER',string>={
 RIDE:'Viaje en automóvil',DELIVERY:'Envío particular',
 MERCHANT_ORDER:'Entrega comercial'
};
export default function PassengerConversationInbox(){
 const {client,view}=useClientView();
 const inbox=view.chatInbox;
 const canLoad=view.authenticated&&inbox.readReady;
 const load=(next=false)=>void client.loadChatInbox({next});
 return <FlatList
  style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic"
  accessibilityLabel="Mis conversaciones privadas por servicio"
  data={canLoad?inbox.items:[]}
  keyExtractor={item=>item.conversationId}
  initialNumToRender={12} maxToRenderPerBatch={18} windowSize={7}
  ListHeaderComponent={<>
   <View style={styles.hero}>
    <Text accessibilityRole="header" style={styles.heroText}>Mis conversaciones</Text>
    <Text style={styles.heroSub}>Viajes, envíos y entregas con conductor o repartidor asignado.</Text>
   </View>
   <Panel>
    <Text style={styles.text}>Cada conversación se autoriza por el servicio activo. No se muestran teléfonos, nombres del conductor ni textos de mensajes en esta bandeja.</Text>
    {!view.authenticated&&<Text accessibilityRole="alert" style={styles.text}>
     Iniciá sesión para consultar tus conversaciones.
    </Text>}
    {view.authenticated&&!inbox.readReady&&
     <Text accessibilityRole="alert" style={styles.text}>
      La bandeja se habilitará cuando el backend certifique la mensajería y los permisos de Cliente y Driver.
     </Text>}
    {canLoad&&<Action label={inbox.loading?'Verificando…':'Actualizar conversaciones'}
     disabled={inbox.loading} busy={inbox.loading}
     onPress={()=>load(false)}/>}
   </Panel>
  </>}
  renderItem={({item})=><Panel>
   <Text accessibilityRole="header" style={styles.heading}>{LABELS[item.serviceKind]}</Text>
   <Text style={styles.text}>{inbox.stale?'Servicio consultado previamente; pendiente de nueva verificación':'Servicio con asignación verificada'}</Text>
   <Text style={styles.small}>Mensajes pendientes de leer: {item.unreadCount>=99?'99+':item.unreadCount}</Text>
   <Action label={inbox.stale?'Actualizar antes de abrir':'Abrir chat autorizado'}
    secondary disabled={inbox.stale||inbox.loading}
    onPress={()=>router.push({pathname:'/mensajes',params:{
     serviceId:item.serviceId,serviceKind:item.serviceKind}})}/>
  </Panel>}
  ListEmptyComponent={<Panel>
   <Text style={styles.text}>No hay conversaciones activas verificadas para mostrar.</Text>
   <Text style={styles.small}>No se inventan conductores, repartidores ni conversaciones antes de que existan en el servidor.</Text>
  </Panel>}
  ListFooterComponent={<Panel>
   {inbox.window.hasEvictedNewer&&
    <Text style={styles.small}>Se liberaron {inbox.window.evictedCount} conversaciones ya recorridas para cuidar la memoria. El historial completo permanece en el servidor; actualizá para volver a las recientes.</Text>}
   {inbox.error&&<Text accessibilityRole="alert" style={styles.text}>
    {inbox.stale?'Sin conexión: se muestra únicamente la última lista válida, sin permiso para abrir conversaciones. Actualizá cuando vuelva la red.':'No se pudo verificar la bandeja. Reiniciá la consulta para recuperar el permiso.'}
   </Text>}
   {canLoad&&inbox.hasNext&&<Action label={inbox.loading?'Consultando…':'Cargar más conversaciones'}
    disabled={inbox.loading} busy={inbox.loading}
    onPress={()=>load(true)}/>}
   <Text style={styles.small}>Solo se conservan páginas verificadas por cuenta. No existe límite global de conversaciones.</Text>
  </Panel>}
 />;
}
