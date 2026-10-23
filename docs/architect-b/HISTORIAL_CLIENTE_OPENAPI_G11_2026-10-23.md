# Movete Fácil Cliente — integración segura de historial con OpenAPI G11
**Fecha:** 23 de octubre de 2026 · **Arquitecto B** · [PR #8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8)

## Resultado técnico

Implementado un puente **de lectura únicamente**, sin conexión por defecto, entre el historial de Cliente y el contrato ahora disponible en OpenAPI del Arquitecto A. La plataforma **no impone tope global de 50 registros**: se siguen páginas firmadas hasta `nextCursor=null`, con la cantidad de datos limitada por respuesta.

**Archivo OpenAPI verificado en rama A:** `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`, versión `1.0.0-g11`, operationId `listOwnRiderHistoryPaginated`, endpoint `GET /v1/staging/rider/history`, descripción de historial propio sin techo de registros.

### Contrato específico del backend A (no inventar otro)
- Cursor de continuación: cabecera `X-Qore-History-Cursor` (no parámetro query). Omitir en primera página.
- Cursor en respuesta: `nextCursor` null o patrón `^v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{43}$`, longitud 40–200. En origen el token está firmado con HMAC-SHA256, ligado al titular de JWT y tiene ventana de expiración (enunciada como diez minutos de inactividad).
- Página máxima de **50 servicios**, no 50 usuarios o servicios de toda la plataforma.
- Cada respuesta: `ownerId`, `generatedAt`, `expiresAt`, `items`, `nextCursor`.
- Filas: `serviceId`, `kind=RIDE|DELIVERY|MERCHANT_ORDER`, `status`, `createdAt`, `revision` de mínimo 1.
- Respuestas 400 por cursor inválido, 401/403 por sesión/permiso, 429 y 503 sin datos privados.
- La firma real, permisos y validez de cursor los verifica el servidor: el cliente solamente valida estructura y pertenencia del payload.

## Cambios publicados por Arquitecto B
- `d755dd5a93c80246ddcfe36e4a3a69e163ade0cd` — gateway `client-history-gateway.mjs` con HTTPS fijo, NO LIVE, JWT efímero, titular, límite de JSON, URL no arbitraria, timeout, rol Passenger y rechazo de resultados fuera de sesión. QA unitario.
- `2ee4a4c24ea9f0668daa84895994c88909493dac` — `client-experience` con `loadHistoryPage`, deduplicación, rechazo de respuestas tardías/cuentas ajenas, antirrepetición de cursores, estado de lectura; pantalla `app/historial.tsx` con botón «Consultar historial / Cargar más servicios» deshabilitado hasta activar contrato real.
- `03ee5de4f947707f10d0b4f2c40e28ea7a956533` — cachea el orden de filas entre repintados UI; se invalida al recibir nueva página. `FlatList` ya virtualiza tarjetas.
- `0cdbd0bc2f30ab03255b3a3c207f933d16c8006a` — adaptó el gateway, DTO y pruebas al **cursor firmado real de A en cabecera** y `revision >= 1`, en lugar de inventar `?cursor=`.
- `353d60a55ffd3eb89aab3e11e62e79c125c2961b` — corrigió helper sintético faltante detectado en CI de Cliente, sin omitir pruebas.

## Invariantes
- Cliente, Driver y Admin Web permanecen **aplicaciones independientes**; los permisos no se comparten.
- El gateway tiene `enabled=false`, `contractCertified=false` hasta autorización expresa y pruebas reales de STAGING.
- El usuario solo ve servicios vinculados a su propia sesión verificada y filtrados por el backend. No se guardan JWT o expedientes en AsyncStorage/localStorage.
- Ante logout, cambio de actor o respuesta tardía, el historial anterior se borra/rechaza. Un 401 antiguo no debe invalidar el login nuevo.
- No se generan saldos, recibos, precios, ETA ni viajes falsos.
- No se realizó ningún pago, despliegue, merge, LIVE ni mutación real de base de datos.

## Pruebas y límites
- La batería Cliente ejercita 120 páginas sintéticas, rechazo de cursor circular, 403 de sesión reemplazada, 200 tardío de cuenta diferente, red/503/JSON inválido y carga duplicada, además de la prueba anterior de 5.000 servicios en 100 páginas de 50.
- Que exista la operación en OpenAPI A **no demuestra por sí solo** que el servicio STAGING esté desplegado, autenticado y accesible desde los móviles. Falta validación E2E real con sesiones sintéticas.
- Si un cursor caduca, backend debe devolver error inequívoco, y Cliente tiene opción de reiniciar desde primera página (mediante `loadHistoryPage({reset:true})`), sin mezclar cuentas.
- **Aún pendiente:** A certifica Auth Passenger + JWT/RLS, HMAC del cursor contra suplantación, tests de carga sin techo global y endpoint STAGING. Owner debe autorizar posteriormente despliegue y operaciones reales.

## Continuidad
Arquitecto A entrega evidencia del endpoint STAGING y tests de autorización + HMAC; Arquitecto B integra mediante configuración inyectada segura (nunca por input de usuario), ejecuta E2E de Android Cliente con múltiples páginas y verifica renovaciones de sesión. [Issue de coordinación #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

## Evidencias posteriores de CI (23 octubre 2026)
- `c3f38ddfb3d63f4307a68065953a51540e0c101d`: se agregó el error `INVALID_OR_EXPIRED_CURSOR` al recibir 400 y la opción **Reiniciar consulta desde la primera página**. Reintento explícito sin mezclar cursores de sesiones diferentes; tests QA.
- [**CI Cliente/Driver #39926313188 — SUCCESS**](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39926313188): Cliente **113 tests, 113 PASS, 0 FAIL**, chequeo TypeScript y exportación web; Driver chequeo y exportación independiente aprobados.
- [**CI Admin Web #39926313214 — SUCCESS**](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39926313214): **109 tests, 109 PASS, 0 FAIL**, TypeScript y Vite build aprobados.
- Control de propiedad de carpetas para B [#39926313223 — SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39926313223).
- Estos resultados prueban el código de QA y la independencia de los paquetes, **no** que una cuenta real o un histórico privado ya se pueda consultar en un servidor comercial.
