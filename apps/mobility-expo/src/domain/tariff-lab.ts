/**
 * QORE Mobility tariff laboratory — NO LIVE, no customer quote.
 * Inputs are PRE-APPROVED hypothetical policy numbers, never real competitor fares.
 * Actual route dimensions must eventually originate from a trusted server provider.
 * Guaranies and basis points are represented as integers; no floating prices.
 */
export type TariffService = 'economico'|'confort'|'xl'|'moto_pasajero';
export interface TariffScenario {
 readonly scenarioId:string;
 readonly service:TariffService;
 readonly baseGs:number;
 readonly minimumGs:number;
 readonly perKmGs:number;
 readonly perMinuteGs:number;
 readonly commissionBps:number;
 readonly roundingStepGs:number;
}
export interface TariffRouteScenario {
 readonly distanceMeters:number;
 readonly travelSeconds:number;
 readonly providerLabel:'hypothetical'|'trusted-provider-unverified';
}
export type TariffResult =
 |{readonly ok:false;readonly reason:string;readonly commercialRidesEnabled:false}
 |{readonly ok:true;
   readonly status:'RESEARCH_ONLY';
   readonly commercialRidesEnabled:false;
   readonly passengerFareGs:number;
   readonly platformFeeGs:number;
   readonly driverGrossBeforeCostsGs:number;
   readonly excludedCosts:readonly string[];
   readonly scenarioId:string;
   readonly service:TariffService;
 };

const MAX_COMPONENT_GS=10000000;
const notValid=(reason:string):TariffResult=>({ok:false,reason,commercialRidesEnabled:false});
const properInt=(n:number,min:number,max:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const ROUND_TO=1000n;
const ceilDiv=(a:bigint,b:bigint)=>(a+b-1n)/b;
const roundUp=(n:bigint,step:bigint)=>ceilDiv(n,step)*step;

export function simulateTariff(s:TariffScenario,r:TariffRouteScenario):TariffResult {
 if(!s||!r)return notValid('Parámetros ausentes');
 if(!/^[A-Za-z0-9_-]{4,80}$/.test(s.scenarioId??''))
  return notValid('Identificador de escenario inválido');
 if(!['economico','confort','xl','moto_pasajero'].includes(s.service))
  return notValid('Servicio inválido');
 for(const n of [s.baseGs,s.minimumGs,s.perKmGs,s.perMinuteGs]){
  if(!properInt(n,0,MAX_COMPONENT_GS))return notValid('Componente de tarifa inválido');
 }
 if(!properInt(s.minimumGs,1,MAX_COMPONENT_GS)||
    !properInt(s.commissionBps,0,5000)||
    !properInt(s.roundingStepGs,1,10000)||
    s.roundingStepGs%100!==0)
  return notValid('Regla de mínimo, redondeo o comisión inválida');
 if(!properInt(r.distanceMeters,1,400000)||
    !properInt(r.travelSeconds,1,43200)||
    !['hypothetical','trusted-provider-unverified'].includes(r.providerLabel))
  return notValid('Ruta no validada para simulación');
 const partial=BigInt(s.baseGs)
   +ceilDiv(BigInt(s.perKmGs)*BigInt(r.distanceMeters),ROUND_TO)
   +ceilDiv(BigInt(s.perMinuteGs)*BigInt(r.travelSeconds),60n);
 const gross=roundUp(partial>BigInt(s.minimumGs)?partial:BigInt(s.minimumGs),BigInt(s.roundingStepGs));
 // 25m Gs total cap for test safety, not a market price statement.
 if(gross>25000000n)return notValid('Escenario supera límites de investigación');
 const fee=gross*BigInt(s.commissionBps)/10000n;
 const driver=gross-fee;
 return Object.freeze({
  ok:true,status:'RESEARCH_ONLY',commercialRidesEnabled:false,
  scenarioId:s.scenarioId,service:s.service,
  passengerFareGs:Number(gross),
  platformFeeGs:Number(fee),
  driverGrossBeforeCostsGs:Number(driver),
  excludedCosts:['combustible','mantenimiento','impuestos','seguros','comisiones de pago'],
 });
}
