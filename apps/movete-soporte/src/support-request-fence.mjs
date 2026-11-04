/**
 * G309: keep delayed auth / ticket page promises from restoring an old
 * Support session after sign-out or a newer request.
 *
 * Client-side safety guard only: server RLS, AAL2, role and revocation
 * remain the source of truth. Never serializes tokens or ticket content.
 */
export function createSupportRequestFence(){
 let epoch=0;
 const increment=()=>{
  if(epoch>=Number.MAX_SAFE_INTEGER)throw Error('SUPPORT_REQUEST_EPOCH_EXHAUSTED');
  epoch++;
  return epoch;
 };
 return Object.freeze({
  current:()=>epoch,
  begin:()=>increment(),
  invalidate:()=>increment(),
  isCurrent:value=>Number.isSafeInteger(value)&&value>=0&&value===epoch
 });
}
