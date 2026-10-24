import React,{useState} from 'react';
import {ScrollView,Switch,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/DriverUI';
import {useDriverWorkspace} from '../src/DriverWorkspaceProvider';
export default function DriverHome(){
 const [demoAvailable,setDemoAvailable]=useState(false);
 const {state,refresh}=useDriverWorkspace();
 const phase:Record<string,string>={
  'not-configured':'STAGING sin conectar — no hay sesión de conductor',
  'signed-out':'Sesión de conductor cerrada',
  'authorization-required':'Cuenta sin autorización Driver verificada',
  'loading':'Comprobando identidad y estado en el servidor',
  'offline':'Sin conexión confirmada — datos privados ocultos',
  'connected':'Sesión Driver de STAGING validada para consulta'
 };
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Movete Fácil Driver</Text>
   <Text style={styles.heroSub}>Aplicación exclusiva para conductores y repartidores. Todos los movimientos de esta versión son locales y de prueba.</Text>
  </View>
  <View style={styles.badge}><Text style={styles.badgeText}>DEMO • SIN VIAJES REALES</Text></View>
  <Panel>
   <Text style={styles.heading}>Conexión privada de Driver</Text>
   <Text accessibilityRole="text" style={styles.text}>{phase[state.phase]}</Text>
   <Text style={styles.small}>Los datos de ofertas y documentación se consultan únicamente con una sesión autorizada. Esta compilación no incluye credenciales ni acceso productivo.</Text>
   <Action label="Volver a comprobar sesión STAGING" secondary
    disabled={state.phase==='not-configured'||state.phase==='loading'}
    onPress={()=>{void refresh();}}/>
   <Text style={styles.small}>Licencia revisada: {state.phase==='connected'?
    state.currentLicenseApproved?'aprobada en la revisión':'pendiente, rechazada o no verificada':'sin consultar'}. Ningún resultado habilita viajes reales.</Text>
  </Panel>
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
   <Text style={styles.heading}>Mensajes con clientes</Text>
   <Text style={styles.text}>La mensajería privada requiere asignación vigente y backend autenticado; permanece bloqueada.</Text>
   <Action label="Ver estado de mensajería" secondary onPress={()=>router.push('/mensajes')}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mis ingresos</Text>
   <Action label="Ver ganancias y liquidaciones" secondary onPress={()=>router.push('/ganancias')}/>
  </Panel>
 </ScrollView>;
}
