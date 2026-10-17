import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, C, Card, Headline, Navigation, Note, Page, textStyles, Top } from '../src/components/UI';
import { REFERENCE_ROUTES, compareLab, VehicleType } from '../src/domain/fairprice';
import { formatGs } from '../src/domain/rides';

export default function FairPriceResearch() {
 const [vehicle,setVehicle]=useState<VehicleType>('auto');
 const [routeId,setRouteId]=useState(REFERENCE_ROUTES[2].id);
 const [promoMoto,setPromoMoto]=useState(false);
 const route=REFERENCE_ROUTES.find(r=>r.id===routeId)??REFERENCE_ROUTES[2];
 const reference=vehicle==='auto'?route.boltAutoGs:route.boltMotoGs;
 const scenario=useMemo(()=>compareLab({
   vehicle,km:route.km,min:route.min,
   experimentalCommissionBps:vehicle==='moto'&&promoMoto?800:1000
 },reference),[vehicle,route,reference,promoMoto]);
 const q=scenario.result;
 return <Page>
  <Top subtitle="Motor de precios · Investigación" />
  <Headline eyebrow="QORE FAIRPRICE / LAB" title="Precio claro. Ganancias visibles."
    description="Un estudio de cuánto podría pagar el pasajero, cuánto recibiría el conductor y cuánto quedaría para operar." />
  <Note>ESTO ES UNA SIMULACIÓN, NO TARIFAS REALES. Bolt son precios orientativos de páginas públicas, no cotizaciones actuales en la app. No hay cobros ni viajes activos.</Note>
  <Card>
    <Text style={textStyles.heading}>Elegí tipo de transporte</Text>
    <View style={{flexDirection:'row',gap:9}}>
      <View style={{flex:1}}><Button text="🚗 Auto" secondary={vehicle!=='auto'} onPress={()=>{setVehicle('auto');setPromoMoto(false)}} /></View>
      <View style={{flex:1}}><Button text="🏍️ Moto" secondary={vehicle!=='moto'} onPress={()=>setVehicle('moto')} /></View>
    </View>
    <Text style={[textStyles.heading,{marginTop:10}]}>Referencias de trayectos en Asunción</Text>
    {REFERENCE_ROUTES.map(r=><Pressable key={r.id} accessibilityRole="button"
      accessibilityState={{selected:routeId===r.id}} onPress={()=>setRouteId(r.id)}
      style={{borderWidth:1,borderColor:routeId===r.id?C.teal:C.line,borderRadius:12,
        backgroundColor:routeId===r.id?C.mint:C.white,padding:11,marginVertical:4}}>
      <Text style={{color:C.ink,fontWeight:'800'}}>{r.label}</Text>
      <Text style={textStyles.subtitle}>{r.km.toFixed(1)} km · {r.min} minutos estimados</Text>
    </Pressable>)}
    {vehicle==='moto'&&<Button secondary text={promoMoto?'Probar comisión 10%':'Simular 8% moto (experimental)'} onPress={()=>setPromoMoto(x=>!x)}/>}
  </Card>
  <Card style={{backgroundColor:'#123C3A'}}>
    <Text style={{fontWeight:'800',color:'#B4EBDD',fontSize:12}}>PRECIO QORE HIPOTÉTICO</Text>
    <Text style={{fontSize:32,fontWeight:'900',color:'#FFFFFF',marginVertical:4}}>{formatGs(q.fareGs)}</Text>
    <Text style={{color:'#E3FAF2',fontSize:15}}>El conductor recibiría {formatGs(q.driverGs)} antes de gastos.</Text>
    <Text style={{color:'#B4EBDD',marginTop:4}}>Comisión QORE: {q.commissionPct}% · {formatGs(q.commissionGs)}</Text>
  </Card>
  <View style={{flexDirection:'row',gap:10}}>
    <View style={{flex:1}}><Card>
      <Text style={textStyles.subtitle}>Referencia Bolt (NO en vivo)</Text>
      <Text style={{color:C.ink,fontSize:19,fontWeight:'900'}}>{formatGs(reference)}</Text>
    </Card></View>
    <View style={{flex:1}}><Card>
      <Text style={textStyles.subtitle}>Variación de precio</Text>
      <Text style={{fontWeight:'900',fontSize:23,color:scenario.passengerDifferencePct>0?'#AE6D13':C.darkTeal}}>
        {scenario.passengerDifferencePct>0?'+':''}{scenario.passengerDifferencePct}%
      </Text>
    </Card></View>
  </View>
  <Card>
    <Text style={textStyles.heading}>Transparencia para quien maneja</Text>
    <Text style={textStyles.body}>Diferencia de ingreso bruto respecto de la comisión Bolt publicada (23% auto / 20% moto): {formatGs(scenario.driverDifferenceGs)}.</Text>
    <Text style={textStyles.body}>Gasto operativo supuesto del vehículo: {formatGs(q.vehicleCostGs)}.</Text>
    <Text style={textStyles.body}>Disponible tras ese gasto: {formatGs(q.driverAfterVehicleCostGs)}.</Text>
    <Text style={textStyles.body}>Tasa por hora operativa simulada, contando recogida y espera reservada: {formatGs(q.driverHourGs)}.</Text>
    <Text style={textStyles.subtitle}>No es ingreso neto personal garantizado. Faltan pólizas, impuestos, costos de cada vehículo y horas sin demanda.</Text>
  </Card>
  <Card>
    <Text style={textStyles.heading}>¿Cómo se forma este precio?</Text>
    <Text style={textStyles.body}>Base + km + minutos: {formatGs(q.formulaGs)}.</Text>
    <Text style={textStyles.body}>Piso para remunerar al conductor: {formatGs(q.driverFloorGs)}.</Text>
    <Text style={textStyles.body}>Piso de gastos variables de plataforma: {formatGs(q.platformFloorGs)}.</Text>
    <Text style={textStyles.body}>Recogida hipotética: {q.pickupKm} km y {q.pickupMin} minutos; se cobra el mayor piso, redondeado a 500 Gs.</Text>
  </Card>
  <Note>La simulación conserva margen de contribución estimado sólo bajo hipótesis. Si resulta más cara que la referencia, lo muestra sin ocultarlo. El precio verdadero deberá calcularlo el servidor con rutas de Google y parámetros verificados.</Note>
  <Button text="Regresar" secondary onPress={()=>router.push('/')} />
  <Navigation/>
 </Page>;
}
