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
   <Text style={styles.heroSub}>Compras y entregas con precio y disponibilidad confirmados por el servidor.</Text></View>
  <Panel><Text style={styles.heading}>Integración de catálogo requerida</Text>
   <Text style={styles.text}>El carrito productivo ya exige catálogo versionado, stock y precios del servidor. La compra permanece bloqueada porque el contrato actual aún no publica el catálogo para compradores ni una confirmación tipada de pedido.</Text>
   <Text style={styles.small}>Nunca se mostrarán productos ficticios ni se enviará un pedido con precios o stock vencidos.</Text></Panel>
  {categories.map(([title,description])=><Panel key={title}>
   <Text style={styles.heading}>{title}</Text><Text style={styles.text}>{description}</Text>
   <Text style={styles.small}>Se habilitará únicamente con sucursal, cobertura y catálogo vigentes del servidor.</Text>
  </Panel>)}
 </ScrollView>;
}
