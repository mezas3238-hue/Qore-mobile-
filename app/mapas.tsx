import React, { useState } from 'react';
import * as Location from 'expo-location';
import { Text } from 'react-native';
import { Button, Card, Choice, Headline, MapSketch, Navigation, Note, Page, Top, textStyles } from '../src/components/UI';
import { NavigationLinks } from '../src/components/NavigationLinks';
import { PLACES } from '../src/domain/rides';
import { mapsDirectionsUrl } from '../src/domain/navigation';
import { openNavigation } from '../src/services/navigation';
import { LiveMap } from '../src/components/LiveMap';

export default function Maps() {
  const [destId, setDestId] = useState('shopping');
  const [originId, setOriginId] = useState('panteon');
  const [myPosition, setMyPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsMessage, setGpsMessage] = useState('');
  const origin = PLACES.find(p => p.id === originId) || PLACES[0];
  const destination = PLACES.find(p => p.id === destId) || PLACES[1];
  async function locate() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsMessage('Permiso denegado. Podés seleccionar puntos manualmente.'); return; }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyPosition({ lat: location.coords.latitude, lng: location.coords.longitude });
      setGpsMessage('Ubicación obtenida solo para mostrar tu posición y abrir navegación. No se publica ni envía a otros usuarios.');
    } catch { setGpsMessage('No se pudo obtener tu GPS. Revisá permisos y señal del dispositivo.'); }
  }
  return <Page>
    <Top subtitle="Mapas y navegación" />
    <Headline eyebrow="Google Maps + Waze" title="Elegí tu ruta" description="Abrí navegación verdadera en el proveedor que prefieras. Ninguna ruta solicita un viaje a conductores." />
    <LiveMap origin={origin} destination={destination} myPosition={myPosition} fallback={<MapSketch origin={origin} destination={destination} />} />
    <Card><Text style={textStyles.heading}>Punto de referencia de salida</Text>{PLACES.map(p => <Choice key={p.id} label={p.label} info={p.subtitle} selected={p.id === originId} onPress={() => setOriginId(p.id)} />)}</Card>
    <Card><Text style={textStyles.heading}>Destino</Text>{PLACES.map(p => <Choice key={p.id} label={p.label} info={p.subtitle} selected={p.id === destId} onPress={() => setDestId(p.id)} />)}</Card>
    <Card>
      <Button secondary text="📍 Usar mi ubicación actual (opcional)" onPress={() => void locate()} />
      {!!gpsMessage && <Text style={textStyles.subtitle}>{gpsMessage}</Text>}
      <Button text="Google Maps · desde mi ubicación" onPress={() => void openNavigation('google', destination)} />
      <Button secondary text="Google Maps · ruta desde el punto seleccionado" onPress={() => void openNavigation('google', destination, origin)} />
      <Button secondary text="Waze · navegar al destino" onPress={() => void openNavigation('waze', destination)} />
    </Card>
    <Note>El mapa nativo de Google en Android requiere habilitar Maps SDK y configurar una clave restringida al identificador Android + SHA-1; en iOS se puede mostrar Apple Maps. Waze se abre en su aplicación o sitio. Para iniciar viajes reales faltan geocodificación, routing y seguimiento autorizado.</Note>
    <Navigation />
  </Page>;
}
