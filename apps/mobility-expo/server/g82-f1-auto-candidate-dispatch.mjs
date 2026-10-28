/** G82 internal QA dispatch service, not a public route.
 * The backend selects an eligible candidate through its own SQL procedure;
 * phones cannot supply driver or vehicle IDs. No proximity or LIVE claims.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid=x=>typeof x==='string'&&UUID.test(x);
export function createG82PrivateAutoCandidateDispatch(database){
 if(!database||typeof database.rpc!=='function')
  throw Error('G82 requires private server-side SQL authority');
 return Object.freeze({
  async offerFirstEligible(input){
   if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).length!==4||
     !['passengerId','bookingKey','offerKey','ttlSeconds']
       .every(k=>Object.hasOwn(input,k)))
    throw Error('G82 requires exact private booking scope; no client candidate');
   const {passengerId,bookingKey,offerKey,ttlSeconds}=input;
   if(![passengerId,bookingKey,offerKey].every(isUuid)||
     !Number.isSafeInteger(ttlSeconds)||ttlSeconds<5||ttlSeconds>30)
    throw Error('G82 invalid private QA offer input');
   let receipt;
   try{
    receipt=await database.rpc('mobility_stage_g82_offer_first_eligible_auto_qa',{
     _passenger_id:passengerId,_booking_key:bookingKey,
     _offer_key:offerKey,_ttl_seconds:ttlSeconds
    });
   }catch{throw Error('G82 private SQL unavailable');}
   if(!receipt||receipt.error)throw Error('G82 private SQL denied offer');
   if(receipt.data!==null&&!isUuid(receipt.data))
    throw Error('G82 malformed private SQL receipt');
   return Object.freeze({
    offerId:receipt.data,candidateAvailable:receipt.data!==null,
    pushDelivered:false,commercialRidesEnabled:false,liveEnabled:false
   });
  }
 });
}
