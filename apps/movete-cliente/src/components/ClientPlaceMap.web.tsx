import React from 'react';
import {Text,View} from 'react-native';
import {Action,styles} from '../ClientUI';
export type ClientMapPoint=Readonly<{latitude:number;longitude:number}>;
export type ClientPlaceMapProps={
 role:'pickup'|'dropoff';point:ClientMapPoint;busy:boolean;
 onConfirm:(point:ClientMapPoint)=>void;onClose:()=>void;
};
export default function ClientPlaceMap({onClose}:ClientPlaceMapProps){
 return <View><Text style={styles.small}>
  La confirmación de mapa de esta versión de QA requiere Android.
  No se considera validada en navegador.
 </Text><Action secondary label="Cerrar mapa" onPress={onClose}/></View>;
}
