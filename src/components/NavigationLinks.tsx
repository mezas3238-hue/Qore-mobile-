import React from 'react';
import { Text, View } from 'react-native';
import { Button, Card, textStyles } from './UI';
import { Place } from '../domain/rides';
import { openNavigation } from '../services/navigation';

/** Actual map navigation via official Google Maps and Waze, NOT simulated distances. */
export function NavigationLinks({ destination, origin, label = 'Abrir ruta' }: { destination: Place; origin?: Place; label?: string }) {
  return <Card>
    <Text style={textStyles.heading}>{label}</Text>
    <Text style={textStyles.subtitle}>Rutas y tráfico reales se consultan en la app elegida. ViajeYa no calcula el tiempo real todavía.</Text>
    <View style={{ gap: 8 }}>
      <Button secondary text="🗺️ Navegar con Google Maps" onPress={() => void openNavigation('google', destination, origin)} />
      <Button secondary text="🚙 Navegar con Waze" onPress={() => void openNavigation('waze', destination)} />
    </View>
  </Card>;
}
