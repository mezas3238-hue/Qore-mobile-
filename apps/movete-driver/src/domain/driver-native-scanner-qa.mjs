/**
 * G310: a returned ML Kit document scan is only a pixel-quality observation,
 * not an AF-lock certificate or a legal KYC verification.
 */
export function isAcceptedNativeDriverScan(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  input.source!=='mlkit-document-scanner'||input.pageCount!==1||
  input.ready!==true||!Array.isArray(input.reasons)||
  input.reasons.length!==0)return false;
 return true;
}
