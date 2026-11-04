/** Web/unsupported fallback: no fake scanner evidence. */
import type {NativeDriverScannerReport} from './driver-native-mlkit-scanner.native';
export type {NativeDriverScannerReport} from './driver-native-mlkit-scanner.native';
export async function runNativeDriverDocumentScannerQa():Promise<NativeDriverScannerReport>{
 return {status:'unavailable',reasons:['NATIVE_SCANNER_UNAVAILABLE'],
  commercialApproved:false};
}
