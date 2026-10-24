/** Native evidence capture, never invoked by default app tree.
 * The Owner-authorized STAGING composition injects this into
 * createDriverStagingRuntime with a private authenticated Storage SDK.
 */
import * as ImagePicker from 'expo-image-picker';
import {Platform} from 'react-native';
import {decodePrivateImageBase64} from '../domain/driver-base64-image.mjs';
import type {DriverKycUploadKind} from '../domain/driver-document-upload.mjs';
export async function capturePrivateDriverEvidence({
 kind,source,maxBytes
}:{
 kind:DriverKycUploadKind;
 source:'camera'|'camera_or_library';maxBytes:number;
}):Promise<{bytes:Uint8Array;mimeType:string;source:'camera'|'library'}|null>{
 if(Platform.OS!=='ios'&&Platform.OS!=='android')
  throw Error('DOCUMENT_CAPTURE_REQUIRES_NATIVE_DEVICE');
 if(kind==='rostro_selfie'&&source!=='camera')
  throw Error('SELFIE_MUST_USE_CAMERA');
 const useCamera=kind==='rostro_selfie'||source==='camera';
 if(useCamera){
  const permission=await ImagePicker.requestCameraPermissionsAsync();
  if(permission.granted!==true)throw Error('CAMERA_PERMISSION_DENIED');
 }
 const options:ImagePicker.ImagePickerOptions={
  mediaTypes:['images'],allowsEditing:false,quality:0.85,
  base64:true,exif:false,allowsMultipleSelection:false
 };
 const result=useCamera?
  await ImagePicker.launchCameraAsync(options):
  await ImagePicker.launchImageLibraryAsync(options);
 if(result.canceled)return null;
 const item=result.assets?.[0];
 if(!item||typeof item.base64!=='string'||
  !['image/jpeg','image/png'].includes(item.mimeType??''))
  throw Error('DOCUMENT_IMAGE_UNSUPPORTED');
 const bytes=decodePrivateImageBase64(item.base64,maxBytes);
 return {bytes,mimeType:item.mimeType!,source:useCamera?'camera':'library'};
}
