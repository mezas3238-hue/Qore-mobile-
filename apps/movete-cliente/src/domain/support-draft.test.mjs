import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSupportDraft,SUPPORT_TYPES,containsSensitiveSupportText} from './support-draft.mjs';
const good={category:'DELIVERY',serviceId:'',description:'El paquete ficticio llegó con atraso'};
test('categorías de soporte cubren seguridad, viaje, envío, consulta de pago y otros',()=>{
 assert.deepEqual(SUPPORT_TYPES.map(x=>x.code).sort(),['SAFETY','RIDE','DELIVERY','PAYMENT','OTHER'].sort());
});
test('un borrador local nunca confirma envío o asistencia',()=>{
 const r=validateSupportDraft(good);
 assert.equal(r.ok,true);assert.equal(r.localOnly,true);assert.equal(r.submitted,false);
 assert.equal('receipt' in r,false);assert.equal('caseId' in r,false);
});
test('categoría, servicio y longitud inválidos se rechazan',()=>{
 assert.equal(validateSupportDraft({...good,category:'SOS_SENT'}).ok,false);
 assert.equal(validateSupportDraft({...good,serviceId:'otro'}).ok,false);
 assert.equal(validateSupportDraft({...good,description:'corto'}).ok,false);
});
test('filtra PII, URLs, coordenadas, PAN y secretos comunes',()=>{
 for(const description of [
  'Responder a persona@example.com',
  'Llamar al +595 981 123 456 por favor',
  'Llamar al 0981123456 inmediatamente',
  'Adjunté https://ejemplo.com/documento-privado',
  'Documento CI 5.123.456 por favor',
  'Tarjeta 4111 1111 1111 1111 por favor',
  'La ubicación es -25.30021, -57.63213',
  'Mi contraseña: secreta123'
 ]){
  assert.equal(containsSensitiveSupportText(description),true,description);
  assert.equal(validateSupportDraft({...good,description}).ok,false,description);
 }
});
test('texto descriptivo sin datos privados se permite',()=>{
 assert.equal(validateSupportDraft({...good,description:'El conductor tardó más de lo esperado'}).ok,true);
});
