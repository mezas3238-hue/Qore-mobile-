/** Explicit AUTO/MOTO passenger choice, without mixing cargo/merchant modes. */
import React,{useState} from 'react';
import {router} from 'expo-router';
import {ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {selectPassengerVehicle} from '../src/domain/passenger-vehicle-choice.mjs';
import type {PassengerVehicleKind} from '../src/domain/passenger-vehicle-choice.mjs';

export default function ChoosePassengerVehicle(){
 const [vehicle,setVehicle]=useState<PassengerVehicleKind|null>(null);
 const choice=selectPassengerVehicle(vehicle);
 function continueToRide(){
  // Navigates to existing independent flows. NEVER triggers POST or booking.
  if(!choice.ok)return;
  if(choice.kind==='AUTO')router.push('/viaje');
  else if(choice.kind==='MOTO')router.push('/moto');
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>¿Cómo querés viajar?</Text>
   <Text style={styles.heroSub}>Elegí el vehículo para tu traslado. AUTO y MOTO son viajes de pasajeros diferentes de ENVÍOS y COMERCIOS.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>1 · Elegí tu vehículo</Text>
   <Action large label="AUTO · Viajar en automóvil" selected={vehicle==='AUTO'}
    secondary={vehicle!=='AUTO'} onPress={()=>setVehicle('AUTO')}/>
   <Text style={styles.small}>Transporte de pasajeros en automóvil. Comisión nominal 15 %, subsidio al cliente 10 % y retención bruta de la plataforma 5 % de la tarifa original.</Text>
   <Action large label="MOTO · Viajar en motocicleta" selected={vehicle==='MOTO'}
    secondary={vehicle!=='MOTO'} onPress={()=>setVehicle('MOTO')}/>
   <Text style={styles.small}>Transporte de pasajeros en motocicleta. Comisión nominal 12 %, subsidio al cliente 10 % y retención bruta de la plataforma 2 % de la tarifa original. Su habilitación requiere requisitos legales y de seguridad específicos.</Text>
   <Text style={styles.small}>Elegir un vehículo no garantiza un conductor disponible, cobertura, precio ni reserva. La tarifa final en guaraníes debe venir del servidor autorizado.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>2 · Continuá con tu viaje</Text>
   <Text accessibilityLiveRegion="polite" style={styles.text}>
    {choice.ok?'Seleccionaste '+choice.label+'. Revisarás origen, destino y disponibilidad en el recorrido correspondiente.':'Seleccioná AUTO o MOTO para continuar.'}
   </Text>
   <Action large label={choice.ok?'Continuar con '+choice.kind:'Primero elegí un vehículo'}
    disabled={!choice.ok} onPress={continueToRide}
    hint="Abre el formulario del vehículo elegido, sin reservar ni cobrar"/>
   <Action secondary label="Volver al inicio" onPress={()=>router.back()}/>
  </Panel>
 </ScrollView>;
}
