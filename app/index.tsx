import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, C, Card, Headline, MapSketch, Navigation, Note, Page, Top } from '../src/components/UI';
import { PLACES } from '../src/domain/rides';

export default function Home() {
  return <Page>
    <Top subtitle="Tu movilidad, a tu manera" />
    <Headline eyebrow="QORE Mobile · Asunción" title="Movete por tu ciudad." description="Pedí un viaje en minutos. Conocé el recorrido antes de salir y viajá con tranquilidad." />
    <MapSketch origin={PLACES[0]} destination={PLACES[1]} />
    <Card style={styles.hero}>
      <Text style={styles.supertitle}>Tu próximo viaje comienza acá</Text>
      <Button text="Pedir un viaje · Explorar demo →" onPress={() => router.push('/demo')} />
      <Button text="Soy conductor" secondary onPress={() => router.push('/conductor')} />
      <Text style={styles.disclaimer}>Versión demostrativa. No solicita vehículos reales ni procesa pagos.</Text>
    </Card>
    <View style={styles.grid}>
      <View style={styles.gridItem}><Text style={styles.emoji}>📍</Text><Text style={styles.itemTitle}>Tu destino</Text><Text style={styles.itemText}>Elegí dónde querés ir</Text></View>
      <View style={styles.gridItem}><Text style={styles.emoji}>💵</Text><Text style={styles.itemTitle}>Precio claro</Text><Text style={styles.itemText}>Cotización ilustrativa</Text></View>
    </View>
    <Note>Antes de operar realmente se necesitan permisos, seguros, verificación de conductores, GPS, tarifas autorizadas y soporte.</Note>
    <Navigation />
  </Page>;
}
const styles = StyleSheet.create({
  hero: { marginTop: -2 },
  supertitle: { color: C.ink, fontWeight: '900', fontSize: 18, marginBottom: 5 },
  disclaimer: { textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 2 },
  grid: { flexDirection: 'row', gap: 10 },
  gridItem: { flex: 1, padding: 16, borderRadius: 20, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, gap: 4 },
  emoji: { fontSize: 22 }, itemTitle: { color: C.ink, fontSize: 15, fontWeight: '800' }, itemText: { color: C.muted, fontSize: 12 },
});
