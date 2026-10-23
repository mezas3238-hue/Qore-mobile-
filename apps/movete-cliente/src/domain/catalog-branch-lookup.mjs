/**
 * Selector temporal de sucursal para entorno certificado.
 * No descubre negocios ni convierte texto libre en una búsqueda con PII.
 * La lista pública de sucursales requiere un contrato propio de Backend A.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function prepareCatalogBranchLookup(input){
 if(typeof input!=='string'||input.length!==36||!UUID.test(input))
  return Object.freeze({ok:false,code:'INVALID_BRANCH'});
 return Object.freeze({ok:true,branchId:input.toLowerCase(),noNetwork:true});
}
