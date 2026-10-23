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
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}><Text style={styles.heroText}>Seguridad y soporte</Text>
   <Text style={styles.heroSub}>Prepará un reporte. Este ambiente no envía avisos ni activa asistencia.</Text></View>
  <Panel>
   <Text style={styles.heading}>Canal de atención aún desconectado</Text>
   <Text style={styles.text}>El formulario es una prueba local y no llega a operadores, conductores ni autoridades.</Text>
   <Text style={styles.small}>Si existe peligro inmediato, contactá directamente con los servicios locales de emergencia. No dependas de esta versión de prueba.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Borrador de incidente (QA)</Text>
   <Text style={styles.text}>Tipo de reporte</Text>
   {SUPPORT_TYPES.map(item=><Action key={item.code}
     label={item.label} secondary={category!==item.code}
     onPress={()=>{setCategory(item.code);setFeedback('');}}/>)}
   <Text style={styles.text}>Identificador del servicio (opcional, formato UUID)</Text>
   <TextInput style={styles.field} value={serviceId} onChangeText={setServiceId}
    placeholder="Solo si existe un servicio de prueba" accessibilityLabel="Identificador del servicio" maxLength={36}/>
   <Text style={styles.text}>Descripción de práctica</Text>
   <TextInput style={[styles.field,{minHeight:100,textAlignVertical:'top'}]}
    value={description} onChangeText={setDescription} multiline
    placeholder="Escribí una situación ficticia, sin datos personales" accessibilityLabel="Descripción del incidente" maxLength={500}/>
   <Action label="Validar borrador sin enviar" onPress={()=>{
    const check=validateSupportDraft({category,serviceId,description});
    setFeedback(check.ok?'Borrador válido. NO fue enviado y no hay número de caso.':check.reason);
   }}/>
   {feedback!==''&&<Text accessibilityRole="alert" style={[styles.text,{color:palette.primary}]}>{feedback}</Text>}
  </Panel>
  <Panel><Text style={styles.heading}>Protección de datos</Text>
   <Text style={styles.text}>El seguimiento exige asignación confirmada, permisos de ubicación vigentes y revisión del servidor. No ingreses documentación personal en este formulario.</Text></Panel>
 </ScrollView>;
}
