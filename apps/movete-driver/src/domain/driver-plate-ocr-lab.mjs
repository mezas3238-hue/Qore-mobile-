/**
 * G291: strict, offline-only ML Kit candidate parsing and two-sample comparison.
 * ML Kit text-recognition does not provide an attested plate confidence score.
 * Never turn visual text equality into authenticity, approval, or eligibility.
 */
import {normalizeDriverPlate} from './driver-evidence-intelligence.mjs';
const SOURCES=Object.freeze(['registration','vehicle','permit']);
const allowed=new Set(SOURCES);
const sourceShape=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype;
const finding=(status,reason)=>Object.freeze({
 status,reason,driverEligible:false,vehicleApproved:false,
 evidenceVerified:false,confidenceVerified:false,
 requiresHumanReview:true,mayDispatch:false
});
export const DRIVER_OCR_LAB_SOURCES=SOURCES;
/**
 * Accept only entire recognized lines matching a conservative plate pattern.
 * No guessed substitutions between letter O/digit 0 or I/digit 1.
 * No free-form regex extraction from unrelated personal document fields.
 */
export function extractDriverPlateCandidates(result){
 if(!sourceShape(result)||!Array.isArray(result.blocks)||
   result.blocks.length>120)return Object.freeze([]);
 const set=new Set();
 for(const block of result.blocks){
  if(!block||!Array.isArray(block.lines)||block.lines.length>80)
   return Object.freeze([]);
  for(const line of block.lines){
   if(!line||typeof line.text!=='string'||line.text.length>64)
    return Object.freeze([]);
   const candidate=normalizeDriverPlate(line.text);
   if(candidate!==null)set.add(candidate);
   if(set.size>4)return Object.freeze([]);
  }
 }
 return Object.freeze([...set]);
}
/**
 * Two independent camera captures per source, same exact OCR candidate.
 * This is *text comparison only*. It does NOT certify physical origin.
 */
export function compareDriverUnverifiedOcrSamples(samples){
 if(!sourceShape(samples)||Object.keys(samples).some(k=>!allowed.has(k))||
   !Object.hasOwn(samples,'registration')||
   !Object.hasOwn(samples,'vehicle'))
  return finding('unverified','MISSING_REQUIRED_SOURCE');
 const values=[];
 for(const source of SOURCES){
  if(!Object.hasOwn(samples,source))continue;
  const observations=samples[source];
  if(!Array.isArray(observations)||observations.length!==2||
   !observations.every(x=>typeof x==='string'&&normalizeDriverPlate(x)===x))
   return finding('unverified','INCOMPLETE_OR_INVALID_OCR_SAMPLES');
  if(observations[0]!==observations[1])
   return finding('unverified','OCR_INCONSISTENT_SAME_SOURCE');
  values.push(observations[0]);
 }
 if(new Set(values).size!==1)
  return finding('text_conflict_pending_review','OCR_PLATE_TEXT_CONFLICT');
 return finding('text_equal_pending_review','OCR_TEXT_ONLY_UNTRUSTED');
}
export function addDriverPlateOcrSample(samples,source,candidates){
 if(!sourceShape(samples)||!allowed.has(source)||!Array.isArray(candidates)||
  candidates.length!==1||normalizeDriverPlate(candidates[0])!==candidates[0])
  return Object.freeze({accepted:false,reason:'AMBIGUOUS_OR_UNREADABLE',samples});
 const previous=Array.isArray(samples[source])?samples[source]:[];
 if(previous.length>2)return Object.freeze({accepted:false,reason:'INVALID_PREVIOUS',samples});
 if(previous.length===2)return Object.freeze({accepted:false,reason:'SOURCE_COMPLETE',samples});
 if(previous.length===1&&previous[0]!==candidates[0])
  return Object.freeze({accepted:false,reason:'INCONSISTENT_RECAPTURE',
   samples:{...samples,[source]:[]}});
 const next={...samples,[source]:[...previous,candidates[0]]};
 return Object.freeze({accepted:true,reason:'CAPTURED',samples:next});
}
