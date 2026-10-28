/**
 * R51: screen-reader summaries only from a currently verified commerce page.
 * Strings are intentionally non-identifying: never announce UUIDs, addresses,
 * merchant/customer PII, availability promises or global totals.
 */
const ITEM_KEYS=['itemId','itemTag','itemClass','active','unitPricePyg','stockUnits'];
const TAG=/^[A-Z0-9_]{2,50}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>isObj(x)&&Object.keys(x).length===keys.length
 &&keys.every(key=>Object.hasOwn(x,key));
const numeric=x=>Number.isSafeInteger(x)&&x>=0;
const pyg=n=>n.toLocaleString('es-PY')+' guaraníes';
const label=s=>s.replaceAll('_',' ').toLocaleLowerCase('es-PY');
/**
 * The receiver must set verified only after branch/session/TTL checks.
 * A text copy can describe a local basket, not claim any stock reservation.
 */
export function projectCommerceItemAccessible(item,{verified=false,quantity=0}={}){
 if(verified!==true)return fail('PAGE_NOT_VERIFIED');
 if(!exact(item,ITEM_KEYS)||!UUID.test(item.itemId)
  ||typeof item.itemTag!=='string'||!TAG.test(item.itemTag)
  ||!['GENERAL','PHARMACY_OTC'].includes(item.itemClass)
  ||item.active!==true||!numeric(item.unitPricePyg)
  ||item.unitPricePyg<100||item.unitPricePyg>10000000
  ||!numeric(item.stockUnits)||item.stockUnits>1000000
  ||!numeric(quantity)||quantity>999||quantity>item.stockUnits)
  return fail('INVALID_ITEM_OR_QUANTITY');
 const name=label(item.itemTag);
 const short='En carrito: '+quantity+'. Stock informado: '+item.stockUnits+'.';
 return Object.freeze({ok:true,
  description:name+'. '+pyg(item.unitPricePyg)+' por unidad. '
   +short+' No es una reserva ni un pedido.',
  addHint:quantity>=item.stockUnits||quantity>=999
   ?'No se puede agregar más de este producto.'
   :'Agregar una unidad. '+short+' No confirma compra.',
  removeHint:quantity===0
   ?'No hay unidades para quitar.'
   :'Quitar una unidad. '+short+' No confirma compra.',
  noOrderConfirmed:true,stockReserved:false});
}

/**
 * Announces only filtered rows in the current verified page. Empty search
 * results NEVER imply zero stock or zero businesses in the whole city.
 */
export function projectCommercePageAccessible({verified=false,loading=false,
 pageNumber=1,visibleCount=0,kind='CATALOG'}={}){
 if(loading===true||verified!==true)return fail('PAGE_NOT_VERIFIED');
 if(!Number.isSafeInteger(pageNumber)||pageNumber<1
  ||!numeric(visibleCount)||visibleCount>100
  ||!['CATALOG','BRANCHES'].includes(kind))
  return fail('INVALID_PAGE');
 const noun=kind==='BRANCHES'?'sucursales':'productos';
 return Object.freeze({ok:true,
  summary:'Página '+pageNumber+': '+visibleCount+' '+noun
   +' coincidentes solo en esta página.'
   +(visibleCount===0?' Podés revisar otras páginas.':'')
   +' No representa el total de la plataforma.',
  scope:'CURRENT_VERIFIED_PAGE_ONLY',globalTotalKnown:false,
  availabilityVerified:false,orderConfirmed:false});
}
