import React from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {ClientRuntimeProvider} from '../src/ClientRuntime';
export default function ClientLayout(){
 return <ClientRuntimeProvider>
  <StatusBar style="dark"/>
  <Stack screenOptions={{headerTintColor:'#183044',headerStyle:{backgroundColor:'#F4F7FB'},headerTitleStyle:{fontWeight:'700'}}}>
   <Stack.Screen name="index" options={{title:'Movete Fácil Cliente'}}/>
   <Stack.Screen name="viaje" options={{title:'Solicitar automóvil'}}/>
   <Stack.Screen name="envios" options={{title:'Pedir envío'}}/>
   <Stack.Screen name="seguimiento" options={{title:'Seguimiento'}}/>
   <Stack.Screen name="mensajes" options={{title:'Mensajes con conductor'}}/>
   <Stack.Screen name="conversaciones" options={{title:'Mis conversaciones'}}/>
   <Stack.Screen name="historial" options={{title:'Mis viajes y envíos'}}/>
   <Stack.Screen name="comercios" options={{title:'Comercios'}}/>
   <Stack.Screen name="cotizacion" options={{title:'Cotizaciones'}}/>
   <Stack.Screen name="pagos" options={{title:'Pagos y recibos'}}/>
   <Stack.Screen name="soporte" options={{title:'Seguridad y soporte'}}/>
   <Stack.Screen name="cuenta" options={{title:'Mi cuenta'}}/>
  </Stack>
 </ClientRuntimeProvider>;
}
