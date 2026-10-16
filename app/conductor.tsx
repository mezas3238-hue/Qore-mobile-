import { router } from 'expo-router';
import React from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, C, Card, Headline, Navigation, Note, Page, Status, textStyles, Top } from '../src/components/UI';
import { useRides } from '../src/context/RideContext';
import { DEMO_FARES, formatGs, STATUS_LABEL } from '../src/domain/rides';

export default function DriverDemo() {
  const { active, state, act } = useRides();
  const completed = state.rides.filter(r => r.stage === 'completed');
  const demoNet = completed.reduce((sum, r) => sum + r.quote.priceGs - Math.round(r.quote.priceGs * DEMO_FARES[r.category].commissionPercent / 100), 0);
  return <Page>
    <Top subtitle="Portal del conductor" />
    <Headline eyebrow="Conductor · entorno simulado" title="Conducí a tu ritmo" description="Probá cómo un conductor acepta solicitudes y actualiza el estado de un viaje." />
    <Note>Conductor ficticio aprobado SOLO en demo. Los conductores reales deben validar identidad, vehículo, habilitaciones y seguros antes de recibir solicitudes.</Note>
    <Card>
      <Text style={textStyles.heading}>Registro obligatorio para conductores reales</Text>
      <Text style={textStyles.body}>Creá una cuenta, registrá tu licencia y el vehículo. El equipo administrativo debe aprobar antes de poder operar.</Text>
      <Button secondary text="Registrar conductor y vehículo" onPress={() => router.push('/registro-conductor')} />
      <Button secondary text="Ver estado de mi solicitud" onPress={() => router.push('/perfil')} />
    </Card>
    {active && <Button secondary text="Navegar con Maps / Waze al destino DEMO" onPress={() => router.push('/mapas')} />}
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}><Text style={textStyles.heading}>Disponibilidad</Text><Text style={textStyles.subtitle}>{state.driverAvailable ? 'Disponible para viajes DEMO' : 'No disponible'}</Text></View>
        <Switch accessibilityLabel="Disponibilidad simulada del conductor" value={state.driverAvailable} onValueChange={available => act({ type: 'availability', available })} trackColor={{ true: C.teal }} />
      </View>
    </Card>
    {active ? <>
      <Status ride={active} />
      {active.stage === 'searching' && <>
        <Text style={textStyles.subtitle}>Solicitud entrante (ficticia)</Text>
        <Button text="Aceptar viaje DEMO" disabled={!state.driverAvailable} onPress={() => act({ type: 'accept', id: active.id })} />
      </>}
      {active.stage === 'accepted' && <Button text="Marcar: llegué al origen" onPress={() => act({ type: 'arrive', id: active.id })} />}
      {active.stage === 'arriving' && <Button text="Iniciar viaje simulado" onPress={() => act({ type: 'start', id: active.id })} />}
      {active.stage === 'in_progress' && <Button text="Finalizar viaje simulado" onPress={() => act({ type: 'complete', id: active.id })} />}
      <Button secondary text="Ver vista del pasajero" onPress={() => router.push('/demo')} />
      <Text style={textStyles.subtitle}>Estado: {STATUS_LABEL[active.stage]}. El pasajero verá el mismo estado en este dispositivo.</Text>
    </> : <Card>
      <Text style={textStyles.heading}>Sin solicitudes pendientes</Text>
      <Text style={textStyles.body}>Creá un viaje desde la pantalla del pasajero para probar la asignación. No hay ningún usuario real conectado.</Text>
      <Button text="Crear un viaje de prueba →" onPress={() => router.push('/demo')} />
    </Card>}
    <Card>
      <Text style={textStyles.heading}>Resumen de ganancias DEMO</Text>
      <Text style={{ color: C.ink, fontWeight: '900', fontSize: 29 }}>{formatGs(demoNet)}</Text>
      <Text style={textStyles.subtitle}>{completed.length} viajes completados · comisión simulada del 10% · no hay saldo real.</Text>
    </Card>
    <Navigation />
  </Page>;
}
