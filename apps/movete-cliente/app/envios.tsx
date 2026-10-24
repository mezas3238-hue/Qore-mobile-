import React,{useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {DELIVERY_CATEGORIES,validateDeliveryForm} from '../src/domain/delivery-form.mjs';
import {prepareLocalDeliveryRequest} from '../src/domain/client-request-preparation.mjs';
import {projectDeliveryDraftUi} from '../src/domain/delivery-draft-ui-policy.mjs';
type Kind='AUTO'|'MOTO';

export default function ClientDeliveries(){
 const {client,view}=useClientView();
 // El key fuerza remount antes de pintar un JWT distinto, incluso si subject
 // es idéntico; no hay un render transitorio de rutas de la sesión previa.
 return <PrivateDeliveryForm key={view.privateViewRevision} client={client} view={view}/>;
}
function PrivateDeliveryForm({client,view}:{client:ClientExperience;view:ClientSnapshot}){
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
 const ui=projectDeliveryDraftUi({
  phase:mutation.phase,operation:mutation.operation,
  authenticated:view.authenticated,validated,restricted,vehicleKind
 });
 // Unknown mutation phases and pending/foreign requests are never editable.
 const free=ui.ok&&ui.editable;
 const myDraft=ui.ok&&ui.canDiscard;
 function edit(setter:(s:string)=>void,value:string){
  if(!free||lock.current)return;
  setter(value);setValidated(false);setResult('');
 }
 function select(action:()=>void){
  if(!free||lock.current)return;
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
  if(!ui.ok||!ui.canPrepare||lock.current)return;
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
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Preparar un envío</Text>
   <Text style={styles.heroSub}>Documentos, paquetes y compras compatibles en auto o moto de carga. No reserva repartidores.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Estado de tu borrador</Text>
   <Text accessibilityLiveRegion="polite" style={styles.small}>
    {ui.ok?ui.status:'Estado del formulario no verificable. Se bloquearon las ediciones.'}
   </Text>
   <Text style={styles.small}>Los datos y direcciones son privados de este dispositivo;
    revisar o preparar no solicita repartidor, no cotiza ni cobra.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 1 · Origen y entrega</Text>
   <TextInput style={styles.field} value={pickup}
    onChangeText={value=>edit(setPickup,value)} editable={free}
    placeholder="Dirección de recogida" accessibilityLabel="Origen del envío" maxLength={120}/>
   <TextInput style={styles.field} value={destination}
    onChangeText={value=>edit(setDestination,value)} editable={free}
    placeholder="Dirección de entrega" accessibilityLabel="Destino del envío" maxLength={120}/>
   <Text accessibilityRole="header" style={styles.heading}>Categoría</Text>
   {DELIVERY_CATEGORIES.map(item=><Action key={item.code} label={item.label}
    disabled={!free} secondary={category!==item.code} selected={category===item.code}
    onPress={()=>select(()=>setCategory(item.code))}/>)}
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 2 · Vehículo de carga</Text>
   <View style={[styles.row,{justifyContent:'flex-start'}]}>
    <View style={{flex:1,minWidth:140}}><Action label="Moto envíos" disabled={!free}
     secondary={vehicleKind!=='MOTO'} selected={vehicleKind==='MOTO'}
     onPress={()=>select(()=>setVehicleKind('MOTO'))}/></View>
    <View style={{flex:1,minWidth:140}}><Action label="Auto envíos" disabled={!free}
     secondary={vehicleKind!=='AUTO'} selected={vehicleKind==='AUTO'}
     onPress={()=>select(()=>setVehicleKind('AUTO'))}/></View>
   </View>
   <Text style={styles.small}>Moto pasajeros no autorizada. Moto para carga hasta 10 kg y sujeta a permisos y cobertura del servidor.</Text>
   <Text accessibilityRole="header" style={styles.heading}>Peso y dimensiones</Text>
   <TextInput style={styles.field} value={weight} editable={free}
    onChangeText={value=>edit(setWeight,value)} placeholder="Peso en gramos"
    accessibilityLabel="Peso en gramos" keyboardType="numeric" maxLength={6}/>
   <TextInput style={styles.field} value={length} editable={free}
    onChangeText={value=>edit(setLength,value)} placeholder="Largo en cm"
    accessibilityLabel="Largo en centímetros" keyboardType="numeric" maxLength={3}/>
   <TextInput style={styles.field} value={width} editable={free}
    onChangeText={value=>edit(setWidth,value)} placeholder="Ancho en cm"
    accessibilityLabel="Ancho en centímetros" keyboardType="numeric" maxLength={3}/>
   <TextInput style={styles.field} value={height} editable={free}
    onChangeText={value=>edit(setHeight,value)} placeholder="Alto en cm"
    accessibilityLabel="Alto en centímetros" keyboardType="numeric" maxLength={3}/>
   <Action label={restricted?'Artículos restringidos: SÍ':'Artículos restringidos: NO'}
    disabled={!free} secondary={!restricted} selected={restricted}
    onPress={()=>select(()=>setRestricted(!restricted))}/>
   <Text style={styles.small}>No se aceptan productos restringidos. Declarar NO no verifica legalidad o mercancía en tránsito.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 3 · Revisar y preparar</Text>
   <Action label="Revisar borrador de envío" disabled={!free}
    hint="Revisión local: no se envía ni reserva ningún servicio."
    onPress={validate}/>
   {validated&&<View>
    <Text style={styles.text}>Ruta: {pickup.trim()} → {destination.trim()}</Text>
    <Text style={styles.text}>Carga: {weight} g, {length} × {width} × {height} cm.</Text>
    <Text style={styles.text}>Vehículo: {vehicleKind==='MOTO'?'Moto de carga':'Auto de carga'}.</Text>
   </View>}
   {ui.ok&&ui.canPrepare&&
    <Action label="Preparar solicitud segura (sin enviar)"
     hint="Solo guarda el borrador privado. No crea un pedido ni despacha un repartidor."
     onPress={prepare}/>}
   {validated&&free&&restricted&&
    <Text accessibilityRole="alert" style={styles.small}>
     No se puede preparar un envío con artículos restringidos declarados.
    </Text>}
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
   {result!==''&&<Text accessibilityLiveRegion="polite"
    style={[styles.text,{color:palette.primary}]}>{result}</Text>}
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Mensajes con el repartidor</Text>
   <Text style={styles.text}>El chat de tu envío o pedido se abrirá desde su seguimiento una vez que el servidor confirme quién lo repartirá. También funcionará con repartidores en moto de carga.</Text>
   <Text style={styles.small}>No compartiremos automáticamente tu teléfono, y un borrador de envío no habilita comunicación con ningún repartidor.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 4 · Confirmación y precio</Text>
   <Action label="Cotizar y solicitar repartidor — pendiente del servidor"
    disabled hint="Se habilitará con cotización y contrato de envíos certificados" onPress={()=>{}}/>
   <Text style={styles.small}>Se requiere cotización válida en Gs., permisos, confirmación expresa del cliente y backend de envíos certificado. No hay pagos, despachos ni rutas GPS activadas.</Text>
  </Panel>
 </ScrollView>;
}
