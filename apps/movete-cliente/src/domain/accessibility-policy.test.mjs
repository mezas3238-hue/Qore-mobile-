import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {A11Y_COLORS,ACTION_MIN_HEIGHT,MIN_BODY_FONT_SIZE,contrastRatio,
 meetsTextContrast} from './accessibility-policy.mjs';

test('acciones cumplen objetivo táctil y texto auxiliar legible',()=>{
 assert.equal(ACTION_MIN_HEIGHT>=48,true);
 assert.equal(MIN_BODY_FONT_SIZE>=14,true);
});

test('contraste de botones primario, secundario y deshabilitado supera WCAG AA',()=>{
 assert.equal(meetsTextContrast(A11Y_COLORS.white,A11Y_COLORS.primary),true);
 assert.equal(meetsTextContrast(A11Y_COLORS.primary,A11Y_COLORS.secondary),true);
 assert.equal(meetsTextContrast(A11Y_COLORS.disabledInk,A11Y_COLORS.disabled),true);
 assert.equal(contrastRatio('#FFFFFF','#FFFFFF'),1);
 assert.equal(contrastRatio('invalid','#FFFFFF'),null);
});

test('ninguna pantalla desactiva escalado de fuente del sistema',()=>{
 const appDir=new URL('../../app/',import.meta.url);
 for(const file of readdirSync(appDir).filter(name=>name.endsWith('.tsx'))){
  const source=readFileSync(join(appDir.pathname,file),'utf8');
  assert.equal(source.includes('allowFontScaling={false}'),false,file);
  assert.equal(source.includes('maxFontSizeMultiplier={1}'),false,file);
 }
});

test('todos los TextInput visibles tienen etiqueta para lector de pantalla',()=>{
 const appDir=new URL('../../app/',import.meta.url);
 for(const file of readdirSync(appDir).filter(name=>name.endsWith('.tsx'))){
  const source=readFileSync(join(appDir.pathname,file),'utf8');
  for(const tag of source.match(/<TextInput[\s\S]*?\/>/g)??[])
   assert.equal(tag.includes('accessibilityLabel='),true,file+' '+tag.slice(0,60));
 }
});

test('todas las pantallas con hero exponen encabezado semántico',()=>{
 const appDir=new URL('../../app/',import.meta.url);
 for(const file of readdirSync(appDir).filter(name=>name.endsWith('.tsx'))){
  const source=readFileSync(join(appDir.pathname,file),'utf8');
  if(!source.includes('styles.heroText'))continue;
  const hero=source.match(/<Text[^>]*styles\.heroText[^>]*>/)?.[0]??'';
  assert.equal(hero.includes('accessibilityRole="header"'),true,file);
 }
});

test('formularios desplazables conservan taps y permiten cerrar teclado al arrastrar',()=>{
 const appDir=new URL('../../app/',import.meta.url);
 for(const file of readdirSync(appDir).filter(name=>name.endsWith('.tsx'))){
  const source=readFileSync(join(appDir.pathname,file),'utf8');
  for(const tag of source.match(/<ScrollView[\s\S]*?>/g)??[]){
   assert.equal(tag.includes('keyboardShouldPersistTaps="handled"'),true,file);
   assert.equal(tag.includes('keyboardDismissMode="on-drag"'),true,file);
  }
 }
});

test('superficies desplazables respetan automáticamente las áreas seguras',()=>{
 const appDir=new URL('../../app/',import.meta.url);
 for(const file of readdirSync(appDir).filter(name=>name.endsWith('.tsx'))){
  const source=readFileSync(join(appDir.pathname,file),'utf8');
  for(const tag of source.match(/<(?:ScrollView|FlatList)[\s\S]*?>/g)??[])
   assert.equal(tag.includes('contentInsetAdjustmentBehavior="automatic"'),true,file);
 }
});

test('acción compartida expone estado, foco y área táctil al sistema',()=>{
 const source=readFileSync(new URL('../ClientUI.tsx',import.meta.url),'utf8');
 assert.match(source,/accessibilityRole="button"/);
 assert.match(source,/accessibilityState=\{\{disabled:blocked,selected,busy\}\}/);
 assert.match(source,/\sfocusable\s/);
 assert.match(source,/minHeight:ACTION_MIN_HEIGHT/);
});
