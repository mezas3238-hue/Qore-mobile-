import React,{useState} from 'react';
import {ScrollView,Switch,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/DriverUI';
export default function DriverHome(){
 const [demoAvailable,setDemoAvailable]=useState(false);
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Movete Fácil Driver</Text>
   <Text style={styles.heroSub}>Aplicación exclusiva para conductores y repartidores. Todos los movimientos de esta versión son locales y de prueba.</Text>
  </View>
  <View style={styles.badge}><Text style={styles.badgeText}>DEMO • SIN VIAJES REALES</Text></View>
  <Panel>
   <Text style={styles.heading}>Mi disponibilidad</Text>
   <View style={styles.row}>
    <Text style={[styles.text,{flex:1}]}>{demoAvailable?'Disponible en la simulación':'No disponible en la simulación'}</Text>
    <Switch value={demoAvailable} onValueChange={setDemoAvailable} trackColor={{true:palette.teal}} accessibilityLabel="Disponibilidad local de demostración"/>
   </View>
   <Text style={styles.small}>Este interruptor no publica tu GPS ni te pone disponible en la red de conductores.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mi cuenta de conductor</Text>
   <Text style={styles.text}>Registrá tus datos y revisá los requisitos antes de solicitar una aprobación administrativa.</Text>
   <Action label="Documentación y vehículo" onPress={()=>router.push('/documentos')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Viajes y envíos</Text>
   <Text style={styles.text}>Aquí aparecerán solamente ofertas dirigidas a tu identidad verificada por el backend.</Text>
   <Action label="Consultar mis ofertas" secondary onPress={()=>router.push('/ofertas')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mis ingresos</Text>
   <Action label="Ver ganancias y liquidaciones" secondary onPress={()=>router.push('/ganancias')}/>
  </Panel>
 </ScrollView>;
}
