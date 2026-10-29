import React,{useMemo,useRef,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/DriverUI';
import {useNativeDriverAuth} from '../src/DriverApplicationProviders';
import {createG197DriverPickupPreferencesHttp}
 from '../src/domain/g197-pickup-preferences-http.mjs';

type Kind='RIDE'|'MOTO_RIDE'|'DELIVERY'|'MERCHANT_ORDER';
const SERVICES:{kind:Kind;label:string}[]=[
 {kind:'RIDE',label:'Recoger pasajeros en AUTO'},
 {kind:'MOTO_RIDE',label:'Recoger pasajeros en MOTO'},
 {kind:'DELIVERY',label:'Recoger envíos particulares'},
 {kind:'MERCHANT_ORDER',label:'Recoger pedidos de comercios'}
];
const METERS=[1000,2000,3000,5000,8000,10000,15000,20000,30000,50000];
const yes=(x:string|undefined)=>x==='true';
export default function DriverPickupDistance(){
 const auth=useNativeDriverAuth();
 const [kind,setKind]=useState<Kind>('RIDE');
 const [draft,setDraft]=useState(5000);
 const [saved,setSaved]=useState<Record<string,{maximumRoadMeters:number;revision:number}>>({});
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const gateway=useMemo(()=>createG197DriverPickupPreferencesHttp({
  enabled:yes(process.env.EXPO_PUBLIC_G197_OWNER_APPROVED),
  ownerApproved:yes(process.env.EXPO_PUBLIC_G197_OWNER_APPROVED),
  serverRoleVerified:yes(process.env.EXPO_PUBLIC_G197_DRIVER_ROLE_VERIFIED),
  roadEnforcementVerified:yes(process.env.EXPO_PUBLIC_G197_ROAD_ENFORCEMENT_VERIFIED),
  origin:process.env.EXPO_PUBLIC_QORE_STAGING_API_ORIGIN,
  // A separately reviewed owner pin: using the same dynamic API origin as
  // its own pin would not independently attest the destination host.
  pinnedOrigin:process.env.EXPO_PUBLIC_QORE_STAGING_PINNED_ORIGIN,
  getSession:()=>auth?.getSession()??null
 }),[auth]);
 async function reload(){
  if(lock.current||!gateway.isConfigured())return;
  lock.current=true;setBusy(true);setNotice('');
  try{
   const r=await gateway.read();
   if(!r.ok||!r.data?.preferences){
    setSaved({});setNotice('No se verificaron tus preferencias del servidor. No se cambiará el despacho.');return;
   }
   const next:Record<string,{maximumRoadMeters:number;revision:number}>={};
   for(const row of r.data.preferences)
    next[row.serviceKind]={maximumRoadMeters:row.maximumRoadMeters,revision:row.revision};
   setSaved(next);
   setDraft(next[kind]?.maximumRoadMeters??5000);
   setNotice('Preferencias verificadas por el servidor. Ninguna selección modifica viajes ya asignados.');
  }finally{lock.current=false;setBusy(false);}
 }
 async function save(){
  if(lock.current||!gateway.isConfigured())return;
  lock.current=true;setBusy(true);setNotice('');
  try{
   const r=await gateway.update(kind,draft,saved[kind]?.revision??0);
   if(!r.ok||!r.data||r.data.serviceKind!==kind
    ||r.data.maximumRoadMeters!==draft||!Number.isSafeInteger(r.data.revision)){
    setNotice('Resultado incierto o rechazado. Consultá tus preferencias originales; no se reenviará la actualización.');
    return;
   }
   setSaved(old=>({...old,[kind]:{maximumRoadMeters:draft,revision:r.data!.revision!}}));
   setNotice('Distancia máxima confirmada en PostgreSQL QA. El backend rechazará una oferta fuera del rango cuando reciba ruta real y reciente.');
  }finally{lock.current=false;setBusy(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>Tu distancia de recogida</Text>
   <Text style={styles.heroSub}>Elegí hasta dónde estás dispuesto a desplazarte para recoger pasajeros o pedidos de comercios.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Distancia real por carretera</Text>
   <Text style={styles.text}>No usamos un círculo alrededor del vehículo. La distancia debe calcularla el servidor siguiendo calles y rutas válidas hasta el punto de recogida.</Text>
   <Text style={styles.small}>La preferencia no modifica viajes aceptados. Si faltan GPS reciente, cobertura o recorrido verificado, no se debe fabricar una distancia ni emitir una oferta bajo esta preferencia.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Tipo de servicio</Text>
   {SERVICES.map(item=><Action key={item.kind} secondary={kind!==item.kind}
    label={item.label+(kind===item.kind?' ✓':'')}
    onPress={()=>{setKind(item.kind);setDraft(saved[item.kind]?.maximumRoadMeters??5000);setNotice('');}}/>)}
   <Text style={styles.small}>Se guarda una preferencia independiente para pasajeros, envíos y pedidos de comercios. MOTO pasajeros aplica únicamente cuando el servidor comprueba la ruta por carretera y la habilitación municipal independiente.</Text>
  </Panel>
  <Panel>
   <Text style={styles.heading}>Máximo de recogida</Text>
   <Text style={styles.text}>Seleccionado: {(draft/1000).toLocaleString('es-PY')} km</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
    {METERS.map(m=><View key={m} style={{minWidth:72,flexGrow:1}}>
     <Action label={m/1000+' km'+(draft===m?' ✓':'')} secondary={draft!==m}
      onPress={()=>{setDraft(m);setNotice('');}}/>
    </View>)}
   </View>
   <Text style={styles.small}>Guardado en servidor para este servicio: {
    saved[kind]?saved[kind].maximumRoadMeters/1000+' km':'No verificado'}.</Text>
   <Action label={busy?'Comprobando…':'Consultar preferencias del servidor'}
    secondary disabled={!gateway.isConfigured()||busy}
    onPress={()=>{void reload();}}/>
   <Action label={busy?'Guardando…':'Guardar distancia máxima'}
    disabled={!gateway.isConfigured()||busy||
     saved[kind]?.maximumRoadMeters===draft}
    onPress={()=>{void save();}}/>
   {notice!==''&&<Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
  </Panel>
  {!gateway.isConfigured()&&<Panel>
   <Text accessibilityRole="alert" style={styles.heading}>Configuración pendiente de certificación</Text>
   <Text style={styles.small}>Los controles de guardado están bloqueados hasta que estén autorizados el servidor STAGING, la identidad Driver y la verificación de distancia real de recogida. Cambiar un valor visual aquí no modifica ofertas reales.</Text>
  </Panel>}
 </ScrollView>;
}
