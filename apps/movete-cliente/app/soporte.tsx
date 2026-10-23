import React,{useEffect,useState} from 'react';
import {useClientView} from '../src/ClientRuntime';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {SUPPORT_TYPES} from '../src/domain/support-draft.mjs';
import {createSupportDraftSession} from '../src/domain/support-draft-session.mjs';

export default function Support(){
 const {view}=useClientView();
 // Remontar ante logout, relogin, cambio de cuenta o rotación de JWT.
 return <PrivateSupportDraft key={view.privateViewRevision}/>;
}
function PrivateSupportDraft(){
 const [session]=useState(()=>createSupportDraftSession());
 const [draft,setDraft]=useState(()=>session.snapshot());
 // El controlador cierra y purga la memoria al desmontarse; jamás persiste contenido.
 useEffect(()=>()=>{session.dispose();},[session]);
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Seguridad y soporte</Text>
   <Text style={styles.heroSub}>Borrador privado de ayuda. No sustituye un canal de emergencia.</Text></View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>NO 911 / NO SOS / NO ENVIADO</Text>
   <Text style={styles.text}>Esta pantalla solo prepara un borrador local: no contacta autoridades, operadores ni conductores. No existe número de caso ni confirmación del servidor.</Text>
   <Text style={styles.small}>Ante peligro inmediato, acudí a los canales oficiales de emergencia de tu zona. No dependas de este formulario para pedir auxilio.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Preparar un reporte local</Text>
   <Text style={styles.text}>Tipo de reporte</Text>
   {SUPPORT_TYPES.map(item=><Action key={item.code}
     label={item.label} secondary={draft.category!==item.code} selected={draft.category===item.code}
     onPress={()=>setDraft(session.setCategory(item.code))}/>)}
   <Text style={styles.text}>Identificador del servicio (opcional, formato UUID)</Text>
   <TextInput style={styles.field} value={draft.serviceId} onChangeText={text=>setDraft(session.setServiceId(text))}
    placeholder="Solo si existe un servicio" accessibilityLabel="Identificador del servicio" maxLength={36}/>
   <Text style={styles.text}>Descripción del incidente</Text>
   <TextInput style={[styles.field,{minHeight:100,textAlignVertical:'top'}]}
    value={draft.description} onChangeText={text=>setDraft(session.setDescription(text))} multiline
    placeholder="Sin teléfonos, documentos, enlaces o ubicaciones exactas" accessibilityLabel="Descripción del incidente" maxLength={500}/>
   <Action label="Validar borrador (sin enviar)" onPress={()=>setDraft(session.validate())}/>
   <Action label="Borrar borrador local" secondary onPress={()=>setDraft(session.clear())}/>
   {draft.feedback!==''&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive"
    style={[styles.text,{color:palette.primary}]}>{draft.feedback}</Text>}
   <Text style={styles.small}>Estado: NO ENVIADO. La validación local no crea, transmite ni confirma ningún incidente.</Text>
  </Panel>
  <Panel><Text accessibilityRole="header" style={styles.heading}>Privacidad del borrador</Text>
   <Text style={styles.text}>Se borra al salir de la sesión o cambiar de cuenta, y puede eliminarse con el botón. La detección local de datos sensibles no es infalible: evitá escribir datos identificatorios.</Text></Panel>
 </ScrollView>;
}
