# Arquitecto B — G41 enlazado al runtime Admin (2026-10-23)

Solo QA, PR #8 DRAFT sin merge. OpenAPI A 1.0.0-g41 declara x-qore-runtime-wired=false.

- Flujo separado de A05: filtros de severidad/estado al servidor, cursores ligados al mismo filtro y actor Admin MFA, no conteos globales inventados ni estado snapshot consistente.
- Runtime Admin admite triageGatewayOptions solo con enabled + contractCertified + stagingRuntimeVerified + HTTPS fijado; desactivado por defecto.
- logout, cambio de cuenta y revocación borran toda la página y cursor; respuestas tardías se ignoran.
- API loadGlobalIncidentTriage y snapshot globalTriage, sin habilitar acciones/SOS. UI antigua sigue mostrando filtros locales hasta integración visual certificada.
- Pruebas sintéticas G41 sobre paginación, Owner denegado, default OFF y sesión antigua.

Pendiente A certificar montaje STAGING JWT/MFA/RBAC/cursores firmados; E2E real y conectar vista Admin. No deploy, no LIVE.
