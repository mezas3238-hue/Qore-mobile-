import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOwnerCargoPercent as parse,displayOwnerCargoPercent as show}
 from './owner-cargo-percent.mjs';
test('Owner cargo commission 15% in Admin writes exactly 1500 basis points',()=>{
 assert.equal(parse('15'),1500);
 assert.equal(parse('12.50'),1250);
 assert.equal(parse('0'),0);
 assert.equal(parse('0.01'),1);
 assert.equal(parse('30.00'),3000);
});
test('Cargo policy receipt 1300 bps displays 13%, not 1300%',()=>{
 assert.equal(show(1300),'13');
 assert.equal(show(950),'9.5');
 assert.equal(show(1200),'12');
 assert.equal(show(-1),null);
});
test('Admin never accepts out-of-range, fractional bps or unsafe formats',()=>{
 for(const s of ['','-1','30.01','35','12.345','15,5','1e2',' 15',
  '15 ','Infinity','NaN','00015','0x10','100']){
  assert.equal(parse(s),null,s);
 }
});
test('Commission is reversible for every Owner-permitted basis point',()=>{
 for(let bps=0;bps<=3000;bps++){
  assert.equal(parse(show(bps)),bps);
 }
});
