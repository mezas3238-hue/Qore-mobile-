# Arquitecto B — Panel Admin G41, filtros globales del servidor

23/10/2026 · PR #8 DRAFT, sin merge ni LIVE.

Se incorporó panel G41 con filtros severidad/estado enviados a servidor y paginación vinculada a la misma selección. Solo es visible con contrato G41 certificado por runtime; por defecto está oculto porque OpenAPI A declara x-qore-runtime-wired=false. Nunca se mezcla con A05 ni con filtros de página local. No se atribuyen totales globales a lotes de 50 ni se afirma atención de emergencias.

La vista invalida visualmente el resultado anterior cuando el operador cambia filtros; botones tienen etiquetas y estado disabled. UI sin documentos, teléfonos, GPS o identidades personales. Backend mantiene RBAC, firma de cursores y RLS. No se conecta a backend real ni realiza acciones sobre incidentes.

Requiere QA Admin/TS/Vite, ownership, aislamiento de aplicaciones en HEAD. Pendiente E2E STAGING real certificado y revisión de accesibilidad manual.
