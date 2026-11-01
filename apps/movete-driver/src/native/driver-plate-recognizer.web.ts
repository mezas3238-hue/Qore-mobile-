/** Web is not allowed to process Driver KYC images or guess OCR results. */
export async function recognizeDriverPlatePhoto(_uri:string):Promise<unknown>{
 throw Error('DRIVER_OCR_REQUIRES_NATIVE_BUILD');
}
