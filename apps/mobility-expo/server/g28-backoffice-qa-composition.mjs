/**
 * G28.1 A05.3 — explicit, fail-closed backoffice QA composition.
 * This never starts a network listener and can only create 127.0.0.1 test
 * transport. It requires trusted injected Auth, provider MFA and rate limit.
 * Only Admin incident read is backed by a tested disposable PostgreSQL RPC;
 * all other Admin/Owner read scopes return unavailable.
 */
import {createQoreBackofficeRoleAuthority} from './g27-backoffice-role-authority.mjs';
import {createQoreBackofficeReadGateway} from './g27-backoffice-read-gateway.mjs';
import {createQoreBackofficeSqlReadRepository} from './g28-backoffice-sql-read-repository.mjs';
import {createQoreBackofficeLoopbackTransport} from './g27-backoffice-loopback-transport.mjs';

export function prepareQoreG28BackofficeQa({
 environment,liveEnabled,localQaOnly,
 projectRef,cursorSecrets,verifyAccessToken,
 verifyBackofficeMfa,allowRequest,rpc,now=Date.now
}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
    localQaOnly!==true)
  throw Error('G28 only permits explicit localhost isolated QA with LIVE false');
 if([verifyAccessToken,verifyBackofficeMfa,allowRequest,rpc,now]
  .some(x=>typeof x!=='function'))
  throw Error('Verified server JWT, MFA, limiter and private SQL RPC required');
 const roleAuthority=createQoreBackofficeRoleAuthority({rpc});
 const loadPage=createQoreBackofficeSqlReadRepository({rpc});
 const readHandler=createQoreBackofficeReadGateway({
  projectRef,cursorSecrets,verifyAccessToken,verifyBackofficeMfa,
  allowRequest,now,...roleAuthority,loadPage
 });
 const server=createQoreBackofficeLoopbackTransport({readHandler});
 return Object.freeze({
  server,readHandler,
  allowedQaReadScopes:Object.freeze(['admin.incidents.read']),
  commercialOperationsEnabled:false,
  remoteListeningEnabled:false
 });
}
