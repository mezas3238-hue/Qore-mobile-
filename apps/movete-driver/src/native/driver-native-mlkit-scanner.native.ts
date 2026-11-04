/**
 * G310 Android-only QA: delegated Google Play Services ML Kit scanner.
 * No periodic CameraView.takePictureAsync; ML Kit owns autofocus,
 * edge detection, stabilization and scanner viewfinder.
 * All returned local pages are independently pixel-checked and discarded;
 * NEVER uploads/approves identity or private vehicle documents.
 */
import {Platform} from 'react-native';
import {launchDocumentScannerAsync,ResultFormatOptions,ScannerModeOptions}
 from '@infinitered/react-native-mlkit-document-scanner';
import {inspectNativeDriverDocumentPhoto,discardDriverCameraCache}
 from './driver-camera-qa-frame';
import {isAcceptedNativeDriverScan} from '../domain/driver-native-scanner-qa.mjs';

export type NativeDriverScannerReport=Readonly<{
 status:'accepted'|'rejected'|'cancelled'|'unavailable';
 reasons:readonly string[];commercialApproved:false;
}>;
export async function runNativeDriverDocumentScannerQa():Promise<NativeDriverScannerReport>{
 if(Platform.OS!=='android')return {status:'unavailable',
  reasons:['ANDROID_ONLY'],commercialApproved:false};
 let localUris:string[]=[];
 try{
  const scanned=await launchDocumentScannerAsync({
   pageLimit:1,galleryImportAllowed:false,
   scannerMode:ScannerModeOptions.FULL,resultFormats:ResultFormatOptions.JPEG
  });
  if(scanned.canceled===true)return {status:'cancelled',
   reasons:[],commercialApproved:false};
  // The SDK is expected to return one file:// JPEG page after the user saves.
  if(!Array.isArray(scanned.pages))return {status:'rejected',
   reasons:['INVALID_SCAN'],commercialApproved:false};
  localUris=scanned.pages.filter(uri=>typeof uri==='string');
  if(scanned.pages.length!==1||localUris.length!==1||
   !localUris[0].startsWith('file://'))return {status:'rejected',
   reasons:['INVALID_SCAN'],commercialApproved:false};
  const quality=await inspectNativeDriverDocumentPhoto(
   localUris[0],null,'mlkit-document-scanner'
  );
  const accept=isAcceptedNativeDriverScan({
   pageCount:scanned.pages.length,source:'mlkit-document-scanner',
   ready:quality.ready,reasons:quality.reasons
  });
  return {status:accept?'accepted':'rejected',
   reasons:quality.reasons,commercialApproved:false};
 }catch{
  return {status:'unavailable',reasons:['NATIVE_SCANNER_UNAVAILABLE'],
   commercialApproved:false};
 }finally{
  for(const uri of localUris)discardDriverCameraCache(uri);
 }
}
