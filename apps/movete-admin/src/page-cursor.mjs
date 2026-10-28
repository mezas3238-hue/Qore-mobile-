/**
 * Paginación por cursor de servidor, sin límite global de registros.
 * La página visible se sustituye en vez de retener expedientes personales.
 * 100 elementos por respuesta NO significa 100 conductores en la plataforma.
 */
const CURSOR=/^[A-Za-z0-9_-]{1,256}$/;
export const isValidCursor=value=>typeof value==='string'&&CURSOR.test(value);
export function readContinuation(raw){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))return {ok:false};
 if(!Object.hasOwn(raw,'nextCursor')||raw.nextCursor===null)
  return {ok:true,nextCursor:null};
 return isValidCursor(raw.nextCursor)
  ?{ok:true,nextCursor:raw.nextCursor}:{ok:false};
}
export function createPageNavigator(){
 const states=new Map();
 const initial=()=>({currentCursor:null,nextCursor:null,history:[],pageNumber:1});
 const state=operation=>states.get(operation)??initial();
 const get=operation=>{
  const x=state(operation);
  return Object.freeze({
   pageNumber:x.pageNumber,hasNext:x.nextCursor!==null,
   hasPrevious:x.history.length>0,nextCursor:x.nextCursor
  });
 };
 function request(operation,direction='refresh'){
  const s=state(operation);
  if(direction==='reset')return {ok:true,cursor:null,direction};
  if(direction==='refresh')return {ok:true,cursor:s.currentCursor,direction};
  if(direction==='next'&&s.nextCursor!==null)return {ok:true,cursor:s.nextCursor,direction};
  if(direction==='previous'&&s.history.length)return {
   ok:true,cursor:s.history[s.history.length-1],direction
  };
  return {ok:false,code:'NO_ADDITIONAL_PAGE'};
 }
 function commit(operation,direction,cursor,nextCursor){
  if(nextCursor!==null&&!isValidCursor(nextCursor))return false;
  const s=state(operation);
  let history=[...s.history],pageNumber=s.pageNumber;
  if(direction==='next'){
   if(s.nextCursor===null||cursor!==s.nextCursor)return false;
   history.push(s.currentCursor);pageNumber++;
  }else if(direction==='previous'){
   if(!history.length||cursor!==history[history.length-1])return false;
   history.pop();pageNumber--;
  }else if(direction==='refresh'){
   if(cursor!==s.currentCursor)return false;
  }else if(direction==='reset'){
   if(cursor!==null)return false;
   history=[];pageNumber=1;
  }else return false;
  // Servidor con cursor circular: jamás volver a pedir la misma página.
  if(nextCursor!==null&&(nextCursor===cursor||history.includes(nextCursor)))return false;
  states.set(operation,{currentCursor:cursor,nextCursor,history,pageNumber});
  return true;
 }
 const clear=operation=>{
  if(typeof operation==='string')states.delete(operation);
  else states.clear();
 };
 return Object.freeze({get,request,commit,clear});
}
