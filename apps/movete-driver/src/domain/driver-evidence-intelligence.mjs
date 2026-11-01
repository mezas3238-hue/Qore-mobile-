/**
 * G289: offline, fail-closed capture quality and OCR plate reconciliation.
 * No authentication, authorizations, online endpoints or raw images here.
 * OCR/segmentation inputs must come from a genuine on-device analyzer.
 */
const PLATE_INPUT=/^[A-Z0-9 -]{5,16}$/;
const PLATE_CANONICAL=/^(?=.{5,8}$)(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]+$/;
const REQUIRED=['registration','vehicle'];
const ALLOWED=new Set([...REQUIRED,'permit']);
export function normalizeDriverPlate(text){
 if(typeof text!=='string'||text.length>32)return null;
 const clean=text.normalize('NFKC').trim().toUpperCase();
 if(!PLATE_INPUT.test(clean))return null;
 const plate=clean.replace(/[ -]/g,'');
 return PLATE_CANONICAL.test(plate)?plate:null;
}
export function compareDriverPlateEvidence(readings){
 const result=(state,reasons)=>Object.freeze({
  state,reasons:Object.freeze(reasons),reviewRequired:true,
  driverEligible:false,vehicleApproved:false
 });
 if(!readings||typeof readings!=='object'||Array.isArray(readings)||
   Object.getPrototypeOf(readings)!==Object.prototype||
   Object.keys(readings).some(k=>!ALLOWED.has(k)))
  return result('uncertain',['INVALID_EVIDENCE']);
 const normalized=[];
 for(const key of REQUIRED){
  if(!Object.hasOwn(readings,key))return result('uncertain',['MISSING_'+key.toUpperCase()]);
 }
 for(const key of ['registration','vehicle','permit']){
  if(!Object.hasOwn(readings,key))continue;
  const r=readings[key];
  if(!r||typeof r!=='object'||Array.isArray(r)||
    typeof r.text!=='string'||!Number.isFinite(r.confidence)||
    r.confidence<0||r.confidence>1)
   return result('uncertain',['INVALID_'+key.toUpperCase()]);
  // OCR confusables such as O/0, I/1 are not guessed or silently changed.
  if(r.confidence<0.92)return result('uncertain',['LOW_CONFIDENCE_'+key.toUpperCase()]);
  const value=normalizeDriverPlate(r.text);
  if(value===null)return result('uncertain',['UNREADABLE_'+key.toUpperCase()]);
  normalized.push(value);
 }
 if(new Set(normalized).size!==1)
  return result('mismatch',['PLATE_CONFLICT_REQUIRES_REVIEW']);
 return result('match_pending_review',['TEXT_ONLY_MATCH_NOT_IDENTITY_VERIFICATION']);
}
const rejection=(reasons,metrics=null)=>Object.freeze({
 ready:false,reasons:Object.freeze(reasons),metrics,
 mayApprove:false
});
const finite01=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
export function assessDriverCaptureFrame(frame){
 if(!frame||!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||
  frame.width<48||frame.height<48||frame.width*frame.height>320*320||
  !(frame.luma instanceof Uint8Array)||
  frame.luma.length!==frame.width*frame.height||
  !Number.isFinite(frame.motionRms)||frame.motionRms<0)
  return rejection(['INVALID_FRAME']);
 const {width:w,height:h,luma}=frame;
 let sum=0,bright=0,dark=0,variance=0,n=0,lapSum=0,lapSquares=0;
 for(let i=0;i<luma.length;i++){
  const v=luma[i];sum+=v;if(v>246)bright++;if(v<28)dark++;
 }
 const mean=sum/luma.length;
 for(let i=0;i<luma.length;i++)variance+=(luma[i]-mean)**2;
 const contrast=Math.sqrt(variance/luma.length);
 for(let y=1;y<h-1;y+=2)for(let x=1;x<w-1;x+=2){
  const k=y*w+x;
  const lap=4*luma[k]-luma[k-1]-luma[k+1]-luma[k-w]-luma[k+w];
  lapSum+=lap;lapSquares+=lap*lap;n++;
 }
 const sharpness=lapSquares/n-(lapSum/n)**2;
 const rect=frame.subjectBox;
 const validBox=!!rect&&typeof rect==='object'&&finite01(rect.x)&&
  finite01(rect.y)&&finite01(rect.width)&&finite01(rect.height)&&
  finite01(rect.confidence)&&rect.confidence>=0.9&&
  rect.x>=0.025&&rect.y>=0.025&&rect.width>=0.55&&
  rect.height>=0.35&&rect.x+rect.width<=0.975&&
  rect.y+rect.height<=0.975;
 // A sharp rectangular BORDER can falsely raise whole-image Laplacian
 // while the text in the middle is blurred. Measure detail INSIDE the
 // detected subject, excluding its outer contour and the UI overlay.
 let interiorSharpness=0,interiorEdgeRatio=0;
 if(validBox){
  const x0=Math.max(1,Math.floor((rect.x+rect.width*.2)*w));
  const x1=Math.min(w-2,Math.floor((rect.x+rect.width*.8)*w));
  const y0=Math.max(1,Math.floor((rect.y+rect.height*.2)*h));
  const y1=Math.min(h-2,Math.floor((rect.y+rect.height*.8)*h));
  let count=0,lapTotal=0,lapSq=0,edges=0;
  for(let y=y0;y<=y1;y+=2)for(let x=x0;x<=x1;x+=2){
   const k=y*w+x;
   const lap=4*luma[k]-luma[k-1]-luma[k+1]-luma[k-w]-luma[k+w];
   lapTotal+=lap;lapSq+=lap*lap;count++;
   if(Math.abs(lap)>=20)edges++;
  }
  if(count>0){
   interiorSharpness=lapSq/count-(lapTotal/count)**2;
   interiorEdgeRatio=edges/count;
  }
 }
 const reasons=[];
 if(mean<65)reasons.push('TOO_DARK');
 if(mean>205)reasons.push('TOO_BRIGHT');
 if(bright/luma.length>0.12)reasons.push('GLARE');
 if(dark/luma.length>0.25)reasons.push('SHADOW');
 if(contrast<22)reasons.push('LOW_CONTRAST');
 // Both whole image AND interior need real detail. These conservative
 // thresholds are lab-only; physical-device calibration is still required.
 if(sharpness<180||interiorSharpness<420||interiorEdgeRatio<0.055)
  reasons.push('OUT_OF_FOCUS');
 if(frame.motionRms>0.085)reasons.push('CAMERA_MOVING');
 // Bounding box MUST be from an image-based detector; overlays are NOT evidence.
 if(!validBox)reasons.push('SUBJECT_NOT_VERIFIED_IN_FRAME');
 return Object.freeze({
  ready:reasons.length===0,reasons:Object.freeze(reasons),
  metrics:Object.freeze({brightness:Math.round(mean),contrast:Math.round(contrast),
   sharpness:Math.round(sharpness),interiorSharpness:Math.round(interiorSharpness),
   interiorEdgeRatio:Math.round(interiorEdgeRatio*1000)/1000,
   glareRatio:bright/luma.length}),
  mayApprove:false
 });
}
/**
 * Only the *third* separated frame with image + motion + bbox checks can
 * request a shutter. Caller must reset sequence on errors, account switch,
 * app background, document kind switch or lost camera permissions.
 */
export function nextDriverAutoCaptureGate({
 previousCount=0,quality,elapsedMs,minimumGapMs=450
}={}){
 if(!Number.isInteger(previousCount)||previousCount<0||previousCount>3||
  !quality||typeof quality.ready!=='boolean'||
  !Number.isFinite(elapsedMs)||!Number.isFinite(minimumGapMs)||
  minimumGapMs<300||minimumGapMs>2000)
  return Object.freeze({takePhoto:false,nextCount:0});
 const valid=quality.ready&&elapsedMs>=minimumGapMs;
 const nextCount=valid?Math.min(3,previousCount+1):0;
 return Object.freeze({takePhoto:nextCount===3,nextCount});
}
