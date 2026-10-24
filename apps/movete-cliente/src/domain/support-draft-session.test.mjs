import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupportDraftSession} from './support-draft-session.mjs';
test('nunca envía reportes ni crea recibos o casos',()=>{
 const s=createSupportDraftSession();
 s.setDescription('El paquete ficticio llegó con atraso');
 const result=s.validate();
 assert.match(result.feedback,/NO enviado/);
 assert.equal(result.submitted,false);
 assert.equal(result.localOnly,true);
 assert.equal('caseId' in result,false);
 assert.equal('receipt' in result,false);
});
test('editar categoría, ID o descripción borra validación obsoleta',()=>{
 const s=createSupportDraftSession();
 s.validate();assert.notEqual(s.snapshot().feedback,'');
 s.setCategory('DELIVERY');assert.equal(s.snapshot().feedback,'');
 s.validate();s.setServiceId('');assert.equal(s.snapshot().feedback,'');
 s.validate();s.setDescription('Prueba de reporte exclusivamente local');
 assert.equal(s.snapshot().feedback,'');
});
test('limpieza manual borra el contenido y la selección',()=>{
 const s=createSupportDraftSession();
 s.setCategory('PAYMENT');s.setDescription('Borrador local de soporte para revisar');
 s.validate();const cleared=s.clear();
 assert.equal(cleared.category,'SAFETY');assert.equal(cleared.description,'');
 assert.equal(cleared.serviceId,'');assert.equal(cleared.feedback,'');
});
test('salir de sesión destruye el texto y bloquea callbacks tardíos',()=>{
 const s=createSupportDraftSession();
 s.setDescription('No quiero conservar esto tras cerrar sesión');
 s.dispose();s.setDescription('Esta escritura ya no debe persistir');s.validate();
 assert.equal(s.snapshot().description,'');assert.equal(s.snapshot().feedback,'');
 assert.equal(createSupportDraftSession().snapshot().description,'');
});
test('cada controlador es aislado del anterior',()=>{
 const a=createSupportDraftSession(),b=createSupportDraftSession();
 a.setDescription('El reporte de la sesión anterior jamás se comparte');
 assert.equal(b.snapshot().description,'');
 a.dispose();assert.equal(b.snapshot().description,'');
});
