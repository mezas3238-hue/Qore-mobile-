/**
 * R37 Comercio: navegación/filtrado de presentación para datos certificados.
 * No inventa comercios, precios, stock, descuentos, tiempos ni pedidos.
 * Ningún filtro local indica disponibilidad general de una zona.
 */
export const COMMERCE_VERTICALS=Object.freeze([
 Object.freeze({code:'SUPERMARKET',label:'Supermercados',description:'Alimentos, limpieza y compras del hogar'}),
 Object.freeze({code:'PHARMACY',label:'Farmacias',description:'Solo productos permitidos sin receta'}),
 Object.freeze({code:'RESTAURANT',label:'Restaurantes',description:'Comidas y bebidas de comercios habilitados'}),
 Object.freeze({code:'RETAIL',label:'Tiendas',description:'Artículos generales y comercios locales'}),
 Object.freeze({code:'OTHER',label:'Otros',description:'Servicios comerciales autorizados por zona'})
]);
const KINDS=new Set(COMMERCE_VERTICALS.map(v=>v.code));
const fail=code=>Object.freeze({ok:false,code,items:Object.freeze([])});
const safeSearch=s=>typeof s==='string'&&s.length<=64
 &&!/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/u.test(s);
const fold=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
 .replace(/[_\s]+/gu,' ').trim().toLocaleLowerCase('es');
export function validateCommerceSearch(raw){
 if(!safeSearch(raw))return Object.freeze({ok:false,code:'INVALID_SEARCH'});
 return Object.freeze({ok:true,query:raw.trim(),normalized:fold(raw)});
}
export function selectCommerceVertical(code){
 return KINDS.has(code)?COMMERCE_VERTICALS.find(v=>v.code===code):null;
}
export function filterVerifiedCatalogPage(items,{query='',verified=false}={}){
 if(verified!==true)return fail('CATALOG_NOT_VERIFIED');
 if(!Array.isArray(items)||items.length>1000)return fail('INVALID_CATALOG_PAGE');
 const searched=validateCommerceSearch(query);
 if(!searched.ok)return fail('INVALID_SEARCH');
 const result=[];
 for(const item of items){
  if(!item||typeof item!=='object'||Array.isArray(item)
   ||typeof item.itemTag!=='string'
   ||item.itemTag.length<1||item.itemTag.length>120
   ||item.active!==true||!Number.isSafeInteger(item.stockUnits)
   ||item.stockUnits<0||!Number.isSafeInteger(item.unitPricePyg)
   ||item.unitPricePyg<0)
   return fail('INVALID_CATALOG_PAGE');
  if(searched.normalized===''||fold(item.itemTag).includes(searched.normalized))
   result.push(item);
 }
 return Object.freeze({ok:true,items:Object.freeze(result),
  scope:'CURRENT_VERIFIED_PAGE_ONLY',globalTotalKnown:false,
  checkoutEnabled:false});
}
export function filterVerifiedBranchPage(items,{vertical,verified=false}={}){
 if(verified!==true)return fail('BRANCH_PAGE_NOT_VERIFIED');
 if(!selectCommerceVertical(vertical))return fail('INVALID_VERTICAL');
 if(!Array.isArray(items)||items.length>100)return fail('INVALID_BRANCH_PAGE');
 const result=[];
 for(const item of items){
  if(!item||typeof item!=='object'||Array.isArray(item)
   ||typeof item.merchantKind!=='string'||!KINDS.has(item.merchantKind)
   ||typeof item.branchId!=='string'||typeof item.branchTag!=='string'
   ||item.eligibleByPolicy!==false||item.orderEnabled!==false)
   return fail('INVALID_BRANCH_PAGE');
  if(item.merchantKind===vertical)result.push(item);
 }
 return Object.freeze({ok:true,items:Object.freeze(result),
  scope:'CURRENT_VERIFIED_PAGE_ONLY',globalTotalKnown:false,
  ordersEnabled:false});
}
