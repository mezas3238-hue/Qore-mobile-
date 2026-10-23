import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSupportDraft,SUPPORT_TYPES} from './support-draft.mjs';
const good={category:'DELIVERY',serviceId:'',description:'El paquete ficticio llegó con atraso'};
test('catálogo soporte cubre seguridad, viaje, envío, pago y otros',()=>{
 assert.deepEqual(SUPPORT_TYPES.map(x=>x.code).sort(),['SAFETY','RIDE','DELIVERY','PAYMENT','OTHER'].sort());
});
test('borrador local no se envía ni confirma asistencia',()=>{
 const r=validateSupportDraft(good);
 assert.equal(r.ok,true);assert.equal(r.localOnly,true);assert.equal(r.submitted,false);
});
test('categoría, servicio y longitud inválidos se rechazan',()=>{
 assert.equal(validateSupportDraft({...good,category:'SOS_SENT'}).ok,false);
 assert.equal(validateSupportDraft({...good,serviceId:'otro'}).ok,false);
 assert.equal(validateSupportDraft({...good,description:'corto'}).ok,false);
});
test('PII evidente se rechaza en el texto de prueba',()=>{
 assert.equal(validateSupportDraft({...good,description:'Responder a persona@example.com'}).ok,false);
 assert.equal(validateSupportDraft({...good,description:'Llamar al +595 981 123 456 por favor'}).ok,false);
});
