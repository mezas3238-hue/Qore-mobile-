/**
 * G328: lightweight destination typeahead cadence. Queries remain in RAM only.
 * Never geocode on individual keystrokes or continuously repeat the same term.
 * The G319 native location budget remains the final concurrency/rate gate.
 */
export function createClientDestinationAutocompleteGate({
 now=()=>Date.now(),debounceMs=850,minimumGapMs=3200
}={}){
 if(typeof now!=='function'||!Number.isSafeInteger(debounceMs)||
  debounceMs<400||!Number.isSafeInteger(minimumGapMs)||minimumGapMs<3000)
  throw Error('INVALID_AUTOCOMPLETE_CONFIGURATION');
 let previousQuery='',lastStarted=-Infinity;
 const safe=query=>typeof query==='string'&&query.trim().length>=4&&
  query.trim().length<=120&&!/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(query);
 return Object.freeze({
  plan(query,{enabled=true}={}){
   if(!enabled||!safe(query))return null;
   const normalized=query.trim();
   if(normalized===previousQuery)return null;
   const elapsed=now()-lastStarted;
   const remaining=Number.isFinite(elapsed)?Math.max(0,minimumGapMs-elapsed):0;
   return Object.freeze({query:normalized,delayMs:Math.max(debounceMs,remaining+50)});
  },
  markStarted(query){
   if(!safe(query))return false;
   previousQuery=query.trim();lastStarted=now();return true;
  },
  clear(){previousQuery='';lastStarted=-Infinity;}
 });
}
