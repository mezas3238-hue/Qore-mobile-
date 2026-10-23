# Arquitecto B — G40 integrado con runtime privado de Cliente (2026-10-23)

Rama B, PR #8 DRAFT, sin merge/producción. G40 sigue UNMOUNTED en OpenAPI A G41.

- Flujo G40 ligado a JWT Passenger, revisión privada, logout y rotación; contrato OFF por defecto.
- API: prepareIncidentReport, submitIncidentReport, retryIncidentReport, refreshIncidentStatus, discardIncidentReport.
- Solo acepta cuerpo estructurado del contrato G40 y recibo de base de QA sin SOS/operador. Conserva requestKey tras timeout y bloquea doble POST.
- Snapshot público minimizado, no datos sensibles; nunca se conecta automáticamente a soporte.tsx, que sigue «NO ENVIADO».
- QA sintético valida bloqueo no desplegado, recibo, rotación y reintento.

Pendiente: Backend A certifique y monte STAGING con JWT/RLS/revocación, entonces integrar formulario autorizado y E2E nativo. Sin LIVE o recibos inventados.
