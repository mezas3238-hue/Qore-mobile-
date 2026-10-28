import React,{useRef,useState} from 'react';
import {Text,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,styles} from './ClientUI';
import {reviewCommerceBasket} from './domain/commerce-checkout-review.mjs';
import {guardCommerceUiAction} from './domain/commerce-ui-action-guard.mjs';
import type {ClientExperience,ClientSnapshot} from './domain/client-experience.mjs';
import type {G148Result} from './domain/g148-commerce-durable-order.mjs';
import {createG148CommerceDurableOrder}
 from './domain/g148-commerce-durable-order.mjs';
type Controller=ReturnType<typeof createG148CommerceDurableOrder>;
const positive=(x:unknown)=>typeof x==='string'&&/^[1-9][0-9]{0,14}$/.test(x)
 &&Number.isSafeInteger(Number(x));
const resultMessage=(r:G148Result)=>{
 if(r.ok)return r.receipt?.orderId?
  'Pedido QA original '+r.receipt.orderId+'. Sin pago, envío ni operación comercial.':
  'Respuesta QA confirmada, sin pago ni despacho.';
 return r.code==='ORIGINAL_ORDER_RECOVERY_REQUIRED'
  ?'Ya existe una reserva pendiente en este dispositivo. Recuperala antes de solicitar otra.'
  :r.code==='POST_RESULT_UNKNOWN_RECOVER_ORIGINAL'
  ?'La respuesta HTTP es incierta. No vuelvas a reservar: recuperá el pedido original.'
  :r.code==='CANCEL_RESULT_UNKNOWN_RECOVER_ORIGINAL'
  ?'La cancelación es incierta. Consultá el estado del pedido original, sin repetir claves.'
  :'No se confirmó la operación QA: '+(r.code??'SIN_CONFIRMACION');
};
export function G148CommerceReserveAction({client,view,controller}:{
 client:ClientExperience;view:ClientSnapshot;controller:Controller
}){
 const [busy,setBusy]=useState(false),lock=useRef(false);
 const [message,setMessage]=useState('');
 if(!controller.isConfigured()||!view.authenticated)return null;
 const submit=async()=>{
  if(lock.current)return;
  const current=client.snapshot(),now=Date.now();
  if(current.privateViewRevision!==view.privateViewRevision||
   current.account?.subject!==view.account?.subject||
   !guardCommerceUiAction(view,current,{now}).ok){
   setMessage('Cambió tu identidad o catálogo. Volvé a verificar la sucursal.');
   return;
  }
  const review=reviewCommerceBasket(current.commerce,{authenticated:true,now});
  if(!review.ok||!positive(review.catalogVersion)){
   setMessage('El catálogo no tiene revisión numérica apta para reserva QA. No se envió nada.');
   return;
  }
  lock.current=true;setBusy(true);setMessage('');
  try{
   const result=await controller.reserve({
    requestKey:Crypto.randomUUID(),branchId:review.branchId,
    catalogVersion:Number(review.catalogVersion),vehicleKind:review.vehicleKind,
    items:review.lines.map(line=>({itemId:line.itemId,quantity:line.quantity}))
   });
   if(client.snapshot().privateViewRevision===view.privateViewRevision)
    setMessage(resultMessage(result));
  }catch{
   setMessage('Resultado desconocido. Recuperá el pedido original; no lo repitas.');
  }finally{lock.current=false;setBusy(false);}
 };
 return <View style={{gap:8}}>
  <Text accessibilityRole="header" style={styles.heading}>
   Reserva de stock QA · entorno aislado
  </Text>
  <Text style={styles.small}>
   Reserva transaccional de ensayo, solo cuando Backend A y PostgreSQL estén
   autorizados externamente. No compra, cobra, solicita repartidor ni fija entrega.
  </Text>
  <Action label={busy?'Registrando reserva QA…':'Reservar stock de ensayo (sin pago)'}
   busy={busy} disabled={busy} onPress={()=>void submit()}/>
  {message!==''&&<Text accessibilityRole="alert" style={styles.small}>{message}</Text>}
 </View>;
}
export function G148CommerceRecoveryPanel({client,view,controller}:{
 client:ClientExperience;view:ClientSnapshot;controller:Controller
}){
 const [busy,setBusy]=useState(false),lock=useRef(false);
 const [message,setMessage]=useState('');
 const [data,setData]=useState<G148Result['receipt']|null>(null);
 if(!controller.isConfigured()||!view.authenticated)return null;
 const call=async(operation:'read'|'cancel'|'release')=>{
  if(lock.current)return;
  lock.current=true;setBusy(true);setMessage('');
  const revision=view.privateViewRevision;
  try{
   const answer=operation==='read'?await controller.recover():
    operation==='cancel'?await controller.cancel(Crypto.randomUUID()):
     await controller.releaseCancelled();
   if(client.snapshot().privateViewRevision!==revision)return;
   setMessage(resultMessage(answer));
   if(answer.ok){
    setData(operation==='release'?null:answer.receipt??null);
   }else{
    // A network failure must never turn an uncertain order into a known cancel.
    setData(null);
   }
  }catch{setData(null);setMessage('No se verificó el estado original. No repitas el POST.');}
  finally{lock.current=false;setBusy(false);}
 };
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Pedido QA original · recuperación privada</Text>
  <Text style={styles.small}>
   Si se cortó la conexión, consultá la misma clave conservada en el almacenamiento
   seguro. Consultar no reserva otra vez ni cambia el inventario.
  </Text>
  <Action label={busy?'Consultando…':'Recuperar mi pedido del servidor'}
   disabled={busy} busy={busy} onPress={()=>void call('read')}/>
  {data&&<View style={{gap:6}}>
   <Text style={styles.text}>Orden: {data.orderId}</Text>
   <Text style={styles.text}>Estado confirmado: {data.status??'RESERVA_QA'}</Text>
   {data.subtotalPyg!==undefined&&<Text style={styles.text}>
    Subtotal de stock: {data.subtotalPyg.toLocaleString('es-PY')} Gs. · No cobrado
   </Text>}
   {(data.status==='requested'||data.status==='confirmed')&&
    <Action secondary disabled={busy}
     label="Cancelar reserva QA y devolver stock"
     onPress={()=>void call('cancel')}/>}
   {data.status==='cancelled'&&<Action secondary disabled={busy}
    label="Liberar clave tras confirmar cancelación"
    onPress={()=>void call('release')}/>}
  </View>}
  {message!==''&&<Text accessibilityRole="alert" style={styles.small}>{message}</Text>}
 </Panel>;
}
