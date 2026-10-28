import { Text } from 'react-native';
import { Card, Headline, Navigation, Note, Page, textStyles, Top } from '../src/components/UI';
export default function About() {
  return <Page>
    <Top subtitle="Alcance y transparencia" />
    <Headline eyebrow="Versión 0.1 · prototipo" title="Sobre este MVP" description="La demostración es funcional de extremo a extremo dentro de un mismo dispositivo, sin depender de servicios externos." />
    <Card><Text style={textStyles.heading}>Implementado</Text>
      <Text style={textStyles.body}>• Simulación pasajero → solicitud → conductor → llegada → trayecto → finalización → valoración.</Text>
      <Text style={textStyles.body}>• Cotización orientativa por distancia haversine, sin rutas por calles ni tráfico.</Text>
      <Text style={textStyles.body}>• Panel administrativo ficticio, historial y recibos DEMO.</Text>
      <Text style={textStyles.body}>• Restricciones locales de transición de estados y tests de dominio.</Text>
    </Card>
    <Card><Text style={textStyles.heading}>No implementado / NO operativo</Text>
      <Text style={textStyles.body}>• Registro/login de pasajeros y solicitudes de conductor + vehículo implementados, pero requieren variables públicas de Supabase y auditoría final; la demo continúa sin conexión.</Text>
      <Text style={textStyles.body}>• Google Maps y Waze: navegación externa real; mapa nativo Android al configurar clave restringida. GPS en primer plano opcional; no existe seguimiento en vivo ni cálculo real de tarifa.</Text>
      <Text style={textStyles.body}>• Matching geográfico real, eventos push, KYC, seguros y licencias.</Text>
      <Text style={textStyles.body}>• Pagos por tarjeta, billeteras, efectivo verificado y facturación real.</Text>
      <Text style={textStyles.body}>• Atención al cliente, sistema antifraude y despliegue comercial.</Text>
    </Card>
    <Note>El backend de ViajeYa creado anteriormente en Lovable no se conecta automáticamente a este nuevo repositorio. Las claves y los permisos deben configurarse y auditarse antes de activar producción.</Note>
    <Navigation />
  </Page>;
}
