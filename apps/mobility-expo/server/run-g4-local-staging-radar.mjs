/**
 * Explicit LOCAL QA entrypoint for G4 only.
 *
 * There is NO port listener until prepareQoreG4StagingRuntime:
 * - verifies native Auth disable_signup === true from Supabase
 * - verifies correct server-only keys and G3/G4 SQL table presence
 * - refuses LIVE/production project
 *
 * Never publish to Railway/Lovable, install migrations, seed fixtures, accept
 * commercial trips, or connect to phones from a public network.
 */
import {prepareQoreG4StagingRuntime} from './g4-staging-runtime.mjs';
import {listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';

const port=Number(process.env.QORE_G4_LOCAL_PORT??'4242');
if(!Number.isInteger(port)||port<1024||port>65535)
 throw new Error('Invalid QA port (must be between 1024 and 65535)');
if(process.env.QORE_G4_LOCAL_QA_ONLY!=='true')
 throw new Error('QORE_G4_LOCAL_QA_ONLY=true explicit authorization required');
// Load external SDK only after fail-closed local QA environment checks.
if(process.env.LIVE_TRIPS_ENABLED!=='false'||process.env.QORE_MOBILITY_ENV!=='isolated_staging')
 throw new Error('G4 requires isolated staging and LIVE_TRIPS_ENABLED=false');
const {createClient}=await import('@supabase/supabase-js');
const session=await prepareQoreG4StagingRuntime({
 environment:process.env.QORE_MOBILITY_ENV,
 liveTripsEnabled:process.env.LIVE_TRIPS_ENABLED==='false'?false:null,
 allowQa:true,
 projectRef:process.env.QORE_STAGING_PROJECT_REF,
 anonKey:process.env.QORE_STAGING_PUBLISHABLE_KEY,
 serviceKey:process.env.QORE_STAGING_SERVICE_ROLE_KEY,
 createClient,
});
await listenQoreRadarLoopback(session.server,port);
// Deliberately no service keys, API URL, JWT, GPS, personal details printed.
console.log('QORE Radar G4 local QA loopback enabled on 127.0.0.1, NO LIVE; no real trip dispatch');
