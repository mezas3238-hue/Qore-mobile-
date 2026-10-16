import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, C, Card, Headline, Navigation, Note, Page, textStyles, Top } from '../src/components/UI';
import { useRides } from '../src/context/RideContext';
import { CATEGORY_LABEL, formatGs, STATUS_LABEL } from '../src/domain/rides';
export default function History() {
  const { state } = useRides();
  return <Page>
    <Top subtitle="Historial del pasajero" />
    <Headline eyebrow="Tu actividad" title="Mis viajes" description="Recibos y estados demostrativos de esta sesión." />
    <Note>Los datos se mantienen solo en la memoria de la aplicación durante esta sesión; no se han realizado viajes ni cobros.</Note>
    {state.rides.length === 0 && <Card><Text style={textStyles.heading}>Todavía no hiciste viajes de prueba</Text><Button text="Pedir un viaje demo" onPress={() => router.push('/demo')} /></Card>}
    {state.rides.map(r => <Card key={r.id}>
      <Text style={textStyles.heading}>{r.origin.label} → {r.destination.label}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={textStyles.subtitle}>{CATEGORY_LABEL[r.category]} · {STATUS_LABEL[r.stage]}</Text>
        <Text style={{ color: C.ink, fontWeight: '900' }}>{formatGs(r.quote.priceGs)}</Text>
      </View>
      <Text style={textStyles.subtitle}>{new Date(r.createdAt).toLocaleString('es-PY')} · {r.id}</Text>
      {r.stage === 'completed' && <Text style={textStyles.link}>Recibo ficticio · efectivo (NO PAGADO) · {r.rating ? `${r.rating} ★` : 'Sin calificar'}</Text>}
    </Card>)}
    <Button secondary text="Volver a viajes" onPress={() => router.push('/demo')} />
    <Navigation />
  </Page>;
}
