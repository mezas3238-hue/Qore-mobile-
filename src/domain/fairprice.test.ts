import test from 'node:test';
import assert from 'node:assert/strict';
import{LAB_POLICY,REFERENCE_ROUTES,quoteLab,compareLab}from'./fairprice.ts';
test('reparto exacto, pisos para auto y moto, múltiples rutas',()=>{
 for(const r of REFERENCE_ROUTES)for(const vehicle of ['auto','moto']as const){
 const q=quoteLab({vehicle,km:r.km,min:r.min});
 assert.equal(q.fareGs%500,0);assert.equal(q.driverGs+q.commissionGs,q.fareGs);
 assert.ok(q.platformContributionGs>=0);assert.ok(q.driverGs>=q.driverFloorGs-1);
 assert.equal(q.label,'INVESTIGACION_NO_PRECIO_REAL');
 }
});
test('moto corta puede ser más cara que Bolt si el piso de QORE obliga',()=>{
 const r=REFERENCE_ROUTES[0],c=compareLab({vehicle:'moto',km:r.km,min:r.min},r.boltMotoGs);
 assert.equal(c.result.fareGs,8000);assert.ok(c.passengerDifferencePct>0);assert.equal(c.referenceLive,false);
});
test('recogida más lejana requiere precio mayor; sin prometer viajes',()=>{
 const small=quoteLab({vehicle:'auto',km:8.3,min:19});
 const big=quoteLab({vehicle:'auto',km:8.3,min:19,pickupKm:20,pickupMin:50});
 assert.ok(big.fareGs>small.fareGs);assert.ok(big.platformContributionGs>=0);
});
test('moto 8% sólo experimentación, el piso puede anular descuento',()=>{
 const a=quoteLab({vehicle:'moto',km:2.8,min:9});
 const b=quoteLab({vehicle:'moto',km:2.8,min:9,experimentalCommissionBps:800});
 assert.equal(LAB_POLICY.moto.commissionBps,1000);
 assert.equal(b.commissionPct,8);assert.ok(b.fareGs>=a.fareGs);
});
test('fail closed para distancia, tiempo, comisión e inputs inválidos',()=>{
 const a={vehicle:'auto' as const,km:8.3,min:19};
 assert.throws(()=>quoteLab({...a,km:0}));
 assert.throws(()=>quoteLab({...a,pickupKm:Infinity}));
 assert.throws(()=>quoteLab({...a,min:NaN}));
 assert.throws(()=>quoteLab({...a,experimentalCommissionBps:200}));
 assert.throws(()=>quoteLab({...a,experimentalCommissionBps:1000.5}));
 assert.throws(()=>compareLab(a,0));
});
test('cálculo puro y determinista',()=>{
 const x={vehicle:'auto' as const,km:12.3,min:26};
 assert.deepEqual(quoteLab(x),quoteLab(x));
});
