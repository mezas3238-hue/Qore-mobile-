# B R77 — Admin Web runtime con consulta G75 del mismo viaje AUTO

**Arquitecto B, 25-oct-2026 — PR #8 DRAFT.**

## Brecha cerrada
El Admin Web ya implementaba la vista F1 de consulta privada, el gateway
GET `/v1/staging/admin/rides/{tripId}/f1-verification`, validación de
DTO exacto, AAL2 Admin, y una fence de revisiones de viaje. Sin embargo
`AdminRuntimeProvider` no pasaba ninguna opción G75: la vista
permanecía desconectada incluso con un backend permitido.

R77 conecta **únicamente el lector** a `createAdminExperience`, con
nueve valores explícitos de certificación del operador, todos en falso
por defecto. Aun con aprobación, el gateway exige sesión Admin MFA,
JWT válido, GET privado y snapshot G75 consistente. Ninguna escritura,
PSP, edición de KYC, flete o comisión se habilita.

## Política de activación
No activar `VITE_F1_*` hasta disponer de acta Owner,
contrato G75 compatible en HTTPS externo, PostgreSQL persistente,
token IdP AAL2 verificado por el servidor, rol Admin exclusivo y
sesión no revocada, prueba adversarial y pruebas de dos dispositivos.
G99 A prueba backend real en PG16 **local desechable**; NO satisface
ninguna de esas condiciones externas.

Las pruebas cubren apagado por defecto, gating parcial, origin/pin,
prohibición de IP/HTTP/puertos/rutas/credenciales, GET read-only,
Admin MFA autenticado, Owner denegado, sin exponer identificador
del pasajero, logout y sin persistencia de JWT.
Las variables VITE son visibles en builds y no son secretos.

**Pendientes:** pantalla instalada contra el mismo viaje G73/G4/G75
con dos teléfonos + Admin real, Driver aceptación→finalización, historial
G26, G93 histórico y contabilidad G94. NO MERGE/NO LIVE/no pagos.
