/** Trusted-server delivery candidate ranking and private-offer persistence. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['AUTO','MOTO']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&UUID.test(value);
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const coordinate=value=>object(value)&&Number.isFinite(value.lat)&&value.lat>=-90&&value.lat<=90&&
 Number.isFinite(value.lng)&&value.lng>=-180&&value.lng<=180;
const failure=reason=>Object.freeze({ok:false,reason,liveEnabled:false});

function candidateValid(candidate,kind,nowMs){
 return object(candidate)&&id(candidate.courierId)&&id(candidate.vehicleId)&&
  candidate.vehicleKind===kind&&object(candidate.location)&&coordinate(candidate.location)&&
  candidate.location.consentGranted===true&&candidate.location.available===true&&
  integer(candidate.location.capturedAtMs,0,nowMs+10_000)&&
  nowMs-candidate.location.capturedAtMs<=30_000&&
  Number.isFinite(candidate.location.accuracyMeters)&&
  candidate.location.accuracyMeters>=0&&candidate.location.accuracyMeters<=75&&
  integer(candidate.idleSeconds,0,86_400);
}
function routeValid(route,courierId,nowMs){
 return object(route)&&route.courierId===courierId&&
  route.provider==='VERIFIED_ROAD_ROUTER'&&route.trafficAware===true&&
  route.fallbackUsed===false&&integer(route.calculatedAtMs,0,nowMs)&&
  nowMs-route.calculatedAtMs<=20_000&&integer(route.roadMeters,0,250_000)&&
  integer(route.etaSeconds,0,21_600);
}

export async function dispatchPrivateDeliveryOffers({
 deliveryId,vehicleKind,pickup,nowMs,candidates,checkEligibility,
 calculateRoutes,createOffer,issueRequestKey,maxOffers=5,ttlSeconds=30,
}){
 if(!id(deliveryId)||!KINDS.has(vehicleKind)||!coordinate(pickup)||
   !integer(nowMs,0,Number.MAX_SAFE_INTEGER)||!Array.isArray(candidates)||
   candidates.length>300||!integer(maxOffers,1,5)||!integer(ttlSeconds,5,45)||
   ![checkEligibility,calculateRoutes,createOffer,issueRequestKey]
    .every(value=>typeof value==='function'))
  return failure('Delivery dispatch inputs invalid');
 try{
  const eligible=[],seen=new Set();
  for(const candidate of candidates){
   if(!candidateValid(candidate,vehicleKind,nowMs)||seen.has(candidate.courierId))continue;
   seen.add(candidate.courierId);
   if(await checkEligibility({deliveryId,courierId:candidate.courierId,
    vehicleId:candidate.vehicleId})!==true)continue;
   eligible.push(candidate);
  }
  if(!eligible.length)return Object.freeze({ok:true,liveEnabled:false,offers:[]});
  const routes=[];
  for(let offset=0;offset<eligible.length;offset+=20){
   const batch=eligible.slice(offset,offset+20);
   const rows=await calculateRoutes({
    origins:batch.map(c=>({courierId:c.courierId,lat:c.location.lat,lng:c.location.lng})),
    destination:{lat:pickup.lat,lng:pickup.lng},trafficAware:true,vehicleKind,
   });
   const expected=new Set(batch.map(c=>c.courierId));
   if(!Array.isArray(rows)||rows.length>batch.length||
     rows.some(row=>!expected.has(row?.courierId)))
    return failure('Delivery routing provider invalid');
   routes.push(...rows);
  }
  const byCourier=new Map();
  for(const route of routes){
   if(byCourier.has(route?.courierId))return failure('Ambiguous delivery route matrix');
   byCourier.set(route.courierId,route);
  }
  const ranked=[];
  for(const candidate of eligible){
   const route=byCourier.get(candidate.courierId);
   if(!routeValid(route,candidate.courierId,nowMs))continue;
   const fairness=Math.min(90,Math.floor(candidate.idleSeconds/120));
   ranked.push({candidate,route,rank:route.etaSeconds-fairness});
  }
  ranked.sort((a,b)=>a.rank-b.rank||a.route.etaSeconds-b.route.etaSeconds||
   a.candidate.courierId.localeCompare(b.candidate.courierId));
  const persisted=[];
  for(const item of ranked.slice(0,maxOffers)){
   const requestKey=await issueRequestKey({deliveryId,
    courierId:item.candidate.courierId,vehicleId:item.candidate.vehicleId});
   if(!id(requestKey))return failure('Delivery offer key unavailable');
   const receipt=await createOffer({deliveryId,courierId:item.candidate.courierId,
    vehicleId:item.candidate.vehicleId,requestKey,ttlSeconds});
   if(!object(receipt)||receipt.ok!==true||receipt.liveEnabled!==false||
     !id(receipt.offerId))return failure('Delivery offer persistence unavailable');
   persisted.push(Object.freeze({offerId:receipt.offerId,
    courierId:item.candidate.courierId,routeMeters:item.route.roadMeters,
    etaSeconds:item.route.etaSeconds,pushDelivered:false}));
  }
  return Object.freeze({ok:true,liveEnabled:false,offers:Object.freeze(persisted)});
 }catch{return failure('Verified delivery dispatch unavailable');}
}
