import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
export default function Fare(){
 const {view}=useClientView();
 const quote=view.authenticated?view.quote:null;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Tarifa en guaraníes</Text>
   <Text style={styles.heroSub}>El importe proviene del servidor, nunca de un cálculo local.</Text></View>
  {quote?
   <Panel><Text style={styles.heading}>{quote.formattedAmount}</Text>
    <Text style={styles.text}>Modalidad: {quote.fareMode}</Text>
    <Text style={styles.text}>Versión tarifaria: {quote.fareVersion}</Text>
    <Text style={styles.small}>Válida hasta: {new Date(quote.expiresAt).toLocaleString('es-PY')}</Text>
    <Text style={styles.small}>Cotización informativa: no se realizó un pago ni se reservó un conductor.</Text>
   </Panel>:
   <Panel><Text style={styles.heading}>Cotización no disponible</Text>
    <Text style={styles.text}>Todavía no hay una cotización vigente y atribuida a este pasajero. El importe Gs., versión y duración requieren una API del servidor certificada.</Text>
    <Text style={styles.small}>La tarifa de automóvil para pasajeros es distinta a la de motocicleta para envíos. No se generan precios ficticios.</Text>
   </Panel>}
 </ScrollView>;
}
