import React,{useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {launchDriverSosPhone} from './DriverSosPhone';

/**
 * G298 — fixed top-right overlay for Driver's active trip/navigation screen.
 * Deliberately NO navigation, popup or automatic incident creation here.
 * The system telephone UI may cover the map, especially for 911.
 */
export function DriverSosFloatingControl(){
 const lock=useRef(false);
 const [failed,setFailed]=useState(false);
 const trigger=async()=>{
  if(lock.current)return;
  lock.current=true;
  try{
   setFailed((await launchDriverSosPhone())==='FAILED');
  }finally{lock.current=false;}
 };
 return <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
  <Pressable accessibilityRole="button"
   accessibilityLabel="SOS: llamar al número de emergencia o contacto configurado"
   accessibilityHint="Una pulsación inicia la llamada configurada mediante Android. El sistema telefónico puede cubrir el mapa."
   onPress={()=>{void trigger();}}
   style={sheet.control}>
   <Text style={sheet.emoji}>🆘</Text>
  </Pressable>
  {failed&&<Text accessibilityRole="alert" style={sheet.error}>
    No se pudo abrir el teléfono. Usá la app de llamadas del dispositivo.
  </Text>}
 </View>;
}
const sheet=StyleSheet.create({
 control:{
  position:'absolute',top:8,right:10,zIndex:40,
  width:48,height:48,borderRadius:18,
  alignItems:'center',justifyContent:'center',
  backgroundColor:'#FFFFFF',borderColor:'#C6D3D2',borderWidth:1,
  elevation:5
 },
 emoji:{fontSize:22,textAlign:'center'},
 error:{
  position:'absolute',top:60,right:12,maxWidth:220,
  padding:9,backgroundColor:'#FFFFFF',color:'#9B2020',fontSize:12,
  borderRadius:8,elevation:2
 }
});
