/** G325: map picker is mounted ONLY after a user taps a pickup/destination field.
 * No background GPS, no geocoding per keystroke and no location persistence.
 */
import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import MapView,{Marker,type MapPressEvent} from 'react-native-maps';
import * as Location from 'expo-location';
import {makePassengerDestinationCandidate} from '../domain/client-geolocation.mjs';
import type {PassengerPlace} from './client-location';
type PlaceLookup={ok:true;places:readonly PassengerPlace[]}|{ok:false;code:string};
type Props={
 visible:boolean;kind:'pickup'|'destination';initial:PassengerPlace|null;
 origin:PassengerPlace|null;onClose:()=>void;
 onConfirm:(place:PassengerPlace)=>void;onSearch:(query:string)=>Promise<PlaceLookup>;
};
const labelStyle={fontSize:15,color:'#183044'} as const;
const inputStyle={borderWidth:1,borderColor:'#DCE5F1',padding:12,borderRadius:10,
 backgroundColor:'#fff',color:'#183044',fontSize:16} as const;
const buttonStyle={borderRadius:12,padding:13,backgroundColor:'#DBECFA',marginTop:10} as const;
const valid=(point:{latitude:number;longitude:number})=>Number.isFinite(point.latitude)&&
 Number.isFinite(point.longitude)&&Math.abs(point.latitude)<=90&&Math.abs(point.longitude)<=180;
