import React,{useEffect,useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import {DELIVERY_CATEGORIES,validateDeliveryForm} from '../src/domain/delivery-form.mjs';
import {prepareLocalDeliveryRequest} from '../src/domain/client-request-preparation.mjs';
type Kind='AUTO'|'MOTO';

export default function ClientDeliveries(){
 const {client,view}=useClientView();
 const [pickup,setPickup]=useState('');
 const [destination,setDestination]=useState('');
 const [weight,setWeight]=useState('');
 const [length,setLength]=useState('');
 const [width,setWidth]=useState('');
 const [height,setHeight]=useState('');
 const [category,setCategory]=useState('PARCEL');
 const [restricted,setRestricted]=useState(false);
 const [vehicleKind,setVehicleKind]=useState<Kind>('MOTO');
 const [validated,setValidated]=useState(false);
 const [result,setResult]=useState('');
 const lock=useRef(false);
 const mutation=view.mutation;
 const myDraft=mutation.phase==='ready'&&mutation.operation==='deliveryRequest';
 const free=mutation.phase==='idle';
 useEffect(()=>{
  setPickup('');setDestination('');setWeight('');setLength('');setWidth('');
  setHeight('');setCategory('PARCEL');setRestricted(false);setVehicleKind('MOTO');
  setValidated(false);setResult('');
 },[view.account?.subject]);
 function edit(setter:(s:string)=>void,value:string){
  if(myDraft)return;
  setter(value);setValidated(false);setResult('');
 }
 function select(action:()=>void){
  if(myDraft)return;
  action();setValidated(false);setResult('');
 }
 function validate(){
  if(!free||lock.current)return;
  const numbers=[weight,length,width,height];
  if(numbers.some(x=>!/^[0-9]{1,6}$/.test(x.trim()))){
   setValidated(false);setResult('Peso y medidas deben ser enteros positivos sin decimales ni exponentes.');
   return;
  }
  const checked=validateDeliveryForm({pickup,destination,vehicleKind,
   grams:Number(weight),lengthCm:Number(length),widthCm:Number(width),
   heightCm:Number(height),category,restrictedItemDeclared:restricted});
  setValidated(checked.ok);
  setResult(checked.ok?
   'Borrador validado localmente. Las reglas finales, ruta, disponibilidad y precio quedan pendientes del servidor.':
   checked.reason);
 }
 function prepare(){
  if(!free||!validated||lock.current||!view.authenticated)return;
  lock.current=true;
  try{
   const prepared=prepareLocalDeliveryRequest({pickup,destination,vehicleKind,
    category,weight,length,width,height,restricted},()=>Crypto.randomUUID());
   if(!prepared.ok){setValidated(false);setResult(prepared.reason);return;}
   const stored=client.prepareDelivery(prepared.body);
   setResult(stored.ok?
    'Borrador guardado en esta sesión, sin envío al servidor, cobro o repartidor reservado.':
    'Hay una solicitud pendiente o no tenés autorización para preparar el envío.');
  }finally{lock.current=false;}
 }
 function discard(){
  if(!myDraft||!mutation.requestKey||lock.current)return;
  lock.current=true;
  try{
   const answer=client.discardPreparedMutation({
    operation:'deliveryRequest',requestKey:mutation.requestKey
   });
   setResult(answer.ok?'Borrador descartado antes del envío. Podés editarlo.':
    'No se puede borrar una solicitud cuyo resultado del servidor sea incierto.');
   if(answer.ok)setValidated(false);
  }finally{lock.current=false;}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Preparar un envío</Text>
   <Text style={styles.heroSub}>Documentos, paquetes y compras compatibles en auto o moto de carga. No reserva repartidores.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Paso 1 · Origen y entrega</Text>
   <TextInput style={styles.field} value={pickup}
    onChangeText={value=>edit(setPickup,value)} editable={!myDraft}
    placeholder="Dirección de recogida" accessibilityLabel="Origen del envío" maxLength={120}/>
   <TextInput style={styles.field} value={destination}
    onChangeText={value=>edit(setDestination,value)} editable={!myDraft}
    placeholder="Dirección de entrega" accessibilityLabel="Destino del envío" maxLength={120}/>
   <Text style={styles.heading}>Categoría</Text>
   {DELIVERY_CATEGORIES.map(item=><Action key={item.code} label={item.label}
    disabled={myDraft} secondary={category!==item.code}
    onPress={()=>select(()=>setCategory(item.code))}/>)}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Paso 2 · Vehículo de carga</Text>
   <View style={[styles.row,{justifyContent:'flex-start'}]}>
    <View style={{flex:1}}><Action label="Moto envíos" disabled={myDraft}
     secondary={vehicleKind!=='MOTO'} onPress={()=>select(()=>setVehicleKind('MOTO'))}/></View>
    <View style={{flex:1}}><Action label="Auto envíos" disabled={myDraft}
     secondary={vehicleKind!=='AUTO'} onPress={()=>select(()=>setVehicleKind('AUTO'))}/></View>
   </View>
   <Text style={styles.small}>Moto pasajeros no autorizada. Moto para carga hasta 10 kg y sujeta a permisos y cobertura del servidor.</Text>
   <Text style={styles.heading}>Peso y dimensiones</Text>
   <TextInput style={styles.field} value={weight} editable={!myDraft}
    onChangeText={value=>edit(setWeight,value)} placeholder="Peso en gramos"
    accessibilityLabel="Peso en gramos" keyboardType="numeric" maxLength={6}/>
   <TextInput style={styles.field} value={length} editable={!myDraft}
    onChangeText={value=>edit(setLength,value)} placeholder="Largo en cm"
    accessibilityLabel="Largo en centímetros" keyboardType="numeric" maxLength={3}/>
   <TextInput style={styles.field} value={width} editable={!myDraft}
    onChangeText={value=>edit(setWidth,value)} placeholder="Ancho en cm"
    accessibilityLabel="Ancho en centímetros" keyboardType="numeric" maxLength={3}/>
   <TextInput style={styles.field} value={height} editable={!myDraft}
    onChangeText={value=>edit(setHeight,value)} placeholder="Alto en cm"
    accessibilityLabel="Alto en centímetros" keyboardType="numeric" maxLength={3}/>
   <Action label={restricted?'Artículos restringidos: SÍ':'Artículos restringidos: NO'}
    disabled={myDraft} secondary={!restricted} onPress={()=>select(()=>setRestricted(!restricted))}/>
   <Text style={styles.small}>No se aceptan productos restringidos. Declarar NO no verifica legalidad o mercancía en tránsito.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Paso 3 · Revisar y preparar</Text>
   <Action label="Revisar borrador de envío" disabled={!free} onPress={validate}/>
   {validated&&<View>
    <Text style={styles.text}>Ruta: {pickup.trim()} → {destination.trim()}</Text>
    <Text style={styles.text}>Carga: {weight} g, {length} × {width} × {height} cm.</Text>
    <Text style={styles.text}>Vehículo: {vehicleKind==='MOTO'?'Moto de carga':'Auto de carga'}.</Text>
   </View>}
   {validated&&free&&view.authenticated&&
    <Action label="Preparar solicitud segura (sin enviar)" onPress={prepare}/>}
   {!view.authenticated&&<Text style={styles.small}>
    Iniciá sesión como pasajero para preparar el envío. La revisión del formulario no reserva ni cobra.
   </Text>}
   {myDraft&&<View>
    <Text style={styles.text}>Borrador preparado localmente. No se solicitó repartidor.</Text>
    <Action label="Descartar borrador sin enviar" secondary onPress={discard}/>
   </View>}
   {!free&&!myDraft&&<Text style={styles.small}>
    Existe una solicitud pendiente, reconocida o sin conciliar. No podés generar otra clave hasta resolverla.
   </Text>}
   {result!==''&&<Text accessibilityRole="alert"
    style={[styles.text,{color:palette.primary}]}>{result}</Text>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Paso 4 · Confirmación y precio</Text>
   <Action label="Cotizar y solicitar repartidor — pendiente del servidor"
    disabled onPress={()=>{}}/>
   <Text style={styles.small}>Se requiere cotización válida en Gs., permisos, confirmación expresa del cliente y backend de envíos certificado. No hay pagos, despachos ni rutas GPS activadas.</Text>
  </Panel>
 </ScrollView>;
}
