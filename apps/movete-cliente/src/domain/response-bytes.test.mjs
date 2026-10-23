import test from 'node:test';
import assert from 'node:assert/strict';
import {utf8ByteLength} from './response-bytes.mjs';
test('conteo puro coincide con UTF-8 para ASCII, acentos, emojis y surrogate solitario',()=>{
 for(const sample of [
  '', 'abc', 'Asunción, Paraguay', 'á'.repeat(600),
  '🚕 Movete Fácil 🛵', '\ud800', '\udc00', 'a\ud800b', 'a\udc00b'
 ])assert.equal(utf8ByteLength(sample),Buffer.byteLength(sample,'utf8'),sample);
});
test('payload no cadena no se acepta como texto de respuesta',()=>{
 for(const x of [null,123,{},[],undefined])assert.equal(utf8ByteLength(x),null);
});
