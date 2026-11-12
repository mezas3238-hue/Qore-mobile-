/**
 * G324: Untrusted map-UI messages are coordinates only, never booking authority.
 * Bounds are a coarse preliminary filter; reverse geocoding must confirm PY.
 */
export function isParaguayMapCoordinate(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Number.isFinite(value.latitude)&&Number.isFinite(value.longitude)&&
  value.latitude>=-27.8&&value.latitude<=-19.2&&
  value.longitude>=-62.9&&value.longitude<=-54.1;
}
export function parseMapPointMessage(message){
 if(typeof message!=='string'||message.length>240)return null;
 let data;
 try{data=JSON.parse(message);}catch{return null;}
 if(!data||typeof data!=='object'||Array.isArray(data)||
  Object.keys(data).length!==3||data.kind!=='map-point'||
  !isParaguayMapCoordinate(data))return null;
 return Object.freeze({latitude:data.latitude,longitude:data.longitude});
}
export function sameMapCoordinate(a,b){
 return isParaguayMapCoordinate(a)&&isParaguayMapCoordinate(b)&&
  Math.abs(a.latitude-b.latitude)<0.000001&&
  Math.abs(a.longitude-b.longitude)<0.000001;
}