export function ClientNativeMapPicker({visible,kind,initial,origin,onClose,onConfirm,onSearch}:Props){
 const [candidate,setCandidate]=useState<PassengerPlace|null>(initial);
 const [query,setQuery]=useState('');
 const [results,setResults]=useState<readonly PassengerPlace[]>([]);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const generation=useRef(0),tapLocked=useRef(false),lastTap=useRef(0);
 useEffect(()=>{
  generation.current++;
  if(visible){
   setCandidate(initial);setQuery('');setResults([]);setBusy(false);
   setNotice(kind==='pickup'
    ?'Tu ubicación GPS aparece como recogida. Podés tocar el mapa para ajustar el punto.'
    :'Escribí un lugar o calle, tocá Buscar y elegí el resultado en el mapa.');
  }
 },[visible,kind,initial?.latitude,initial?.longitude,initial?.label]);
 function close(){generation.current++;setResults([]);setBusy(false);onClose();}
 async function search(){
  const text=query.trim();
  if(busy||text.length<4||text.length>120)return;
  const serial=++generation.current;setBusy(true);setResults([]);
  setNotice('Buscando una sola vez. No se consulta por cada tecla.');
  try{
   const result=await onSearch(text);
   if(serial!==generation.current)return;
   if(!result.ok){
    setNotice(result.code==='LOCATION_BUSY'||result.code==='SEARCH_COOLDOWN'
     ?'Hay otra búsqueda activa o un intervalo de seguridad. Intentá de nuevo.'
     :'No se encontró un lugar válido de Paraguay. Indicá calle, barrio y ciudad.');
    return;
   }
   setResults(result.places);
   setNotice('Elegí un resultado para situar el marcador y confirmarlo.');
  }catch{
   if(serial===generation.current)setNotice('No se pudo consultar la dirección.');
  }finally{if(serial===generation.current)setBusy(false);}
 }
 async function chooseFromMap(event:MapPressEvent){
  const coordinates=event.nativeEvent.coordinate;
  if(!valid(coordinates)||busy||tapLocked.current||
     Date.now()-lastTap.current<2500)return;
  const serial=++generation.current;tapLocked.current=true;
  lastTap.current=Date.now();setBusy(true);setResults([]);
  setNotice('Validando el punto seleccionado en Paraguay…');
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const permission=await Location.getForegroundPermissionsAsync();
   if(!permission.granted){
    if(serial===generation.current)setNotice('Activá el permiso de ubicación para verificar este punto.');
    return;
   }
   const addresses=await Promise.race([
    Location.reverseGeocodeAsync(coordinates),
    new Promise<never>((_,reject)=>{
     timer=setTimeout(()=>reject(Error('GEO_TIMEOUT')),7000);
    })
   ]);
   if(serial!==generation.current)return;
   const resolved=makePassengerDestinationCandidate(coordinates,addresses[0]);
   if(!resolved){
    setNotice('El mapa no verificó esta dirección como lugar de Paraguay. Buscá una calle y ciudad.');
    return;
   }
   setCandidate(resolved);setNotice('Punto verificado. Confirmá para volver al viaje.');
  }catch{
   if(serial===generation.current)setNotice('No fue posible verificar la dirección del marcador. Probá buscar por nombre.');
  }finally{
   if(timer!==undefined)clearTimeout(timer);
   tapLocked.current=false;
   if(serial===generation.current)setBusy(false);
  }
 }
 const focus=candidate??origin;
 const region=focus?{
  latitude:focus.latitude,longitude:focus.longitude,
  latitudeDelta:0.012,longitudeDelta:0.012
 }:null;
 return <Modal visible={visible} animationType="slide" onRequestClose={close}
  statusBarTranslucent={false}>
  <View style={{flex:1,backgroundColor:'#F4F7FB',padding:16,gap:12}}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
    <Text accessibilityRole="header" style={{fontSize:21,fontWeight:'800',color:'#183044'}}>
     {kind==='pickup'?'Ubicación de recogida':'Elegí tu destino'}
    </Text>
    <Pressable accessibilityRole="button" onPress={close}
     style={{padding:9}}><Text style={labelStyle}>Cerrar</Text></Pressable>
   </View>
   <TextInput accessibilityLabel="Buscar dirección en Paraguay" style={inputStyle}
    value={query} maxLength={120} autoCapitalize="sentences"
    placeholder="Calle, lugar, barrio y ciudad" onChangeText={setQuery}
    returnKeyType="search" onSubmitEditing={()=>{void search();}}/>
   <Pressable accessibilityRole="button" disabled={busy||query.trim().length<4}
    onPress={()=>{void search();}} style={{...buttonStyle,
     opacity:busy||query.trim().length<4?0.5:1}}>
    <Text style={{textAlign:'center',color:'#174C72',fontWeight:'700'}}>
     {busy?'Consultando…':'Buscar en el mapa'}</Text>
   </Pressable>
   {results.length>0&&<ScrollView style={{maxHeight:140}} keyboardShouldPersistTaps="always">
    {results.map((place,i)=><Pressable key={i+'-'+place.latitude+'-'+place.longitude}
     accessibilityRole="button" style={{padding:10,borderBottomWidth:1,borderColor:'#DCE5F1'}}
     onPress={()=>{
      generation.current++;setBusy(false);setCandidate(place);setResults([]);
      setNotice('Marcador ubicado. Comprobá el punto y confirmá.');
     }}><Text style={labelStyle}>{place.label}</Text></Pressable>)}
   </ScrollView>}
   <View style={{flex:1,minHeight:250,borderRadius:14,overflow:'hidden',backgroundColor:'#DCE5F1'}}>
    {region?<MapView key={focus!.latitude.toFixed(4)+':'+focus!.longitude.toFixed(4)}
      style={{flex:1}} initialRegion={region} onPress={e=>{void chooseFromMap(e);}}
      showsUserLocation={false} followsUserLocation={false} showsMyLocationButton={false}
      toolbarEnabled={false} loadingEnabled={true}>
      {candidate&&<Marker coordinate={{latitude:candidate.latitude,longitude:candidate.longitude}}
       title={kind==='pickup'?'Recogida':'Destino'}/>}
     </MapView>:
     <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:20}}>
      <Text style={{textAlign:'center',color:'#52697A'}}>
       Buscá un lugar para abrir el mapa. No se inventa una ubicación.</Text>
     </View>}
   </View>
   {busy&&<ActivityIndicator accessibilityLabel="Verificando ubicación"/>}
   <Text accessibilityLiveRegion="polite" style={{color:'#52697A',fontSize:14}}>{notice}</Text>
   {candidate&&<Text numberOfLines={2} style={{fontSize:15,fontWeight:'700',color:'#183044'}}>
    {candidate.label}</Text>}
   <Pressable accessibilityRole="button" disabled={!candidate||busy}
    onPress={()=>{
     if(candidate&&!busy){generation.current++;onConfirm(candidate);}
    }} style={{...buttonStyle,backgroundColor:'#1F7699',
     opacity:!candidate||busy?0.5:1,marginBottom:5}}>
    <Text style={{textAlign:'center',fontWeight:'800',color:'white'}}>
     Confirmar {kind==='pickup'?'recogida':'destino'}</Text>
   </Pressable>
  </View>
 </Modal>;
}
