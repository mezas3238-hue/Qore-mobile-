import React from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
export default function ClientLayout(){
 return <>
  <StatusBar style="dark"/>
  <Stack screenOptions={{headerTintColor:'#183044',headerStyle:{backgroundColor:'#F4F7FB'},headerTitleStyle:{fontWeight:'700'}}}>
   <Stack.Screen name="index" options={{title:'Movete Fácil Cliente'}}/>
   <Stack.Screen name="envios" options={{title:'Pedir envío'}}/>
   <Stack.Screen name="historial" options={{title:'Mis viajes y envíos'}}/>
   <Stack.Screen name="seguimiento" options={{title:'Seguimiento'}}/>
  </Stack>
 </>;
}
