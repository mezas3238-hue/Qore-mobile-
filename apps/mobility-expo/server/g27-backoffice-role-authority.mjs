/**
 * G27 A04.2 — trusted backend-only PostgreSQL RPC role authority adapter.
 * Does not verify JWT or MFA: caller MUST run those independent checks.
 * No front-end/service_role leak, no role auto-provisioning, no LIVE.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPES=new Set([
 'admin.kyc.read','admin.zones.read','admin.incidents.read',
 'admin.audit.read','owner.finance.read'
]);
export function createQoreBackofficeRoleAuthority({rpc}){
 if(typeof rpc!=='function')
  throw Error('Server-only RPC authority required');
 const strict=async(name,args)=>{
  const response=await rpc(name,args);
  if(!response||typeof response!=='object'||response.error||
    !Object.hasOwn(response,'data'))throw Error('Backoffice authority unavailable');
  return response.data;
 };
 const loadExclusiveBackofficeRole=async userId=>{
  if(typeof userId!=='string'||!UUID.test(userId))
   throw Error('Invalid verified backoffice actor');
  const result=await strict('mobility_stage_g27_backoffice_role_of',{_user:userId});
  if(result!==null&&result!=='admin'&&result!=='owner')
   throw Error('Unsafe backoffice role result');
  return result;
 };
 const authorizePermission=async({userId,scope})=>{
  if(typeof userId!=='string'||!UUID.test(userId)||
     typeof scope!=='string'||!SCOPES.has(scope))
   return false;
  const allowed=await strict('mobility_stage_g27_backoffice_has_scope',{
   _user:userId,_scope:scope
  });
  if(typeof allowed!=='boolean')
   throw Error('Invalid scope authority response');
  return allowed;
 };
 return Object.freeze({loadExclusiveBackofficeRole,authorizePermission});
}
