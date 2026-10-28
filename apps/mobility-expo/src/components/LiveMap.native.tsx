import React from 'react';
import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import { Place } from '../domain/rides';
export function LiveMap({ origin, destination, myPosition, fallback }: {
  origin: Place; destination: Place; myPosition?: {lat:number;lng:number}|null; fallback: React.ReactNode;
}) {
  // Expo Go does not include expo-maps, and Google Maps requires a restricted SDK key.
  const isExpoGo = Constants.appOwnership === 'expo';
  const enabled = Boolean(Constants.expoConfig?.extra?.mapsEnabled);
  if (!enabled || isExpoGo) return <>{fallback}</>;
  try {
    const { AppleMaps, GoogleMaps } = require('expo-maps') as typeof import('expo-maps');
    const markers = [origin, destination].map(p => ({ coordinates: { latitude: p.lat, longitude: p.lng }, title: p.label }));
    const center = { latitude: myPosition?.lat ?? origin.lat, longitude: myPosition?.lng ?? origin.lng };
    return <View style={{ height: 250, overflow: 'hidden', borderRadius: 18 }}>
      {Platform.OS === 'android' ?
        <GoogleMaps.View style={{ flex: 1 }} cameraPosition={{ coordinates: center, zoom: 12 }} markers={markers} /> :
        <AppleMaps.View style={{ flex: 1 }} cameraPosition={{ coordinates: center, zoom: 12 }} markers={markers} />}
    </View>;
  } catch { return <>{fallback}</>; }
}
