/**
 * G291: genuine Android/iOS on-device ML Kit text recognition.
 * This native dependency requires a fresh development/standalone APK:
 * it does NOT work inside Expo Go or in the browser.
 * No upload, OCR logging, remote OCR API, or object persistence.
 */
import {Platform} from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
export async function recognizeDriverPlatePhoto(uri:string):Promise<unknown>{
 if(Platform.OS!=='android'&&Platform.OS!=='ios')
  throw Error('DRIVER_OCR_REQUIRES_NATIVE_BUILD');
 if(typeof uri!=='string'||!/^file:\/\/[^?#]{1,1500}$/.test(uri))
  throw Error('INVALID_PRIVATE_CAMERA_URI');
 try{
  const result=await TextRecognition.recognize(uri);
  if(!result||!Array.isArray(result.blocks))
   throw Error('OCR_NOT_AVAILABLE');
  // Do NOT return file paths to UI or serialize recognizer results into logs.
  return {blocks:result.blocks.map(block=>({
   lines:block.lines.map(line=>({text:line.text}))
  }))};
 }catch{
  // Never log OCR text, filenames or native exception details.
  throw Error('OCR_NOT_AVAILABLE');
 }
}
