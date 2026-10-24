/** QORE FAIRPRICE LAB: INVESTIGACION PURA; NO VIAJES REALES NI TARIFAS APROBADAS. */
export type VehicleType='auto'|'moto';
export type RouteObservation={id:string;label:string;km:number;min:number;boltAutoGs:number;boltMotoGs:number;url:string};
export const REFERENCE_ROUTES:readonly RouteObservation[]=[
{id:'sol',label:'Shopping del Sol → Shopping Mariscal',km:2.8,min:9,boltAutoGs:11511,boltMotoGs:7704,url:'https://bolt.eu/es-py/cities/asuncion/route/shopping-del-sol-to-shopping-mariscal/'},
{id:'multiplaza',label:'Multiplaza → Shopping Mariscal',km:3.6,min:11,boltAutoGs:13455,boltMotoGs:8768,url:'https://bolt.eu/es-py/cities/asuncion/route/shopping-multiplaza-to-shopping-mariscal/'},
{id:'obrero',label:'Barrio Obrero → Shopping Mariscal',km:8.3,min:19,boltAutoGs:25682,boltMotoGs:15456,url:'https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-shopping-mariscal/'},
{id:'villa',label:'Barrio Obrero → Villa Elisa',km:12.3,min:26,boltAutoGs:35901,boltMotoGs:21045,url:'https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-hospital-general-de-villa-elisa/'},
{id:'sanlo',label:'Barrio Obrero → San Lorenzo',km:17.9,min:36,boltAutoGs:50452,boltMotoGs:29005,url:'https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-hospital-general-san-lorenzo/'},
{id:'airport',label:'Barrio Obrero → Aeropuerto ASU',km:18.3,min:37,boltAutoGs:51579,boltMotoGs:29621,url:'https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-asuncion-silvio-pettirossi-airport-asu/'},
{id:'capiata',label:'Barrio Obrero → Capiatá',km:25.3,min:50,boltAutoGs:69609,boltMotoGs:39483,url:'https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-el-ahorrazo-suc-capiata/'}
];
/** Todas las cifras siguientes son HIPOTESIS de escenario, no cotizaciones verificadas de proveedores. */
export const LAB_POLICY={
auto:{base:3400,kmRate:1940,minRate:270,minFare:11000,commissionBps:1000,pickupKm:2,pickupMin:6,emptyKm:0.5,idleMin:5,vehicleCostKm:900,targetHourGs:15000,platformVariableGs:850},
moto:{base:2000,kmRate:950,minRate:260,minFare:7500,commissionBps:1000,pickupKm:1.5,pickupMin:5,emptyKm:0.5,idleMin:5,vehicleCostKm:380,targetHourGs:11000,platformVariableGs:650}
} as const;
/** Mezcla digital 60% y costo de procesamiento 2.8% del volumen digital, asumidos. */
const DIGITAL_SHARE=0.6, PROCESSOR_RATE=0.028;
export type LabInput={vehicle:VehicleType;km:number;min:number;pickupKm?:number;pickupMin?:number;experimentalCommissionBps?:number};
export type LabQuote={
label:'INVESTIGACION_NO_PRECIO_REAL';fareGs:number;driverGs:number;commissionGs:number;
platformContributionGs:number;vehicleCostGs:number;driverAfterVehicleCostGs:number;driverHourGs:number;
commissionPct:number;formulaGs:number;driverFloorGs:number;platformFloorGs:number;pickupKm:number;pickupMin:number;
};
export function quoteLab(input:LabInput):LabQuote{
 const {vehicle,km,min}=input;
 if(vehicle!=='auto'&&vehicle!=='moto')throw Error('Tipo no admitido');
 const p=LAB_POLICY[vehicle];
 const pickupKm=input.pickupKm??p.pickupKm,pickupMin=input.pickupMin??p.pickupMin;
 const bps=input.experimentalCommissionBps??p.commissionBps;
 if([km,min,pickupKm,pickupMin,bps].some(x=>!Number.isFinite(x)))throw Error('Entrada inválida');
 if(km<=0||km>150||min<=0||min>360||pickupKm<0||pickupKm>50||pickupMin<0||pickupMin>120||
    !Number.isInteger(bps)||bps<800||bps>3000)throw Error('Fuera de rango');
 const c=bps/10000,feeRate=DIGITAL_SHARE*PROCESSOR_RATE;
 const formula=p.base+km*p.kmRate+min*p.minRate;
 const cost=(km+pickupKm+p.emptyKm)*p.vehicleCostKm;
 const operatingTime=min+pickupMin+p.idleMin;
 const minimumDriverGross=cost+operatingTime*p.targetHourGs/60;
 const driverFloor=minimumDriverGross/(1-c);
 const platformFloor=p.platformVariableGs/(c-feeRate);
 const fare=Math.ceil(Math.max(p.minFare,formula,driverFloor,platformFloor)/500)*500;
 const commissionGs=Math.round(fare*c),driverGs=fare-commissionGs;
 const platformContributionGs=Math.round(commissionGs-feeRate*fare-p.platformVariableGs);
 if(driverGs<minimumDriverGross-0.5||platformContributionGs<0)throw Error('Falla piso financiero');
 return{label:'INVESTIGACION_NO_PRECIO_REAL',fareGs:fare,driverGs,commissionGs,platformContributionGs,
 vehicleCostGs:Math.round(cost),driverAfterVehicleCostGs:Math.round(driverGs-cost),
 driverHourGs:Math.round((driverGs-cost)*60/operatingTime),commissionPct:bps/100,
 formulaGs:Math.round(formula),driverFloorGs:Math.ceil(driverFloor),platformFloorGs:Math.ceil(platformFloor),pickupKm,pickupMin};
}
export function compareLab(input:LabInput,referenceGs:number){
 if(!Number.isFinite(referenceGs)||referenceGs<=0)throw Error('Referencia inválida');
 const result=quoteLab(input);
 const expectedBoltDriver=Math.round(referenceGs*(input.vehicle==='auto'?0.77:0.8));
 return{result,referenceGs,referenceLive:false as const,driverDifferenceGs:result.driverGs-expectedBoltDriver,
 passengerDifferencePct:Math.round((result.fareGs/referenceGs-1)*1000)/10};
}
