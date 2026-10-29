import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView,useClientSimpleMode} from '../src/ClientRuntime';
export default function ClientHome(){
 const {view}=useClientView();
 const {simpleMode,setSimpleMode}=useClientSimpleMode();
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>Movete Fácil Cliente</Text>
   <Text style={styles.heroSub}>Cuatro servicios: AUTO pasajeros, MOTO pasajeros, ENVÍOS y COMERCIOS. Cada operación requiere backend verificado y autorización.</Text>
  </View>
  {simpleMode&&<Panel>
   <Text accessibilityRole="header" style={styles.heading}>Acciones principales</Text>
   <Text style={styles.text}>Elegí qué necesitás. Los viajes, envíos y pagos siguen sujetos a confirmación del servidor.</Text>
   <Action large label="VIAJAR · Elegí AUTO o MOTO" onPress={()=>router.push('/transporte')}/>
   <Action large label="ENVÍOS · Paquetes en auto o moto" onPress={()=>router.push('/envios')}/>
   <Action large label="COMERCIOS · Pedidos a domicilio" onPress={()=>router.push('/comercios')}/>
   <Action large label="Seguridad y ayuda" onPress={()=>router.push('/soporte')}/>
   <Action large label="Mi cuenta" onPress={()=>router.push('/cuenta')}/>
   <Action secondary label="Mostrar todas las opciones"
    onPress={()=>setSimpleMode(false)}/>
   <Text style={styles.small}>Modo simple: visualización temporal, sin modificar permisos ni habilitar servicios reales.</Text>
  </Panel>}
  {!simpleMode&&<>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Viajes de pasajeros</Text>
   <Text style={styles.text}>Elegí expresamente el tipo de vehículo: AUTO o MOTO para pasajeros. El servicio de ENVÍOS es independiente.</Text>
   <Action large label="Elegir AUTO o MOTO para viajar" onPress={()=>router.push('/transporte')}/>
   <Text style={styles.small}>MOTO pasajeros tiene su propio recorrido, pero sigue sin reservas comerciales por falta de aprobación legal, seguros y contrato backend.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Envíos y comercios</Text>
   <Action secondary label="ENVÍOS · Auto o moto de carga" onPress={()=>router.push('/envios')}/>
   <Action secondary label="Confirmación independiente de entrega"
    onPress={()=>router.push('/confirmacion-entrega')}/>
   <Action secondary label="COMERCIOS · Supermercados, farmacias y restaurantes" onPress={()=>router.push('/comercios')}/>
   <Action secondary label="Cotizaciones en Gs" onPress={()=>router.push('/cotizacion')}/>
  </Panel>
  {view.authenticated&&view.chat.contractReady&&view.chatHints.length>0&&
   <Panel>
    <Text accessibilityRole="header" style={styles.heading}>Avisos de mensajes</Text>
    <Text style={styles.small}>Estos avisos solo indican actividad, no confirman la identidad del repartidor ni la autorización para abrir el chat.</Text>
    {view.chatHints.map(hint=><View key={hint.eventId}>
     <Text style={styles.text}>{hint.body} · {hint.badgeText}</Text>
     <Action secondary label="Comprobar conversación"
      onPress={()=>router.push({pathname:'/mensajes',
       params:{serviceId:hint.serviceId,serviceKind:hint.serviceKind}})}/>
    </View>)}
   </Panel>}
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Mis actividades</Text>
   <Action secondary label="Seguimiento" onPress={()=>router.push('/seguimiento')}/>
   <Action secondary label="Mis conversaciones" onPress={()=>router.push('/conversaciones')}/>
   <Action secondary label="Mensajes del servicio" onPress={()=>router.push('/mensajes')}/>
   <Action secondary label="Historial" onPress={()=>router.push('/historial')}/>
   <Action secondary label="Pagos y recibos" onPress={()=>router.push('/pagos')}/>
   <Action secondary label="Seguridad y soporte" onPress={()=>router.push('/soporte')}/>
   <Action secondary label="Mi cuenta" onPress={()=>router.push('/cuenta')}/>
  </Panel>
  </>}
 </ScrollView>;
}
