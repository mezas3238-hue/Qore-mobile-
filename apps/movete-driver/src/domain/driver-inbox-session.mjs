/** Private Driver inbox session coordinator.
 * Auth tokens remain only inside the injected auth/runtime session bridge.
 * Returned snapshots NEVER contain JWT, actor ID, or private provider metadata.
 * The backend still verifies JWT and the driver's persisted role on every call.
 */
export const DRIVER_SESSION_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEARER=/^[A-Za-z0-9._~-]{20,7900}$/;
const empty=Object.freeze([]);
function make(phase,offers=empty){
 return Object.freeze({phase,offers:Object.freeze([...offers]),liveEnabled:false});
}
export function createDriverInboxSessionController({readInbox}={}){
 if(typeof readInbox!=='function')throw Error('Trusted Driver inbox fetch adapter required');
 let identity=null;
 let generation=0;
 let state=make('signed-out');
 return Object.freeze({
  current(){return state;},
  setSession(input){
   generation++;
   identity=null;
   state=make('signed-out');
   if(input===null||input===undefined)return state;
   if(typeof input!=='object'||Array.isArray(input)||input.role!=='driver'||
      typeof input.userId!=='string'||!UUID.test(input.userId)||
      typeof input.accessToken!=='string'||!BEARER.test(input.accessToken)){
    state=make('authorization-required');return state;
   }
   // Only in ephemeral closure. Never persisted or included in UI state.
   identity={userId:input.userId,accessToken:input.accessToken};
   state=make('ready');return state;
  },
  clear(){
   generation++;
   identity=null;
   state=make('signed-out');
   return state;
  },
  async refresh(){
   if(identity===null)return state;
   const nonce=generation,credential=identity.accessToken;
   state=make('loading');
   try{
    const offers=await readInbox({accessToken:credential});
    if(nonce!==generation)return state; // Logout/account swap while fetching.
    if(!Array.isArray(offers)||offers.length>10)
     throw Error('Invalid private offer set');
    const checked=offers.map(row=>{
     if(!row||typeof row!=='object'||!['AUTO_RIDE','DELIVERY'].includes(row.kind)||
       typeof row.offerId!=='string'||!UUID.test(row.offerId)||
       typeof row.serviceId!=='string'||!UUID.test(row.serviceId)||
       !Number.isSafeInteger(row.expiresAtMs))
      throw Error('Invalid private offer');
     return Object.freeze({kind:row.kind,offerId:row.offerId,
      serviceId:row.serviceId,expiresAtMs:row.expiresAtMs});
    });
    state=make('connected',checked);
    return state;
   }catch(err){
    if(nonce!==generation)return state;
    const message=err instanceof Error?err.message:'';
    if(/session expired|role not authorized/.test(message)){
     generation++;identity=null;
     state=make('authorization-required');
    }else{
     state=make('offline');
    }
    return state;
   }
  }
 });
}
