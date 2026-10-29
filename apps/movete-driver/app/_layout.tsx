import React,{useMemo} from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {DriverApplicationProviders} from '../src/DriverApplicationProviders';
import {getApprovedNativeDriverStagingRuntime} from '../src/NativeDriverStagingRuntime';
export default function DriverLayout(){
 const runtime=useMemo(()=>getApprovedNativeDriverStagingRuntime(),[]);
 return <DriverApplicationProviders runtime={runtime}>
  <StatusBar style="dark"/>
  <Stack screenOptions={{headerTintColor:'#112F37',headerStyle:{backgroundColor:'#F2F7F6'},headerTitleStyle:{fontWeight:'700'}}}>
   <Stack.Screen name="index" options={{title:'Movete Fácil Driver'}}/>
   <Stack.Screen name="documentos" options={{title:'Mis documentos'}}/>
   <Stack.Screen name="ofertas" options={{title:'Ofertas para mí'}}/>
   <Stack.Screen name="distancia-recogida" options={{title:'Distancia de recogida'}}/>
   <Stack.Screen name="viaje" options={{title:'Viaje asignado'}}/>
   <Stack.Screen name="calificar" options={{title:'Calificar al cliente'}}/>
   <Stack.Screen name="entrega" options={{title:'Custodia de entrega'}}/>
   <Stack.Screen name="mensajes" options={{title:"Mensajes privados"}}/>
   <Stack.Screen name="objetos-olvidados" options={{title:"Objetos olvidados"}}/>
   <Stack.Screen name="objetos-olvidados-moto" options={{title:"Objetos olvidados en MOTO"}}/>
   <Stack.Screen name="ganancias" options={{title:'Ganancias'}}/>
  </Stack>
 </DriverApplicationProviders>;
}
