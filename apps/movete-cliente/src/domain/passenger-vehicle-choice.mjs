/** Passenger-only vehicle selector. Does not book, quote or infer availability. */
export const PASSENGER_VEHICLE_KINDS=Object.freeze(['AUTO','MOTO']);
const OPTIONS=Object.freeze({
 AUTO:Object.freeze({kind:'AUTO',route:'/viaje',label:'AUTO · Automóvil',
  commissionBps:1500,customerSubsidyBps:1000,platformRetainsBps:500,
  serviceKind:'AUTO_RIDE'}),
 MOTO:Object.freeze({kind:'MOTO',route:'/moto',label:'MOTO · Motocicleta',
  commissionBps:1200,customerSubsidyBps:1000,platformRetainsBps:200,
  serviceKind:'MOTO_RIDE'})
});
export function selectPassengerVehicle(kind){
 if(kind!=='AUTO'&&kind!=='MOTO')
  return Object.freeze({ok:false,reason:'VEHICLE_SELECTION_REQUIRED'});
 return Object.freeze({ok:true,...OPTIONS[kind]});
}
