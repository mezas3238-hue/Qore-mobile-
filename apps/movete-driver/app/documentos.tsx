import React,{useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,palette,styles} from '../src/DriverUI';
import {validateDriverDraft} from '../src/domain/capabilities.mjs';
import {useDriverKycExpiry} from '../src/DriverKycExpiryProvider';
import {useDriverDocumentUpload} from '../src/DriverDocumentUploadProvider';
import type {DriverKycUploadKind} from '../src/domain/driver-document-upload.mjs';
import {useDriverWorkspace} from '../src/DriverWorkspaceProvider';
export default function DriverDocuments(){
 const [fullName,setFullName]=useState('');
 const [plate,setPlate]=useState('');
 const [kind,setKind]=useState<'AUTO'|'MOTO'>('AUTO');
 const [result,setResult]=useState('');
 const {state,refresh}=useDriverWorkspace();
 const upload=useDriverDocumentUpload();
 const kyc=useDriverKycExpiry();
 const [consent,setConsent]=useState(false);
 const kindLabels:Record<string,string>={
  licencia:'Licencia de conducir',identidad_frente:'Identidad — frente',
  identidad_dorso:'Identidad — dorso',cedula_verde:'Cédula verde',
  seguro:'Seguro',inspeccion:'Inspección',habilitacion:'Habilitación',
  rostro_selfie:'Foto de rostro (selfie)'
 };
 const statusLabels:Record<string,string>={
  pending:'Pendiente de revisión',approved:'Aprobado por revisión administrativa',
  rejected:'Rechazado — requiere revisión de documentación'
 };
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Documentación del conductor</Text>
   <Text style={styles.heroSub}>La verificación deberá completarse en almacenamiento privado y revisión administrativa; nunca se aprueba desde el teléfono.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Borrador local</Text>
   <Text style={styles.text}>Nombre completo</Text>
   <TextInput style={styles.field} value={fullName} onChangeText={setFullName}
    placeholder="Nombre y apellido" accessibilityLabel="Nombre del conductor" maxLength={90}/>
   <Text style={styles.text}>Chapa del vehículo</Text>
   <TextInput style={styles.field} value={plate} onChangeText={setPlate}
    autoCapitalize="characters" placeholder="ABC123" accessibilityLabel="Chapa" maxLength={12}/>
   <Text style={styles.text}>Clase de vehículo</Text>
   <View style={[styles.row,{justifyContent:'flex-start'}]}>
    <View style={{flex:1}}><Action label="Automóvil" secondary={kind!=='AUTO'} onPress={()=>setKind('AUTO')}/></View>
    <View style={{flex:1}}><Action label="Motocicleta" secondary={kind!=='MOTO'} onPress={()=>setKind('MOTO')}/></View>
   </View>
   <Action label="Validar borrador en el dispositivo" onPress={()=>{
    const checked=validateDriverDraft({fullName,plate,vehicleKind:kind});
    setResult(checked.ok?'Borrador válido. No se enviaron documentos ni se aprobó el vehículo.':checked.reason);
   }}/>
   {result!==''&&<Text accessibilityRole="alert" style={[styles.text,{color:palette.teal}]}>{result}</Text>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Vencimientos y estado de la cuenta</Text>
   <View accessibilityRole="alert" style={{
    borderRadius:12,padding:14,
    backgroundColor:kyc.snapshot?.state==='READY_QA'?'#E2F2EF':'#FFF0D4'
   }}>
    <Text style={[styles.text,{fontWeight:'800',
     color:kyc.snapshot?.state==='READY_QA'?palette.teal:palette.amber}]}>
     {kyc.notice.text}
    </Text>
   </View>
   <Text style={styles.small}>Esta alerta se actualiza al entrar, al volver a la aplicación y cada minuto mientras está abierta. La verificación de documentos y la habilitación para servicios son decisiones del servidor.</Text>
   <Action label="Comprobar vencimientos ahora" secondary
    disabled={kyc.phase==='not-configured'||kyc.phase==='checking'}
    onPress={()=>{void kyc.refresh();}}/>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Mi documentación privada</Text>
   <Text style={styles.small}>Para tu seguridad, detené el vehículo en un lugar seguro antes de abrir la cámara. Nunca te tomes una selfie mientras conducís.</Text>
   <Text style={styles.small}>Expediente obligatorio: licencia, cédula de identidad de ambos lados, cédula verde, habilitación, seguro, inspección y selfie actual con consentimiento y verificación facial. Una foto subida no basta para aprobar la cuenta.</Text>
   {state.phase==='connected'?<>
    <Text style={styles.text}>Último estado del servidor STAGING. No se muestran archivos ni identificaciones personales.</Text>
    {state.documents.length===0?
     <Text style={styles.small}>Aún no hay documentación registrada y comprobada para esta cuenta de prueba.</Text>:
     state.documents.map(doc=>
      <View key={doc.kind} style={{gap:4}}>
       <Text style={styles.text}>{kindLabels[doc.kind]??'Documento'}: {statusLabels[doc.status]??'Sin verificar'}</Text>
      </View>
     )
    }
    <Text style={styles.small}>Licencia actual revisada: {state.currentLicenseApproved?'Sí':'No'}. Se verifican por separado vehículo, vencimientos, seguro y autorizaciones; la aprobación documental no permite operar.</Text>
   </>:<Text style={styles.text}>No se ha confirmado una sesión Driver de STAGING. Por privacidad, no se muestran estados previos ni documentos locales. Estado: {state.phase}.</Text>}
   <Action label="Actualizar estado privado" secondary
    disabled={state.phase==='not-configured'||state.phase==='loading'}
    onPress={()=>{void refresh();}}/>
   <Text style={styles.small}>Cada archivo queda pendiente hasta la verificación oficial. La autorización de motos para paquetes no habilita viajes con pasajeros.</Text>
   <Text style={styles.heading}>Presentar mi expediente</Text>
   {upload.enabled&&state.phase==='connected'?<>
    {Object.entries(kindLabels).map(([documentKind,label])=>
     <Action key={documentKind} label={'Capturar '+label}
      secondary disabled={upload.state.phase==='sending'}
      onPress={()=>{void upload.submit(documentKind as DriverKycUploadKind,
       documentKind==='rostro_selfie'?consent:false).then(()=>refresh());}}/>)}
    <Action label={consent?'Consentimiento para selfie: aceptado':'Consentimiento para selfie: no aceptado'}
     secondary onPress={()=>setConsent(value=>!value)}/>
    <Text style={styles.small}>La fotografía del rostro requiere consentimiento expreso y captura de cámara; su carga no verifica automáticamente la identidad. El sistema solo confirma la recepción privada.</Text>
    {upload.state.message!==''&&<Text accessibilityRole="alert" style={styles.text}>{upload.state.message}</Text>}
    {upload.state.phase==='sending'&&<Text style={styles.small}>La verificación tiene tiempos máximos para evitar una espera interminable. Si la cámara del sistema permanece abierta, podés cerrarla de forma segura.</Text>}
   </>:<Text style={styles.small}>Captura y subida deshabilitadas hasta conectar una cámara nativa, Storage privado y un backend STAGING autorizados; no se envían fotos a destinos públicos.</Text>}
  </Panel>
 </ScrollView>;
}
