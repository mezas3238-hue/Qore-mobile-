import React from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
export default function DriverLayout(){
 return <>
  <StatusBar style="dark"/>
  <Stack screenOptions={{headerTintColor:'#112F37',headerStyle:{backgroundColor:'#F2F7F6'},headerTitleStyle:{fontWeight:'700'}}}>
   <Stack.Screen name="index" options={{title:'Movete Fácil Driver'}}/>
   <Stack.Screen name="documentos" options={{title:'Mis documentos'}}/>
   <Stack.Screen name="ofertas" options={{title:'Ofertas para mí'}}/>
   <Stack.Screen name="ganancias" options={{title:'Ganancias'}}/>
  </Stack>
 </>;
}
