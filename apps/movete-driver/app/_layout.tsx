import React from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {DriverWorkspaceProvider} from '../src/DriverWorkspaceProvider';
import {DriverMessagesProvider} from '../src/DriverMessagesProvider';
export default function DriverLayout(){
 return <DriverWorkspaceProvider>
  <DriverMessagesProvider>
  <StatusBar style="dark"/>
  <Stack screenOptions={{headerTintColor:'#112F37',headerStyle:{backgroundColor:'#F2F7F6'},headerTitleStyle:{fontWeight:'700'}}}>
   <Stack.Screen name="index" options={{title:'Movete Fácil Driver'}}/>
   <Stack.Screen name="documentos" options={{title:'Mis documentos'}}/>
   <Stack.Screen name="ofertas" options={{title:'Ofertas para mí'}}/>
   <Stack.Screen name="mensajes" options={{title:"Mensajes privados"}}/>
   <Stack.Screen name="ganancias" options={{title:'Ganancias'}}/>
  </Stack>
  </DriverMessagesProvider>
 </DriverWorkspaceProvider>;
}
