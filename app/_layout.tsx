import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RideProvider } from '../src/context/RideContext';
export default function RootLayout() {
  return <RideProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} /></RideProvider>;
}
