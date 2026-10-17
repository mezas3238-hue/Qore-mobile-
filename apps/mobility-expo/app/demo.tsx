import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, C, Card, CategoryChoices, Choice, Headline, MapSketch, Navigation, Note, Page, Status, textStyles, Top } from '../src/components/UI';
import { useRides } from '../src/context/RideContext';
import { NavigationLinks } from '../src/components/NavigationLinks';
import { Category, formatGs, PLACES, quoteDemo } from '../src/domain/rides';

export default function PassengerDemo() {
  const { active, state, request, act } = useRides();
  const [originId, setOriginId] = useState('panteon');
  const [destinationId, setDestinationId] = useState('shopping');
  const [category, setCategory] = useState<Category>('economico');
  const [error, setError] = useState('');
  const origin = PLACES.find(p => p.id === originId) || PLACES[0];
  const destination = PLACES.find(p => p.id === destinationId) || PLACES[1];
  const quote = useMemo(() => originId !== destinationId ? quoteDemo(origin, destination, category) : null, [origin, destination, category, originId, destinationId]);
  const last = state.rides[0];
  return <Page>
    <Top subtitle="Experiencia del pasajero" />
    <Headline eyebrow="Pasajero" title={active ? 'Tu viaje, paso a paso' : '¿A dónde vamos?'} description="Probá cómo funciona una solicitud. Ningún vehículo real recibirá este pedido." />
    <Button secondary text="Ver recorrido guiado de principio a fin" onPress={() => router.push('/recorrido')} />
    <MapSketch origin={active?.origin || origin} destination={active?.destination || destination} />
    <NavigationLinks destination={active?.destination || destination} origin={active?.origin || origin} label="Consultar ruta en Google Maps o Waze" />
    {active ? <>
      <Status ride={active} />
      <Note>La asignación es ficticia. Para continuar, abrí «Conductor» y aceptá la solicitud como conductor DEMO.</Note>
      <Button text="Ir al panel del conductor →" onPress={() => router.push('/conductor')} />
      {active.stage !== 'in_progress' && <Button text="Cancelar viaje de demostración" danger onPress={() => act({ type: 'cancel', id: active.id })} />}
    </> : <>
      {last?.stage === 'completed' && <Card>
        <Text style={textStyles.heading}>¡Viaje terminado!</Text>
        <Text style={textStyles.body}>Recibo de ejemplo: {formatGs(last.quote.priceGs)}. El pago NO se realizó.</Text>
        {last.rating ? <Text style={textStyles.subtitle}>Calificación demo: {last.rating} de 5 ★</Text> : <>
          <Text style={textStyles.subtitle}>¿Cómo estuvo el viaje simulado?</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            {[1, 2, 3, 4, 5].map(n => <View key={n} style={{ flex: 1 }}><Button text={`${n} ★`} secondary onPress={() => act({ type: 'rate', id: last.id, rating: n })} /></View>)}
          </View>
        </>}
      </Card>}
      {last?.stage === 'cancelled' && <Note>El viaje anterior fue cancelado. Podés crear otro.</Note>}
      <Card>
        <Text style={textStyles.heading}>Punto de partida</Text>
        {PLACES.map(p => <Choice key={p.id} selected={p.id === originId} onPress={() => setOriginId(p.id)} label={p.label} info={p.subtitle} />)}
      </Card>
      <Card>
        <Text style={textStyles.heading}>Destino</Text>
        {PLACES.map(p => <Choice key={p.id} selected={p.id === destinationId} onPress={() => setDestinationId(p.id)} label={p.label} info={p.subtitle} />)}
      </Card>
      <Card>
        <Text style={textStyles.heading}>Elegí tu vehículo</Text>
        <CategoryChoices category={category} onChange={setCategory} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 }}>
          <View><Text style={textStyles.subtitle}>Distancia / duración aprox.</Text><Text style={textStyles.number}>{quote ? `${quote.distanceKm} km · ${quote.minutes} min` : '—'}</Text></View>
          <View><Text style={textStyles.subtitle}>Tarifa demo</Text><Text style={textStyles.number}>{quote ? formatGs(quote.priceGs) : '—'}</Text></View>
        </View>
        {error && <Text accessibilityRole="alert" style={{ color: '#A12727' }}>{error}</Text>}
        <Button disabled={!quote} text="Simular pedido de viaje →" onPress={() => {
          const message = request(originId, destinationId, category);
          setError(message || '');
        }} />
        <Text style={{ color: C.muted, fontSize: 11 }}>Valores ficticios; no reflejan distancias por calle, tráfico, disponibilidad ni precios vigentes.</Text>
      </Card>
    </>}
    <Button text="Ver historial y recibos" secondary onPress={() => router.push('/historial')} />
    <Navigation />
  </Page>;
}
