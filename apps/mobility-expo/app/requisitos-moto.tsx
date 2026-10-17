import {router} from 'expo-router';
import React, {useState} from 'react';
import {Switch, Text, View} from 'react-native';
import {Button,C,Card,Headline,Navigation,Note,Page,Top,textStyles} from '../src/components/UI';
import {FormMessage} from '../src/components/Form';
import {emptyMotoPrecheck,evaluateMotoPrecheck,MOTO_PRECHECK_ITEMS,
 type MotoPrecheckAnswers,type MotoPrecheckField,type MotoPrecheckResult
} from '../src/domain/moto-precheck';

/**
 * Legal/compliance precheck only. Nothing is sent to a backend or saved.
 * The platform MUST NOT offer paid passenger motorcycle trips here.
 */
export default function MotorcycleRequirements() {
 const [answers,setAnswers]=useState<MotoPrecheckAnswers>(emptyMotoPrecheck);
 const [result,setResult]=useState<MotoPrecheckResult|null>(null);
 function toggle(key:MotoPrecheckField,value:boolean) {
  setAnswers(previous=>({...previous,[key]:value}));
  setResult(null);
 }
 return <Page>
  <Top subtitle="Motocicletas · investigación de requisitos" />
  <Headline
   eyebrow="Servicio MOTO aún no habilitado"
   title="Requisitos para conducir en moto"
   description="Revisá los documentos y condiciones que investigamos para Paraguay. Este formulario es una lista informativa, no una inscripción ni una aprobación comercial."
  />
  <Note>
   No guardamos ni enviamos las respuestas de esta pantalla. Para prestar transporte remunerado en moto aún necesitamos confirmar permisos específicos de cada municipio, cobertura de seguro y verificaciones legales.
  </Note>
  <Card>
   <Text style={textStyles.heading}>Revisión orientativa de documentos</Text>
   {MOTO_PRECHECK_ITEMS.map(item=><View key={item.key}
      style={{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:9,
       borderBottomWidth:1,borderBottomColor:C.line}}>
     <View style={{flex:1,gap:3}}>
      <Text style={{color:C.ink,fontWeight:'700',fontSize:14}}>{item.label}</Text>
      <Text style={textStyles.subtitle}>{item.detail}</Text>
     </View>
     <Switch
      accessibilityLabel={'Tengo o puedo presentar: '+item.label}
      value={answers[item.key]}
      onValueChange={v=>toggle(item.key,v)}
      trackColor={{true:C.teal}}
     />
    </View>)}
   <Button text="Revisar requisitos declarados"
    onPress={()=>setResult(evaluateMotoPrecheck(answers))} />
   {result&&<View style={{gap:8}}>
    <FormMessage
     text={result.declaredReadyForReview
      ? 'Declaraste contar con los elementos de esta lista.'
      : 'Faltan '+result.missing.length+' requisitos por declarar.'} />
    {result.missing.map(value=><Text key={value}
     style={{color:C.muted,fontSize:13}}>• {value}</Text>)}
    <Note>{result.notice}</Note>
   </View>}
  </Card>
  <Card>
   <Text style={textStyles.heading}>Seguridad de los pasajeros</Text>
   <Text style={textStyles.subtitle}>
    La normativa exige casco y chaleco reflectivo para los ocupantes y prohíbe llevar como acompañante a un menor de 12 años. Cada viaje futuro requeriría comprobaciones independientes en el servidor.
   </Text>
   <Note>La categoría moto no recibe viajes, tarifas, reservas ni pagos en esta fase.</Note>
   <Button text="Volver al registro de automóviles" secondary
    onPress={()=>router.push('/registro-conductor')} />
  </Card>
  <Navigation />
 </Page>;
}
