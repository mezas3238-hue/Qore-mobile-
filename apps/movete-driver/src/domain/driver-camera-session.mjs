/**
 * G308: A delayed shutter/quality promise must never commit a result after
 * the app backgrounds, the camera screen unmounts or permission is lost.
 * This is an on-device QA race fence, not a hardware autofocus certificate.
 */
export function canCommitDriverCameraInspection({
 requestEpoch,currentEpoch,appActive,permissionGranted
}={}){
 return Number.isSafeInteger(requestEpoch)&&requestEpoch>=0&&
  Number.isSafeInteger(currentEpoch)&&currentEpoch===requestEpoch&&
  appActive===true&&permissionGranted===true;
}
