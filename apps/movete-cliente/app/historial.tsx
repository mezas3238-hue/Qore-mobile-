import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
const kind:Record<string,string>={RIDE:'Automóvil',DELIVERY:'Envío',MERCHANT_ORDER:'Pedido comercial'};
export default function ClientHistory(){
 const {view}=useClientView();
 const list=view.authenticated?view.history?.items??[]:[];
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Mi historial</Text>
   <Text style={styles.heroSub}>Solo servicios propios, desde una sesión de pasajero verificada.</Text></View>
  {list.length===0?
   <Panel><Text style={styles.heading}>Todavía no hay servicios consultados</Text>
    <Text style={styles.text}>No hay historial autorizado conectado a esta sesión. No mostramos viajes, envíos ni recibos de otras cuentas.</Text></Panel>
   :list.map(item=><Panel key={item.serviceId}>
     <Text style={styles.heading}>{kind[item.kind]??'Servicio'}</Text>
     <Text style={styles.text}>Estado: {item.status}</Text>
     <Text style={styles.small}>Registrado: {new Date(item.createdAt).toLocaleString('es-PY')} · Revisión {item.revision}</Text>
     <Text style={styles.small}>El comprobante y el total no se inventan ni se calculan en esta vista.</Text>
    </Panel>)}
 </ScrollView>;
}
