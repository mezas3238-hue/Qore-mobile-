import {router} from 'expo-router';
import React from 'react';
import {Text,View} from 'react-native';
import {Button,C,Card,Headline,MapSketch,Navigation,Note,Page,Status,Top,textStyles} from '../src/components/UI';
import {useRides} from '../src/context/RideContext';
import {guideJourney,nextJourneyAction} from '../src/domain/guided-journey';
import {formatGs,PLACES} from '../src/domain/rides';

/**
 * Same-device end-to-end demo. No real dispatcher, remote account, location
 * sharing, push notifications, charge, payout, or commercial MOTO.
 */
export default function GuidedJourney() {
 const {state,act,active}=useRides();
 const step=guideJourney(state);
 const next=nextJourneyAction(state);
 const last=state.rides[0];
 const current=active||last;
 const origin=current?.origin??PLACES[0];
 const destination=current?.destination??PLACES[1];
 const receipt=step.phase==='receipt'&&last?.stage==='completed'?last:null;
 return <Page>
  <Top subtitle="QA · viaje completo en un dispositivo"/>
  <Headline eyebrow="Simulación guiada · AUTO"
   title="De pedir un viaje a terminarlo"
   description="Probá los seis pasos de pasajero y conductor. Todo ocurre dentro de esta app de demostración."/>
  <Note>NO LIVE: un solo dispositivo, conductor inventado, distancia y precio hipotéticos. Ninguna solicitud llega a conductores reales, ni se comparte el GPS, ni se realiza un cobro.</Note>
  <Card>
   <Text style={textStyles.heading}>Progreso de la experiencia de prueba</Text>
   <View style={{flexDirection:'row',gap:5}}>
    {Array.from({length:6},(_,i)=><View key={i} style={{
     flex:1,height:8,borderRadius:9,backgroundColor:i<=step.index?C.teal:C.line
    }}/>)}
   </View>
   <Text style={textStyles.subtitle}>{step.index+1} de 6 · Paso que realiza: {step.actor}</Text>
   <Text style={[textStyles.heading,{fontSize:20}]}>{step.title}</Text>
   <Text style={textStyles.body}>{step.instruction}</Text>
   {step.phase==='accept'&&!state.driverAvailable&&<Note>El conductor DEMO está no disponible. Abrí su panel y activá Disponibilidad para continuar.</Note>}
   {!!next&&<Button text={step.buttonText??'Avanzar'}
     onPress={()=>act(next)}/>}
   {step.phase==='receipt'&&<Text style={{color:C.darkTeal,fontWeight:'800'}}>Recorrido ilustrativo completado. Pago efectuado: Gs. 0.</Text>}
   {step.phase==='cancelled'&&<Text style={{color:C.muted}}>No hubo conductor real ni cobro. Podés empezar otro recorrido.</Text>}
  </Card>
  <MapSketch origin={origin} destination={destination}/>
  {current&&<Status ride={current}/>}
  {receipt&&<Card>
   <Text style={textStyles.heading}>Comprobante de demostración</Text>
   <Text style={textStyles.body}>Monto ilustrativo: {formatGs(receipt.quote.priceGs)}</Text>
   <Text style={textStyles.body}>Cobrado: Gs. 0 · Transferido al conductor: Gs. 0</Text>
   <Text style={textStyles.subtitle}>Conductor, vehículo y tarifa ficticios. No es factura ni comprobante válido de pago.</Text>
   <Button secondary text="Ver historial de viajes ficticios" onPress={()=>router.push('/historial')}/>
  </Card>}
  {step.phase==='receipt'||step.phase==='cancelled'
   ?<Button secondary text="Reiniciar solamente la simulación" onPress={()=>act({type:'reset'})}/>
   :<View style={{gap:8}}>
    <Button secondary text="Abrir vista del pasajero" onPress={()=>router.push('/demo')}/>
    <Button secondary text="Abrir vista del conductor" onPress={()=>router.push('/conductor')}/>
   </View>}
  <Card>
   <Text style={textStyles.heading}>¿Qué falta para el viaje real?</Text>
   <Text style={textStyles.subtitle}>Autenticación de dos personas en teléfonos diferentes; aceptación atómica del conductor en backend; GPS, navegación real y cotización autorizada; políticas de seguridad, soporte, seguro, pagos y habilitaciones. Esta prueba no certifica esas integraciones.</Text>
  </Card>
  <Navigation/>
 </Page>;
}
