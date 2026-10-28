# R75 — Recuperar cancelación G95 después de cerrar y reabrir Cliente

**Arquitecto B, 25-oct-2026, PR #8 DRAFT.**

## Función completa dentro del alcance STAGING QA

Antes de cada POST de cancelación G95, Cliente guarda en el
**Keychain/Keystore** mediante `expo-secure-store` exclusivamente:
`ownerId,bookingKey=requestKey,quoteId,routeId,tripId,serverRevision,cancellationKey`
y fecha/versión, sin JWT, dirección, teléfono, importe, GPS ni credenciales.
Si el almacenamiento cifrado falla, se BLOQUEA el POST; no puede ocurrir
una cancelación no recuperable por fallas del dispositivo.

Al reiniciar una instalación nativa, la app exige primero Auth del
pasajero, la misma configuración HTTPS STAGING certificada y una lectura
**GET G73 booking** que verifica owner/quote/route/trip/revision contra
el registro sellado. Recién entonces ofrece **GET G95 cancellation**;
nunca reintenta POST ni inventa pago/reembolso. Otras cuentas, registro
alterado, >7 días, HTTP fallido o Auth inválida no habilitan lectura G95.
Tras cerrar sesión se borra la referencia cifrada; tras doble verificación
G4/G94 también se borra. Web queda sin adaptador ni persistencia.

## Limitaciones transparentes

- La recuperación reiniciada solo confirma **recibo G95**. Sin el recibo
  G93 de importes original no se declara que G94 haya pasado la
  reconciliación monetaria completa; se requiere otro contrato de A.
- A HTTP G97 está local-only, no HTTPS STAGING externo certificado. G73/G95
  y PostgreSQL no están autorizados para producción. QA sintética y TypeScript
  no son una build nativa validada.
- La referencia cifrada puede sobrevivir a un cierre forzoso del proceso,
  pero su integridad final depende del Keystore/Keychain del dispositivo.
  No hay fallback inseguro a AsyncStorage o web/localStorage.
- Si A no expone GET G73 real con los mismos IDs, permanece deshabilitado.

**Siguiente puerta:** A certificar G97 runtime externo con Owner, Driver,
PostgreSQL, G4/G94/G95/G26 y Admin en un viaje real antes de permitir flags.
No merge, no LIVE, no recursos pagos.
