import React from 'react';
import { Text, View } from 'react-native';
import { Button, C, Card, Headline, Navigation, Note, Page, textStyles, Top } from '../src/components/UI';
import { useRides } from '../src/context/RideContext';
import { CATEGORY_LABEL, DEMO_FARES, formatGs, STATUS_LABEL } from '../src/domain/rides';

export default function AdminDemo() {
  const { state, act } = useRides();
  const finished = state.rides.filter(r => r.stage === 'completed');
  const gross = finished.reduce((sum, r) => sum + r.quote.priceGs, 0);
  const cards = [
    { label: 'Solicitudes demo', value: state.rides.length.toString() },
    { label: 'Finalizados', value: finished.length.toString() },
    { label: 'Activos', value: state.rides.filter(r => r.stage !== 'cancelled' && r.stage !== 'completed').length.toString() },
    { label: 'Comisión simulada', value: formatGs(gross * 0.15) },
  ];
  return <Page>
    <Top subtitle="Administración del prototipo" />
    <Headline eyebrow="Panel de control" title="Una ciudad en movimiento" description="Visualizá la operación ficticia y la estructura futura de administración." />
    <Note>Este panel no concede privilegios administrativos, no tiene usuarios reales ni expone datos de terceros. El panel productivo deberá protegerse con autenticación y rol administrador validado en servidor.</Note>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {cards.map(item => <View key={item.label} style={{ width: '48%', flexGrow: 1 }}>
        <Card><Text style={textStyles.subtitle}>{item.label}</Text><Text style={{ fontSize: 23, fontWeight: '900', color: C.ink }}>{item.value}</Text></Card>
      </View>)}
    </View>
    <Card>
      <Text style={textStyles.heading}>Historial de solicitudes</Text>
      {state.rides.length === 0 ? <Text style={textStyles.body}>Todavía no hay viajes simulados.</Text> : state.rides.map(ride => <View key={ride.id} style={{ gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <Text style={{ color: C.ink, fontWeight: '700' }}>{ride.origin.label} → {ride.destination.label}</Text>
        <Text style={textStyles.subtitle}>{STATUS_LABEL[ride.stage]} · {CATEGORY_LABEL[ride.category]} · {formatGs(ride.quote.priceGs)}</Text>
      </View>)}
    </Card>
    <Card>
      <Text style={textStyles.heading}>Tabla de tarifas ilustrativas</Text>
      {Object.entries(DEMO_FARES).map(([category, fare]) => <View key={category} style={{ gap: 2, paddingVertical: 7, borderBottomWidth: 1, borderColor: C.line }}>
        <Text style={{ fontWeight: '800', color: C.ink }}>{CATEGORY_LABEL[category as keyof typeof DEMO_FARES]}</Text>
        <Text style={textStyles.subtitle}>Base {formatGs(fare.base)} · km {formatGs(fare.perKm)} · minuto {formatGs(fare.perMinute)} · comisión {fare.commissionPercent}%</Text>
      </View>)}
    </Card>
    <Card>
      <Text style={textStyles.heading}>Antes de habilitar la operación</Text>
      <Text style={textStyles.body}>• Documentos de conductores y vehículos verificados.</Text>
      <Text style={textStyles.body}>• Licencias, seguros y permisos locales revisados.</Text>
      <Text style={textStyles.body}>• Motor seguro de asignación en backend.</Text>
      <Text style={textStyles.body}>• Pagos, seguridad y protección de datos auditados.</Text>
    </Card>
    <Button danger text="Reiniciar datos de demostración" onPress={() => act({ type: 'reset' })} />
    <Navigation />
  </Page>;
}
