/** Bounded strict base64 decoder for a temporary camera-only KYC capture. */
export const MAX_PRIVATE_IMAGE_BYTES=5242880;
export function decodePrivateImageBase64(input,maxBytes=MAX_PRIVATE_IMAGE_BYTES){
 if(typeof input!=='string'||input.length<8||
  input.length>Math.ceil(maxBytes/3)*4+4||
  input.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(input))
  throw Error('CAMERA_BYTES_INVALID');
 const pad=input.endsWith('==')?2:input.endsWith('=')?1:0;
 const length=input.length/4*3-pad;
 if(length<20||length>maxBytes)throw Error('CAMERA_BYTES_INVALID');
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 const output=new Uint8Array(length);
 let index=0;
 for(let i=0;i<input.length;i+=4){
  const a=alphabet.indexOf(input[i]),b=alphabet.indexOf(input[i+1]);
  const c=input[i+2]==='='?0:alphabet.indexOf(input[i+2]);
  const d=input[i+3]==='='?0:alphabet.indexOf(input[i+3]);
  if(a<0||b<0||c<0||d<0)throw Error('CAMERA_BYTES_INVALID');
  const word=(a<<18)|(b<<12)|(c<<6)|d;
  if(index<length)output[index++]=(word>>16)&255;
  if(index<length)output[index++]=(word>>8)&255;
  if(index<length)output[index++]=word&255;
 }
 return output;
}
