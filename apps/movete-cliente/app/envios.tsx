import React,{useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {BookingRecoveryPanel} from '../src/BookingRecoveryPanel';
import {useClientView} from '../src/ClientRuntime';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {DELIVERY_CATEGORIES,validateDeliveryForm} from '../src/domain/delivery-form.mjs';
import {prepareLocalDeliveryRequest} from '../src/domain/client-request-preparation.mjs';
import {projectDeliveryDraftUi} from '../src/domain/delivery-draft-ui-policy.mjs';
import {projectOwnDeliveryActivity} from '../src/domain/own-delivery-activity.mjs';
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
 async function registerQa(){
  if(lock.current||!myDraft||!view.deliveryQaRegistration?.ready)return;
  // STAGING-only server tags, not a free-text street address or geocode.
  // A G5 accepts only authoritative zone codes; no pretend real routing.
  if(!/^[A-Z_]{3,40}$/.test(pickup.trim())
   ||!/^[A-Z_]{3,40}$/.test(destination.trim())
   ||pickup.trim()===destination.trim()){
   setResult('QA requiere códigos de zona del servidor, no direcciones de texto. No se envió el pedido.');
   return;
  }
  const current=client.snapshot();
  if(current.privateViewRevision!==view.privateViewRevision
   ||current.account?.subject!==view.account?.subject
   ||current.mutation.phase!=='ready'||current.mutation.operation!=='deliveryRequest'
   ||current.mutation.requestKey!==mutation.requestKey
   ||!current.deliveryQaRegistration?.ready)return;
  lock.current=true;setResult('');
  try{
   const answer=await client.submit();
   const latest=client.snapshot();
   if(latest.privateViewRevision!==view.privateViewRevision
    ||latest.account?.subject!==view.account?.subject
    ||latest.mutation.requestKey!==mutation.requestKey)return;
   setResult(answer.ok
    ?'Registro de prueba confirmado por G5 y lectura privada G121. Sin precio, repartidor ni pago.'
    :'El resultado de registro de prueba es incierto o fue rechazado. No vuelvas a enviar: consultá G121.');
  }catch{setResult('Resultado de registro incierto; consultá G121, nunca repitas el POST.');}
  finally{lock.current=false;}
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
    {view.deliveryQaRegistration?.ready===true&&
     <Action label="Registrar envío de prueba QA (sin repartidor)"
      hint="Único POST G5 con Keychain previo y verificación GET G121, sin precio, cobro o despacho."
      disabled={lock.current} onPress={()=>{void registerQa();}}/>}
    <Action label="Descartar borrador sin enviar" secondary onPress={discard}/>
   </View>}
   {!free&&!myDraft&&<Text style={styles.small}>
    Existe una solicitud pendiente, reconocida o sin conciliar. No podés generar otra clave hasta resolverla.
   </Text>}
   {result!==''&&<Text accessibilityLiveRegion="polite"
    style={[styles.text,{color:palette.primary}]}>{result}</Text>}
  </Panel>
  <BookingRecoveryPanel client={client} view={view} operation="deliveryRequest"/>
  <OwnDeliveryActivityPanel client={client} view={view}/>
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


/**
 * B#16 — Server-authoritative history + sender-scoped G68 custody.
 * Selection never guesses the vehicle from the local draft or tracks Driver.
 */
function OwnDeliveryActivityPanel({client,view}:{client:ClientExperience;view:ClientSnapshot}){
 const projection=projectOwnDeliveryActivity(view);
 const selected=projection.selected;
 const [feedback,setFeedback]=useState('');
 const running=useRef(false);
 async function finishQaDelivery(){
  if(running.current||!view.deliveryTerminalRelease?.canFinalize)return;
  const before=client.snapshot(),owner=view.account?.subject;
  if(!before.authenticated||before.account?.subject!==owner
   ||before.privateViewRevision!==view.privateViewRevision
   ||before.deliveryTerminalRelease?.deliveryId!==view.deliveryTerminalRelease.deliveryId
   ||!before.deliveryTerminalRelease.canFinalize)return;
  running.current=true;setFeedback('');
  try{
   const answer=await client.finalizeDeliveredDeliveryQa();
   const after=client.snapshot();
   if(after.privateViewRevision!==view.privateViewRevision
    ||after.account?.subject!==owner)return;
   setFeedback(answer.ok?
    'Entrega terminada verificada con G121 y G68. Se liberó la clave segura local para preparar otro envío de prueba. El historial sigue en el servidor.':
    'No hay prueba terminal suficiente o la consulta falló. La solicitud original sigue protegida; no crees otra.');
  }finally{running.current=false;}
 }
 async function refreshHistory(){
  if(running.current||!projection.canLoad)return;
  running.current=true;setFeedback('');
  const revision=view.privateViewRevision,owner=view.account?.subject;
  try{
   const result=await client.loadHistoryPage({reset:true});
   const latest=client.snapshot();
   if(latest.privateViewRevision!==revision||latest.account?.subject!==owner)return;
   setFeedback(result.ok?'Historial propio actualizado desde el servidor.':
    'No fue posible confirmar el historial. No se inventarán envíos ni precios.');
  }finally{running.current=false;}
 }
 async function verifyCustody(deliveryId:string,historyRevision:number){
  if(running.current||!projection.custodyReady)return;
  const latest=client.snapshot(),owner=view.account?.subject;
  if(!latest.authenticated||latest.privateViewRevision!==view.privateViewRevision
   ||latest.account?.subject!==owner||latest.history?.ownerId!==owner
   ||!latest.history||!latest.history.items.some(row=>row.kind==='DELIVERY'
    &&row.serviceId===deliveryId&&row.revision===historyRevision))return;
  running.current=true;setFeedback('');
  try{
   const result=await client.readOwnDeliveryCustody(deliveryId);
   const after=client.snapshot();
   if(after.privateViewRevision!==view.privateViewRevision
    ||after.account?.subject!==owner||after.history?.ownerId!==owner)return;
   setFeedback(result.ok?'Custodia consultada al servidor; el vehículo y la prueba provienen del registro privado.':
    'No se pudo verificar este envío en el servidor. No se confirma entrega, ubicación ni pago.');
  }finally{running.current=false;}
 }
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Mis envíos registrados</Text>
  <Text style={styles.small}>La lista proviene del historial privado del servidor.
   No incluye solicitudes preparadas únicamente en este teléfono.
   AUTO y MOTO envíos se identifican por el vehículo del comprobante de custodia, no por suposiciones.</Text>
  <Action label={view.historyLoading?'Consultando historial…':'Consultar mis envíos en el servidor'}
   busy={view.historyLoading} disabled={!projection.canLoad}
   hint="Lectura privada. No crea solicitudes ni cargos."
   onPress={()=>{void refreshHistory();}}/>
  {!projection.ready&&<Text accessibilityRole="alert" style={styles.small}>
   Historial HTTPS del pasajero sin certificar o sesión no disponible. La lectura permanece bloqueada.
  </Text>}
  {projection.ready&&projection.rows.length===0&&
   <Text style={styles.small}>No hay envíos propios confirmados en la página cargada.
    Consultá el historial cuando el backend esté disponible.</Text>}
  {projection.rows.map(row=><View key={row.deliveryId}>
   <Text style={styles.text}>Envío #{row.shortRef} · {row.status} · revisión {row.revision}</Text>
   <Action label={view.senderCustody.loading?'Consultando custodia…':'Verificar estado de este envío'}
    disabled={!row.canVerify||view.senderCustody.loading}
    busy={view.senderCustody.loading}
    hint="El vehículo y la entrega se muestran solo cuando G68 los verifica con tu sesión."
    onPress={()=>{void verifyCustody(row.deliveryId,row.revision);}}/>
   {selected!==null&&selected.deliveryId===row.deliveryId&&<View>
    <Text accessibilityLiveRegion="polite" style={styles.text}>
     {selected.vehicleLabel} · {selected.stateLabel} ·
     revisión {selected.revision}.
    </Text>
    <Text style={styles.small}>{selected.complete
     ?'Entrega con prueba de custodia verificada por el servidor de QA.'
     :'Entrega final todavía no confirmada con prueba independiente.'}
     {' '}Sin GPS ni ETA certificados; este estado no confirma cobro ni liquidación.
    </Text>
   </View>}
  </View>)}
  {selected!==null&&view.deliveryTerminalRelease?.canFinalize
   &&view.deliveryTerminalRelease.deliveryId===selected.deliveryId
   &&<Action label="Cerrar envío de prueba finalizado y preparar otro"
    hint="Relee G121 y G68: solo libera las claves del teléfono con prueba terminal válida. Sin cambios de pago ni entrega del servidor."
    disabled={running.current||view.deliveryTerminalRelease.busy}
    onPress={()=>{void finishQaDelivery();}}/>}
  {feedback!==''&&<Text accessibilityLiveRegion="polite" style={styles.small}>{feedback}</Text>}
  <Text style={styles.small}>
   Seguimiento y comprobantes solo cuando el backend verifique identidad, titularidad y estado.
   El historial completo se consulta en la pantalla «Mi historial».
  </Text>
 </Panel>;
}
