/** C Driver: accepted DELIVERY -> private persisted G66 custody read before UI navigation.
 * Navigation is not permission. No POST, fake receipt or cached offer here.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
export async function verifyAcceptedPrivateDeliveryCustody({
 deliveryId,readCustody
}={}){
 if(typeof deliveryId!=='string'||!UUID.test(deliveryId)
  ||typeof readCustody!=='function')
  return fail('CUSTODY_VERIFICATION_REQUIRED');
 try{
  const observed=await readCustody(deliveryId);
  if(!observed||observed.deliveryId!==deliveryId||
   !['active','terminal'].includes(observed.phase)||
   !['accepted','picked_up','delivered','disputed','returned','cancelled']
    .includes(observed.status)||
   !Number.isSafeInteger(observed.revision)||observed.revision<2||
   observed.uncertain!==false||observed.qaOnly!==true||
   observed.productionEnabled!==false)
   return fail('CUSTODY_ASSIGNMENT_NOT_VERIFIED');
  return Object.freeze({ok:true,deliveryId,
   status:observed.status,revision:observed.revision,qaOnly:true,
   productionEnabled:false});
 }catch{return fail('CUSTODY_READ_UNAVAILABLE');}
}
