/**
 * G327: in-app pickup/destination map preview for the Cliente ride draft.
 *
 * Displays only coordinates confirmed by the passenger. It deliberately does
 * NOT draw a straight line masquerading as a road route, and never computes a
 * fare, duration, driver ETA or dispatch without a verified server response.
 * Android Maps is mounted only after QORE_NATIVE_MAPS_APPROVED at build time.
 */
import React from 'react';
import {Text,View} from 'react-native';
import MapView,{Marker} from 'react-native-maps';
import type {PassengerPlace} from './native/client-location';
import {styles} from './ClientUI';

type Props={pickup:PassengerPlace|null;destination:PassengerPlace|null;enabled:boolean};
const valid=(place:PassengerPlace|null):place is PassengerPlace=>
 place!==null&&Number.isFinite(place.latitude)&&Number.isFinite(place.longitude)&&
 Math.abs(place.latitude)<=90&&Math.abs(place.longitude)<=180;

export function PassengerRoutePreview({pickup,destination,enabled}:Props){
 if(!enabled||!valid(pickup))return null;
 const second=valid(destination)?destination:null;
 const midpoint=second?{
  latitude:(pickup.latitude+second.latitude)/2,
  longitude:(pickup.longitude+second.longitude)/2
 }:{latitude:pickup.latitude,longitude:pickup.longitude};
 const region={
  ...midpoint,
  latitudeDelta:Math.max(0.015,second?Math.abs(pickup.latitude-second.latitude)*1.8:0),
  longitudeDelta:Math.max(0.015,second?Math.abs(pickup.longitude-second.longitude)*1.8:0)
 };
 const mapKey=[pickup.latitude,pickup.longitude,second?.latitude,second?.longitude].join(':');
 return <View accessibilityLabel="Mapa de recogida y destino" style={{gap:8}}>
  <Text style={styles.text}>
   {second?'Comprobá los dos puntos de tu viaje':'Tu ubicación de recogida en el mapa'}
  </Text>
  <View style={{height:260,borderRadius:16,overflow:'hidden',backgroundColor:'#DCE5F1'}}>
   <MapView key={mapKey} style={{flex:1}} initialRegion={region}
    showsUserLocation={false} followsUserLocation={false}
    showsMyLocationButton={false} toolbarEnabled={false}
    loadingEnabled={true} scrollEnabled={false} zoomEnabled={false}
    rotateEnabled={false} pitchEnabled={false}>
    <Marker coordinate={{latitude:pickup.latitude,longitude:pickup.longitude}}
     title="Origen" pinColor="#15835D"/>
    {second&&<Marker coordinate={{latitude:second.latitude,longitude:second.longitude}}
     title="Destino" pinColor="#1F7699"/>}
   </MapView>
  </View>
  <Text style={styles.small}>
   {second
    ?'Marcadores confirmados. Recorrido por calles, distancia, tiempo y tarifa: pendientes de verificación del servidor.'
    :'Tocá Destino para seleccionar el otro extremo de la ruta. No se ha solicitado conductor.'}
  </Text>
 </View>;
}
