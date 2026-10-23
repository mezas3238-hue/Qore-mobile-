import React,{useState} from 'react';
import {useClientView} from '../src/ClientRuntime';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {SUPPORT_TYPES,validateSupportDraft} from '../src/domain/support-draft.mjs';
export default function Support(){
 const {view}=useClientView();
 // El reporte local no se envía; su contenido tampoco sobrevive al logout,
 // relogin con la misma cuenta ni a una rotación del JWT.
 return <PrivateSupportDraft key={view.privateViewRevision}/>;
}
function PrivateSupportDraft(){
 const [category,setCategory]=useState('SAFETY');
 const [serviceId,setServiceId]=useState('');
 const [description,setDescription]=useState('');
 const [feedback,setFeedback]=useState('');
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Seguridad y soporte</Text>
   <Text style={styles.heroSub}>Prepará un reporte para el canal seguro que deberá confirmar recepción desde el servidor.</Text></View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Canal de atención aún desconectado</Text>
   <Text style={styles.text}>El formulario conserva únicamente un borrador local porque todavía falta el receipt tipado del servidor. No llega a operadores, conductores ni autoridades.</Text>
   <Text style={styles.small}>Si existe peligro inmediato, contactá directamente con los servicios locales de emergencia. No dependas de este canal hasta recibir confirmación verificable.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Preparar un reporte</Text>
   <Text style={styles.text}>Tipo de reporte</Text>
   {SUPPORT_TYPES.map(item=><Action key={item.code}
     label={item.label} secondary={category!==item.code} selected={category===item.code}
     onPress={()=>{setCategory(item.code);setFeedback('');}}/>)}
   <Text style={styles.text}>Identificador del servicio (opcional, formato UUID)</Text>
   <TextInput style={styles.field} value={serviceId} onChangeText={setServiceId}
    placeholder="Solo si existe un servicio" accessibilityLabel="Identificador del servicio" maxLength={36}/>
   <Text style={styles.text}>Descripción del incidente</Text>
   <TextInput style={[styles.field,{minHeight:100,textAlignVertical:'top'}]}
    value={description} onChangeText={setDescription} multiline
    placeholder="Describí la situación sin datos personales sensibles" accessibilityLabel="Descripción del incidente" maxLength={500}/>
   <Action label="Validar borrador sin enviar" onPress={()=>{
    const check=validateSupportDraft({category,serviceId,description});
    setFeedback(check.ok?'Borrador válido. NO fue enviado y no hay número de caso.':check.reason);
   }}/>
   {feedback!==''&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive"
    style={[styles.text,{color:palette.primary}]}>{feedback}</Text>}
  </Panel>
  <Panel><Text accessibilityRole="header" style={styles.heading}>Protección de datos</Text>
   <Text style={styles.text}>El seguimiento exige asignación confirmada, permisos de ubicación vigentes y revisión del servidor. No ingreses documentación personal en este formulario.</Text></Panel>
 </ScrollView>;
}
