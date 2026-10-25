# R73 — G95 cancelación AUTO: POST único y recuperación GET
Arquitecto B, 25-oct-2026. PR #8 DRAFT. NO LIVE ni MERGE.

El pasajero que confirma booking G73 en el mismo tripId y lo verifica por
GET G4 mientras su estado es searching/assigned/arriving (máximo 60 s)
puede preparar una cancelación G95 con un requestKey independiente.
POST /v1/staging/rider/auto/bookings/{bookingKey}/cancel
body exacto: {requestKey, confirmed:true}.
ACK debe ser persisted G95, owner/bookingKey/tripId/quoteId y eventId
original, revisión creciente, VOIDED_QA o NO_CAMPAIGN_QA, sin PSP.
Si POST es ambiguo, NO reenvía: solo
GET /v1/staging/rider/auto/bookings/{bookingKey}/cancellation
con la misma clave. Jamás muestra reembolso o altera tracking local;
G4 y G94 son lecturas separadas para verificar estado y reversal.

Flag EXPO_PUBLIC_F1_G95_CANCEL_CONTRACT_VERIFIED = true SOLO tras
certificación explícita A del runtime HTTPS/IdP/PG y Owner.
OpenAPI A G95 declara x-qore-runtime-wired=false y external staging=false.
Esta integración y sus pruebas unitarias no son un viaje comercial/real.

P0 A: G95 SQL idempotente, G4 status, G94 VOIDED_QA,
G26 historial y G75 Admin en PostgreSQL persistente con dos móviles.
No tocar archivos de A, no habilitar producción ni pagar infraestructura.
