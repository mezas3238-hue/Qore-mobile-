import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Panel,styles} from '../src/ClientUI';
const categories=[
 ['Supermercados','Sucursales, stock y precios confirmados por servidor.'],
 ['Restaurantes','Menú, preparación, entrega y cancelaciones.'],
 ['Farmacias OTC','Solo productos sin receta habilitados por la normativa.'],
 ['Otros comercios','Categorías autorizadas por zona y por sucursal.']
] as const;
export default function Commerce(){
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Comercios</Text>
   <Text style={styles.heroSub}>Compras y entregas desde negocios habilitados, sin suponer disponibilidad.</Text></View>
  <Panel><Text style={styles.heading}>Catálogo todavía no conectado</Text>
   <Text style={styles.text}>No podemos mostrar precios, stock ni tiendas abiertas hasta obtener el catálogo autorizado desde el servidor. No se generan pedidos comerciales desde esta pantalla.</Text></Panel>
  {categories.map(([title,description])=><Panel key={title}>
   <Text style={styles.heading}>{title}</Text><Text style={styles.text}>{description}</Text>
   <Text style={styles.small}>Pendiente de autorización y contrato por zona.</Text>
  </Panel>)}
 </ScrollView>;
}
