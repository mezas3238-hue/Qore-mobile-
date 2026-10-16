/**
 * Basic transport-layer hygiene for a private license document selected through
 * ImagePicker. File signature is NOT identity or authenticity verification.
 * The server must independently verify content and an authorized reviewer
 * must verify the license, expiry, insurance and category.
 */
export type DocumentImage = {base64:string;mimeType:'image/jpeg'|'image/png';extension:'jpg'|'png';bytes:number};
export function inspectLicenseImage(payload:string):DocumentImage {
 if(typeof payload!=='string')throw Error('Fotografía de licencia inválida');
 // ImagePicker returns raw base64, NOT a data URI.
 const raw=payload.trim();
 if(raw.length>14_000_000||raw.length<1300||raw.length%4!==0||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(raw))
  throw Error('Formato base64 o tamaño de licencia inválido');
 const bytes=raw.length/4*3-(raw.endsWith('==')?2:raw.endsWith('=')?1:0);
 if(bytes<1000||bytes>10_000_000)throw Error('La licencia supera el límite admitido o está vacía');
 if(raw.startsWith('/9j/'))return{base64:raw,mimeType:'image/jpeg',extension:'jpg',bytes};
 if(raw.startsWith('iVBORw0KGgo'))return{base64:raw,mimeType:'image/png',extension:'png',bytes};
 throw Error('Utilizá una imagen JPG o PNG de tu licencia');
}
