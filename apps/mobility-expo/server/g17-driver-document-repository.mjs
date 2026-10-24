/** G17 service-role SQL repository for private Driver KYC metadata.
 * Only private object REFERENCES; never document bytes or public URLs.
 */
export const G17_DOCUMENTS_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','seguro','inspeccion','habilitacion','rostro_selfie']);
const status=new Set(['pending','approved','rejected']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&UUID.test(x);
const iso=x=>typeof x==='string'&&Number.isSafeInteger(Date.parse(x));
function rows(response){
 if(!plain(response)||response.error||!Array.isArray(response.data)||
   response.data.length>8)throw Error('G17 private document status unavailable');
 return Object.freeze(response.data.map(row=>{
  if(!plain(row)||!kinds.has(row.kind)||!status.has(row.status)||
     !iso(row.submitted_at)||!(row.reviewed_at===null||iso(row.reviewed_at)))
   throw Error('G17 private document status invalid');
  if((row.status==='pending')!==(row.reviewed_at===null))
   throw Error('G17 impossible review state');
  return Object.freeze({kind:row.kind,status:row.status,
   submittedAtMs:Date.parse(row.submitted_at),
   reviewedAtMs:row.reviewed_at===null?null:Date.parse(row.reviewed_at)});
 }));
}
function result(response){
 if(!plain(response)||response.error||!id(response.data))
  throw Error('G17 document database receipt unavailable');
 return response.data;
}
export function createDriverDocumentRepository({rpc}={}){
 if(typeof rpc!=='function')throw Error('Trusted G17 SQL client required');
 return Object.freeze({
  async readStatus({driverId}={}){
   if(!id(driverId))throw Error('Invalid verified Driver');
   return rows(await rpc('mobility_stage_read_driver_document_status',
    {_driver_id:driverId}));
  },
  async registerObservation({driverId,requestKey,kind,objectKey,
   mimeType,byteSize,sha256Hex}={}){
   if(!id(driverId)||!id(requestKey)||!kinds.has(kind)||
     typeof objectKey!=='string'||typeof mimeType!=='string'||
     !Number.isSafeInteger(byteSize)||!Number.isFinite(byteSize)||
     typeof sha256Hex!=='string')
    throw Error('Invalid observed private document');
   return result(await rpc('mobility_stage_register_driver_document',{
    _driver_id:driverId,_request_key:requestKey,_kind:kind,
    _object_key:objectKey,_mime_type:mimeType,
    _byte_size:byteSize,_sha256_hex:sha256Hex}));
  },
  async review({documentId,reviewerId,approve,reasonCode,requestKey}={}){
   if(!id(documentId)||!id(reviewerId)||!id(requestKey)||
      typeof approve!=='boolean'||typeof reasonCode!=='string'||
      !/^[A-Z_]{3,40}$/.test(reasonCode))
    throw Error('Invalid private document review');
   return result(await rpc('mobility_stage_review_driver_document',{
    _document_id:documentId,_reviewer_id:reviewerId,_approve:approve,
    _reason_code:reasonCode,_request_key:requestKey}));
  }
 });
}
