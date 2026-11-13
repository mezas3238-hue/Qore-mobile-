/** Expo SDK57 share receiving. No personal location in navigation URLs. */
export function redirectSystemPath({path}:{path:string;initial:boolean}):string{
 try{
  const url=new URL(path);
  if(url.hostname==='expo-sharing')return '/recibir-ubicacion';
  return path;
 }catch{return '/';}
}
