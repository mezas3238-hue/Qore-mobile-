/** G290: on-device image samples only. No network, OCR or disk retention.
 * A preview overlay is NOT considered evidence of subject framing.
 */
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
import {File} from 'expo-file-system';
import {decode as decodeJpeg} from 'jpeg-js';
import {decodePrivateImageBase64} from '../domain/driver-base64-image.mjs';
import {assessDriverCaptureFrame} from '../domain/driver-evidence-intelligence.mjs';
import {detectDriverDocumentContour} from '../domain/driver-document-contour.mjs';
import type {DriverCaptureQuality} from '../domain/driver-evidence-intelligence.mjs';

export function discardDriverCameraCache(uri:string|undefined|null){
 if(typeof uri!=='string'||!uri.startsWith('file://'))return;
 try{new File(uri).delete();}catch{ /* No photo bytes exposed to telemetry. */ }
}
export async function inspectNativeDriverDocumentPhoto(
 fileUri:string,motionRms:number
):Promise<DriverCaptureQuality>{
 if(typeof fileUri!=='string'||!fileUri.startsWith('file://')||
  !Number.isFinite(motionRms)||motionRms<0)
  throw Error('CAMERA_IMAGE_SOURCE_INVALID');
 const ctx=ImageManipulator.manipulate(fileUri);
 ctx.resize({width:160});
 const downsized=await ctx.renderAsync();
 let saved:{uri:string;base64?:string|null}|undefined;
 let bytes:Uint8Array|undefined;
 try{
  saved=await downsized.saveAsync({format:SaveFormat.JPEG,compress:0.82,base64:true});
  bytes=decodePrivateImageBase64(saved.base64??'',524288);
  const image=decodeJpeg(bytes,{useTArray:true,formatAsRGBA:true});
  if(!Number.isInteger(image.width)||!Number.isInteger(image.height)||
   image.width<64||image.height<64||
   image.width*image.height>100000||
   image.data.length!==image.width*image.height*4)
   throw Error('CAMERA_IMAGE_DIMENSIONS_INVALID');
  const luma=new Uint8Array(image.width*image.height);
  for(let k=0;k<luma.length;k++){
   const idx=k*4;
   luma[k]=Math.round((77*image.data[idx]+
    150*image.data[idx+1]+29*image.data[idx+2])/256);
  }
  const subjectBox=detectDriverDocumentContour({
   width:image.width,height:image.height,luma
  });
  return assessDriverCaptureFrame({
   width:image.width,height:image.height,luma,motionRms,subjectBox
  });
 }finally{
  bytes?.fill(0);
  if(saved?.uri!==fileUri)discardDriverCameraCache(saved?.uri);
 }
}
