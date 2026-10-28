import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RideProvider } from '../src/context/RideContext';
import { AuthProvider } from '../src/context/AuthContext';
export default function RootLayout() {
  return <AuthProvider><RideProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} /></RideProvider></AuthProvider>;
}
