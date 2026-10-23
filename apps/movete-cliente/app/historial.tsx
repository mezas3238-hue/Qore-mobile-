import React from 'react';
import {FlatList,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
const kind:Record<string,string>={RIDE:'Automóvil',DELIVERY:'Envío',MERCHANT_ORDER:'Pedido comercial'};
export default function ClientHistory(){
 const {view}=useClientView();
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
  ListFooterComponent={view.authenticated&&view.history?.nextCursor?
   <Panel><Text style={styles.text}>El servidor indica que existen más resultados por consultar. La carga de páginas requiere el contrato autenticado del backend.</Text></Panel>:null}
 />;
}
