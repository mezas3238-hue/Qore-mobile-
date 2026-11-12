/**
 * G324: optional, short-lived QA map. No GPS polling and no background tracking.
 * A user tap/drag changes a local candidate; server does not receive coordinates.
 * External OSM tiles load only after explicit "Ver mapa" consent.
 */
import React,{useMemo,useState} from 'react';
import {Linking,Text,View} from 'react-native';
import WebView from 'react-native-webview';
import {Action,styles} from '../ClientUI';
import {isParaguayMapCoordinate,parseMapPointMessage}
 from '../domain/client-map-point.mjs';

export type ClientMapPoint=Readonly<{latitude:number;longitude:number}>;
export type ClientPlaceMapProps={
 role:'pickup'|'dropoff';point:ClientMapPoint;busy:boolean;
 onConfirm:(point:ClientMapPoint)=>void;onClose:()=>void;
};
function leafletHtml(point:ClientMapPoint){
 const lat=point.latitude,lng=point.longitude;
 return `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://cdn.jsdelivr.net data:; style-src 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'none'"/>
 <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"
 integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous"/>
 <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden}
 .leaflet-container{background:#e9eef2;font:14px system-ui,sans-serif}</style></head><body>
 <div id="map" role="application" aria-label="Mapa para elegir el punto"></div>
 <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
 integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
 <script>(function(){
  const initial=[${lat},${lng}];
  const bounds=L.latLngBounds([[-27.8,-62.9],[-19.2,-54.1]]);
  const map=L.map('map',{zoomControl:true,preferCanvas:true,maxBounds:bounds,maxBoundsViscosity:1});
  map.setView(initial,16);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom:18,minZoom:6
  });
  let errors=0;
  tiles.once('tileload',function(){window.ReactNativeWebView.postMessage('{"kind":"map-ready"}');});
  tiles.on('tileerror',function(){if(++errors>=3)
   window.ReactNativeWebView.postMessage('{"kind":"map-error"}');});
  tiles.addTo(map);
  const marker=L.marker(initial,{draggable:true,autoPan:true}).addTo(map);
  function move(latlng){
   if(!bounds.contains(latlng))return;
   marker.setLatLng(latlng);
   window.ReactNativeWebView.postMessage(JSON.stringify({
    kind:'map-point',latitude:latlng.lat,longitude:latlng.lng
   }));
  }
  map.on('click',function(e){move(e.latlng);});
  marker.on('dragend',function(){move(marker.getLatLng());});
  setTimeout(function(){map.invalidateSize();},250);
 })();</script></body></html>`;
}
export default function ClientPlaceMap({role,point,busy,onConfirm,onClose}:ClientPlaceMapProps){
 const [selected,setSelected]=useState<ClientMapPoint>(point);
 const [failure,setFailure]=useState(false);
 const [tilesReady,setTilesReady]=useState(false);
 const html=useMemo(()=>leafletHtml(point),[point.latitude,point.longitude]);
 return <View style={{gap:9}}>
  <Text style={styles.small}>Mapa de QA: el pin indica el {role==='pickup'?'lugar de recogida':'destino'}.
   Tocá otra posición o arrastralo para corregirlo.</Text>
  {isParaguayMapCoordinate(point)&&!failure?
   <View style={{height:285,borderRadius:14,overflow:'hidden',backgroundColor:'#E8EEF2'}}>
    <WebView source={{html,baseUrl:'https://www.openstreetmap.org'}}
     javaScriptEnabled domStorageEnabled={false}
     javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
     allowsInlineMediaPlayback={false} mixedContentMode="never" scrollEnabled={false}
     onShouldStartLoadWithRequest={request=>{
      if(request.url==='about:blank'||request.url==='https://www.openstreetmap.org/')return true;
      if(request.url==='https://www.openstreetmap.org/copyright'){
       void Linking.openURL(request.url).catch(()=>{});return false;
      }
      return false;
     }}
     onMessage={event=>{
      if(event.nativeEvent.data==='{"kind":"map-ready"}')setTilesReady(true);
      else if(event.nativeEvent.data==='{"kind":"map-error"}')setFailure(true);
      else{
       const parsed=parseMapPointMessage(event.nativeEvent.data);
       if(parsed)setSelected(parsed);
      }
     }}
     onError={()=>setFailure(true)}
     style={{flex:1}}/>
   </View>:<Text style={styles.small}>Mapa no disponible. Revisá la conexión; no se confirmó el punto.</Text>}
  {!failure&&!tilesReady&&<Text style={styles.small}>Cargando el mapa y sus calles antes de permitir confirmar…</Text>}
  <Text style={styles.small}>Punto propuesto: {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}.
   Las teselas de OpenStreetMap se solicitan solamente al abrir este mapa; no hay rastreo continuo.</Text>
  <Action label={busy?'Comprobando dirección…':'Confirmar punto en el mapa'}
   disabled={busy||failure||!tilesReady||!isParaguayMapCoordinate(selected)}
   onPress={()=>onConfirm(selected)}/>
  <Action secondary label="Cerrar mapa sin confirmar" disabled={busy} onPress={onClose}/>
 </View>;
}
