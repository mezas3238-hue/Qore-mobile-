import {SUPPORT_ACTION_KINDS} from './support-action-contract.mjs';
const choices=Object.freeze({
 OPEN:Object.freeze(['ACKNOWLEDGE','ESCALATE_SAFETY','ESCALATE_FINANCE']),
 IN_PROGRESS:Object.freeze([
  'REQUEST_INFORMATION','ESCALATE_SAFETY',
  'ESCALATE_FINANCE','RESOLVE_INFORMATIONAL'
 ]),
 WAITING_CUSTOMER:Object.freeze(['RESOLVE_INFORMATIONAL']),
 ESCALATED:Object.freeze([]),RESOLVED:Object.freeze([])
});
const labels=Object.freeze({
 ACKNOWLEDGE:'Acusar recibo',
 REQUEST_INFORMATION:'Solicitar información',
 ESCALATE_SAFETY:'Escalar a seguridad',
 ESCALATE_FINANCE:'Escalar a finanzas',
 RESOLVE_INFORMATIONAL:'Proponer resolución'
});
/**
 * UI is NOT authoritative. Unassigned tickets are visible in the queue
 * but must be claimed via a separate audited workflow before any action.
 * G313 validates authorization, role, ticket and state again in SQL.
 */
export function allowedSupportActions(caseItem,agentId,enabled=false){
 if(enabled!==true||!caseItem||typeof agentId!=='string'||
    !agentId||caseItem.assigned_support_id!==agentId)return Object.freeze([]);
 const actions=choices[caseItem.status];
 if(!actions)return Object.freeze([]);
 return Object.freeze(actions.filter(x=>SUPPORT_ACTION_KINDS.includes(x))
  .map(action=>Object.freeze({action,label:labels[action]})));
}
