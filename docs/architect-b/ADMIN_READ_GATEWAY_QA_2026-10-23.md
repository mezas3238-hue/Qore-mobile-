# QORE Mobile — Arquitecto B: Adaptador de lectura segura para Admin Web
**Fecha:** 23 de octubre de 2026 · **PR:** [#8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) · **No merge, no deploy, no LIVE**

## Objetivo y estado exacto
Construcción de un gateway de **solo lectura STAGING** para Admin Web (diferente de los 2 paquetes móviles). Al completarse Auth y DTO de A, el UI podrá solicitar datos a través de su controlador de sesión, validar permisos y rechazar payloads extraños sin copiar identidades privadas.

**Estado:** gateway y orquestación UI implementados y certificados en CI QA, **sin llamadas a servicios reales ni conexiones predeterminadas**. No se han autorizado operaciones financieras, KYC de terceros, cambios de comisiones, mapas de conductores ni disparos de emergencia.

## Entrega real — código
| Commit | Archivos | Aporte |
|---|---|---|
| `9b34e1c26d6e6e4cb457911361bf257fab1110de` | `admin-read-gateway.mjs`, `.test.mjs` | HTTPS origin+pinnedOrigin fijo; rutas whitelisted; contratos por operación desactivados por defecto; JWT/MFA/rol; cookies omitidas, no cache, no referrer, no redirect, timeout, límites de tamaño y JSON; resultados 401/403/429/503; chequeo de identidad posterior a GET |
| `23b235e2314ee22b1a852caf206749a354491d76` | `admin-experience.mjs`, `.d.mts`, `.test.mjs` | Integra gateway opcional al runtime; rol Owner solo finance y rol Admin solo KYC, zonas, incidentes y auditoría; sustituye caché SOLO si el DTO pasa validadores específicos; lock anti doble consulta y bloqueo de respuestas tras logout |
| `dd56e16c5684e3b62d6f8f06c59fa0d620a231c7` | Gateway y runtime + tests | 401/403 de una consulta vieja **no borra una sesión nueva**. Usa revisión de Auth incluso en relogin mismo titular/token. Tests adversariales |
| `d385ab1c4a4ecdd126bca8b8dd9aaa18bca2349c` | `src/main.tsx`, `src/styles.css` | Control «Actualizar datos» de lectura manual; se habilita solo si existe rol correcto y contrato habilitado por configuración confiable. Mensajes sin revelar payloads/tokens, foco accesible, cero llamadas de red por renderizado/temporizador |

**CI Admin código más reciente:** [GitHub Actions #39896092740 — SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39896092740), logs: **100 tests / 100 PASS / 0 FAIL**, TypeScript estricto OK, build Vite OK, HTML y assets presentes. Control ownership en #39896092581 SUCCESS.

## Modelo de seguridad
- App B separada de Driver y Cliente; ningún import cruzado.
- `enabled=false` y `certifiedContracts=[]` por defecto. Sin `authProvider` ni `readGatewayOptions` en el montaje de producción QA actual, por lo que **no puede llamar a endpoints automáticamente**.
- A deberá entregar entorno STAGING con HTTPS, origin fijado fuera de datos del usuario, roles JWT y MFA autoritativos, RBAC por acción, RLS/DB y DTO versionado.
- Una respuesta HTTP 200 no constituye aceptación: pasa la proyección tipada por operación y filtros de PII (los validadores B), y solo entonces se usa en memoria.
- Una respuesta atrasada se descarta si cambia el sujeto, rol, token, vencimiento o revisión de autenticación. Una respuesta 401/403 atrasada no revoca la nueva sesión.
- Red caída, JSON erróneo, contenido no JSON, contenido demasiado grande, credenciales inválidas o contrato sin autorizar dejan la vista sin nuevos datos.
- Las pantallas no exhiben números de cuentas bancarias, información personal, fotos ni documentos. Se mantiene expiración de cada colección.
- No hay permisos de escritura implícitos; este gateway **solo ejecuta GET**.
- El navegador no ofrece prueba de integridad criptográfica de auditoría, liquidación financiera ni la verificación legal KYC. Es obligación del backend/área legal.

## Tabla de contratos propuestos a Arquitecto A
| Operación frontend | Ruta STAGING propuesta, NO confirmada | Rol y permiso a certificar en A |
|---|---|---|
| `kyc` | `GET /v1/staging/admin/vehicle-review-queue` | admin · admin.kyc.read |
| `zones` | `GET /v1/staging/admin/zones/overview` | admin · admin.zones.read |
| `incidents` | `GET /v1/staging/admin/incidents/queue` | admin · admin.incidents.read |
| `audit` | `GET /v1/staging/admin/audit/events` | admin · admin.audit.read |
| `finance` | `GET /v1/staging/owner/finance/summary` | owner · owner.finance.read |

Al consultar el OpenAPI de la rama A esta ronda, `info.version=1.0.0-g11`, **40 paths** y ninguna de estas 5 rutas se identificó como contrato confirmado. Sí hay rutas A para reporte/cambio de estado de incidentes, distintas de una **bandeja privada de lectura**. No reutilizar sin revisión semántica de permisos y respuesta.

## Gating para habilitar lecturas
1. A publica OpenAPI respuestas y seguridad para los cinco GET, adjunta evidencia CI/RLS (401,403,409,429,503), roles y MFA; documenta periodos, TTL, revisiones y paginación.
2. B adapta nombres/shape a contratos definitivos (sin afectar A) y comprueba pruebas de integración y adversariales.
3. El Owner aprueba **únicamente STAGING**, sin datos personales productivos, para pruebas de navegador con cuentas sintéticas.
4. E2E de navegación, caducidad y cambio de sesión, control de CSP y ausencia de tokens/PII en HTML/JS/logs.
5. Solo después, revisión de cumplimiento paraguayo y autorización escrita para despliegue/uso comercial. Un build SUCCESS nunca equivale a autorización LIVE.

## Trabajo siguiente
- Completar escenarios E2E QA de rol/privacidad sin llamadas LIVE.
- Integrar DTO final de A cuando esté disponible. Mantener reporte de bloqueos en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
- No tocar `.github/**`, backend, Driver ni migraciones; PR #8 permanece DRAFT.
