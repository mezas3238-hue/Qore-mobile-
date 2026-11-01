/** Fallback for non-native build targets. Never substitute fake OCR data. */
export async function recognizeDriverPlatePhoto(_uri:string):Promise<unknown>{
 throw Error('DRIVER_OCR_REQUIRES_NATIVE_BUILD');
}
