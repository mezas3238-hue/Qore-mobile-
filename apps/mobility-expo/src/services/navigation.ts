import { Alert, Linking } from 'react-native';
import { mapsDirectionsUrl, Point, wazeDirectionsUrl } from '../domain/navigation';

export async function openNavigation(provider: 'waze' | 'google', destination: Point, origin?: Point): Promise<void> {
  try {
    const url = provider === 'waze' ? wazeDirectionsUrl(destination) : mapsDirectionsUrl(destination, origin);
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error('El dispositivo no permite abrir este enlace.');
    await Linking.openURL(url);
  } catch (e) { Alert.alert('No se pudo abrir el navegador', e instanceof Error ? e.message : 'Error de navegación'); }
}
