/**
 * Railway HTTPS edge for the SAME G4 runtime used in existing Render QA.
 * No distinct business logic, routes, database, auth or payments are created.
 * Railway terminates TLS; this fixed ingress only trusts the pinned public
 * *.up.railway.app hostname, one HTTPS forwarded-proto header and loopback.
 */
import {createRenderStagingIngress} from './render-staging-ingress.mjs';

export function createRailwayStagingIngress(options={}){
 return createRenderStagingIngress({...options,platform:'railway'});
}
