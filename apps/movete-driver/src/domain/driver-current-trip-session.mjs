/** C / G106: a valid assigned AUTO trip is not a valid snapshot if Auth
 * changes while the private HTTP GET is in flight. Fail closed before UI.
 * No token, identity or passenger details are retained in the result.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const ACTIVE=new Set(['accepted','arriving','in_progress']);
const identity=s=>s?.role==='driver'&&UUID.test(s.userId??'')
 &&typeof s.accessToken==='string'&&TOKEN.test(s.accessToken);
const same=(a,b)=>identity(a)&&identity(b)
 &&a.userId===b.userId&&a.accessToken===b.accessToken;
export async function verifyPrivateDriverCurrentTrip({
 session,getSession,readCurrent
}={}){
 if(!identity(session)||typeof getSession!=='function'
  ||typeof readCurrent!=='function')
  throw Error('G106 private Driver session unverified');
 let trip;
 try{trip=await readCurrent({accessToken:session.accessToken});}
 catch{throw Error('G106 private trip read unavailable');}
 let latest;
 try{latest=await getSession();}
 catch{throw Error('G106 Driver session changed');}
 if(!same(session,latest))throw Error('G106 Driver session changed');
 if(trip===null)return null;
 if(!trip||typeof trip!=='object'||Array.isArray(trip)
  ||Object.keys(trip).length!==3
  ||!UUID.test(trip.tripId??'')||!ACTIVE.has(trip.status)
  ||!Number.isSafeInteger(trip.revision)||trip.revision<2)
  throw Error('G106 assignment not verified');
 return Object.freeze({tripId:trip.tripId,status:trip.status,revision:trip.revision});
}
