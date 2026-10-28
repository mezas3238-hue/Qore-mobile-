import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_LOCAL_STOPS,emptyLocalRouteDraft,editLocalRouteDraft,
 reviewLocalRouteDraft,canPrepareCurrentRideContract} from './client-route-editor.mjs';

const action=(draft,type,extra={})=>editLocalRouteDraft(draft,{type,...extra});
function fill(){
 let d=emptyLocalRouteDraft();
 d=action(d,'origin',{value:'Barrio Centro'}).route;
 d=action(d,'destination',{value:'Terminal de Ómnibus'}).route;
 return d;
}
test('R35 mantiene rutas privadas en estado local congelado, sin red',()=>{
 const d=fill();
 assert.equal(d.origin,'Barrio Centro');
 assert.equal(d.destination,'Terminal de Ómnibus');
 assert.equal(Object.isFrozen(d),true);
 assert.equal(Object.isFrozen(d.stops),true);
 assert.equal(d.revision,2);
 assert.deepEqual(Object.keys(d),['origin','destination','stops','revision']);
 assert.equal('fetch' in d,false);
});
test('R35 intercambio origen/destino no altera historial, ni cambia las paradas',()=>{
 const d=fill(),withStop=action(d,'add-stop').route;
 const next=action(withStop,'stop',{index:0,value:'Plaza principal'}).route;
 const swapped=action(next,'swap').route;
 assert.equal(swapped.origin,'Terminal de Ómnibus');
 assert.equal(swapped.destination,'Barrio Centro');
 assert.deepEqual(swapped.stops,['Plaza principal']);
 assert.equal(next.origin,'Barrio Centro');
 assert.equal(d.stops.length,0);
});
test('R35 añadir, editar, subir, bajar y borrar paradas en memoria',()=>{
 let d=fill();
 d=action(d,'add-stop').route;
 d=action(d,'stop',{index:0,value:'Parada uno'}).route;
 d=action(d,'add-stop').route;
 d=action(d,'stop',{index:1,value:'Parada dos'}).route;
 assert.equal(reviewLocalRouteDraft(d).ok,true);
 d=action(d,'move-stop',{index:0,direction:1}).route;
 assert.deepEqual(d.stops,['Parada dos','Parada uno']);
 d=action(d,'move-stop',{index:1,direction:-1}).route;
 assert.deepEqual(d.stops,['Parada uno','Parada dos']);
 d=action(d,'remove-stop',{index:0}).route;
 assert.deepEqual(d.stops,['Parada dos']);
});
test('R35 ruta con paradas se puede revisar pero JAMÁS preparar bajo contrato actual',()=>{
 const d=action(fill(),'add-stop').route;
 const filled=action(d,'stop',{index:0,value:'Plaza principal'}).route;
 assert.equal(reviewLocalRouteDraft(filled).ok,true);
 assert.equal(reviewLocalRouteDraft(filled).serverPrepared,false);
 assert.equal(canPrepareCurrentRideContract(filled).code,'WAYPOINTS_NOT_SUPPORTED_BY_SERVER');
 const direct=canPrepareCurrentRideContract(fill());
 assert.equal(direct.ok,true);
 assert.deepEqual(direct.route.stops,[]);
});
test('R35 detecta puntos repetidos aun con cambios de espacios y mayúsculas',()=>{
 let d=fill();
 d=action(d,'add-stop').route;
 for(const value of [' barrio  CENTRO ','BARRIO CENTRO']){
  const next=action(d,'stop',{index:0,value}).route;
  assert.equal(reviewLocalRouteDraft(next).code,'REPEATED_ROUTE_POINT');
 }
 const same=action(fill(),'destination',{value:'barrio centro'}).route;
 assert.equal(reviewLocalRouteDraft(same).code,'REPEATED_ROUTE_POINT');
});
test('R35 rechaza paradas en blanco, bidi y controles incrustados',()=>{
 let d=action(fill(),'add-stop').route;
 assert.equal(reviewLocalRouteDraft(d).code,'INVALID_ROUTE_POINT');
 for(const value of ['ab','  ','Abc\nDen', 'Abc\u202eDef', 'x'.repeat(121)]){
  const e=action(d,'stop',{index:0,value});
  if(value.length>120)assert.equal(e.code,'INVALID_ROUTE_POINT');
  else assert.equal(reviewLocalRouteDraft(e.route).code,'INVALID_ROUTE_POINT');
 }
});
test('R35 límite por borrador protege memoria, jamás es límite total de registros',()=>{
 let d=fill();
 for(let i=0;i<MAX_LOCAL_STOPS;i++)d=action(d,'add-stop').route;
 assert.equal(d.stops.length,MAX_LOCAL_STOPS);
 assert.equal(action(d,'add-stop').code,'LOCAL_STOPS_LIMIT');
 assert.equal(d.stops.length,MAX_LOCAL_STOPS);
});
test('R35 edición invalida sin reutilizar revisión anterior y conserva inmutabilidad',()=>{
 const d=fill();
 const a=action(d,'origin',{value:'Otra dirección'});
 assert.equal(a.ok,true);
 assert.equal(a.route.revision,d.revision+1);
 assert.equal(d.origin,'Barrio Centro');
 assert.equal(a.route.origin,'Otra dirección');
 assert.notEqual(a.route,d);
});
test('R35 no acepta índices inválidos, operaciones falsas o objetos corruptos',()=>{
 const d=fill();
 for(const p of [
  {type:'stop',index:0,value:'Plaza'},
  {type:'remove-stop',index:0},
  {type:'move-stop',index:0,direction:1},
  {type:'__proto__'},
  {type:'origin',value:13},
  {type:'destination',value:'A'.repeat(121)},
 ]){
  assert.equal(editLocalRouteDraft(d,p).ok,false);
 }
 assert.equal(reviewLocalRouteDraft({origin:'x',destination:'y',stops:null,revision:1}).ok,false);
});
test('R35 no permite PREPARAR con ruta incompleta ni con paradas inválidas',()=>{
 assert.equal(canPrepareCurrentRideContract(emptyLocalRouteDraft()).ok,false);
 const d=action(fill(),'add-stop').route;
 assert.equal(canPrepareCurrentRideContract(d).code,'INVALID_ROUTE_POINT');
 assert.equal(action(d,'move-stop',{index:0,direction:-1}).ok,false);
});
