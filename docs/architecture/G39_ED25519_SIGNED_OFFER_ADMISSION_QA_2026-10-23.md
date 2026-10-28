# Arquitecto A — G39 Ed25519, prueba de oferta firmada / verificación QA
Fecha: 23 de octubre 2026. Dependencia G38.0–G38.2, commit G38 `cdeb9434`.

## Nuevo contrato Node: criptografía verificada y despacho inhabilitado
- `server/g39-signed-offer-admission-qa.mjs`: validación Ed25519 de JWS compacto **EdDSA**, typ propio `qore-offer-proof+jwt`, identificador de clave kid contra mapa de **claves públicas SPKI** suministradas por la autoridad backend (sin descargas controladas por kid).
- JSON estricto, sin claves duplicadas, base64url canónico, sin campos adicionales, expiración máxima de 30 segundos, leeway +2s, identidad única y vínculo exacto oferta/job/Driver/vehículo/zona/tipo/revisión de consentimiento/geometría/política/sesión verificada. La firma sola no reemplaza controles externos.
- Permite rotación conservando varias claves PUBLICAS previamente autorizadas; revocar kid elimina inmediatamente la aceptación de pruebas antiguas.
- `createG39OfferAdmissionQa` exige **adaptadores independientes** inyectados para JWT verdadero, revocación de sesión, lectura de oferta autoritativa y rate limiter. Una prueba firmada íntegra devuelve **423 G39_QA_DISPATCH_LOCKED**, nunca `dispatchAuthorized=true`. No escucha en Internet, no persiste la tabla G38, no hace ofertas comerciales.
- Se registra digest SHA-256 del token verificable en herramienta interna, sin exponer credenciales. Las claves privadas del emisor NUNCA se versionan; los tests crean claves efímeras en memoria.

## CI y ataques
Archivo `g39-signed-offer-admission-qa.test.mjs`: falsificación de firma, otra clave, `alg=none/HS256`, cambio de kid, JWS no canónico, JSON duplicado, expiración/replay, cambio de conductor/cuenta/vehículo/zona/sesión/revisiones, suplantación del rol, revocación, backend ausente, rate limit, rechazo a instanciar LIVE. CI Node `node --test *.test.mjs`.

## Riesgos no cerrados
El emisor auténtico, distribución de claves, anclaje de auditoría, cierre legal por municipio, geocerca certificada/anti-spoof, Auth real, SQL de inserción posterior a la verificación, PSP, storage y staging HTTPS **todavía no existen**. G38 mantiene `eligible_by_policy=false` en QA. No confundir una prueba firmada en memoria con un permiso de transporte autorizado.

### Gobernanza
NO LIVE, NO MERGE, NO SQL remoto, NO deploy, PR #7 DRAFT, no tocar Cliente/Admin Web B. Siguiente A: integrar fuente atestadora real por interfaz de confianza, resolver Auth de proveedor y diseñar persistencia que enlace auditoría/firmas a la decisión transaccional. Coordinar incidentes B por issue #9 cuando corresponda.
