# G61 — Movete Fácil: pasar de QA a aplicación comercial

**24 de octubre de 2026 · Arquitecto A · PR #7 DRAFT · no merge/no LIVE/no despliegue.**

## Resumen ejecutivo

Se ha avanzado desde el diseño de contratos a **adaptadores móviles Driver capaces de efectuar peticiones HTTPS a un dominio STAGING expresamente aprobado**. Este avance es código ejecutable y probado con transportes simulados, no un backend externo desplegado. La composición por defecto de Expo sigue sin autenticación remota ni transporte habilitado y se niega a simular pasajeros o mensajes reales.

El principal riesgo ya no es solo que falten métodos: hay contratos completos en QA pero **no están integrados con usuarios, dispositivos y servicios de producción**, por lo que una compilación Expo verde no autoriza ofrecer viajes.

## G61A — Transporte Driver HTTPS real, opt-in

`apps/movete-driver/src/domain/driver-chat-https-staging.mjs` y su declaración `.d.mts` y test aportan:
- Cinco operaciones del chat Driver: inbox (GET), history-with-ordered-markers (GET), send (POST), reconcile (POST), mark-visible-ordered (POST).
- URL bajo un **nombre DNS de STAGING explícitamente aprobado** por el integrador, con HTTPS obligatorio, sin credenciales en la URL, puertos/path/query especiales, redirects, CORS implícito ni hosts definidos por la respuesta.
- `fetch` nativo con credenciales omitidas, `cache:no-store`, `redirect:error`, timeout acotado y `AbortController`; `Authorization: Bearer ...` exclusivamente en headers. Los cuerpos POST sólo transportan `{requestKey,body}` o `{messageId,marker}`, **nunca actor, rol ni session_id**.
- Validación de JSON/no-store y límites de tamaño; errores de red o después del SQL se consideran `DRIVER_CHAT_OUTCOME_UNKNOWN`, sin rehacer SEND automáticamente. Esto preserva el protocolo de G59B.
- Un proveedor externo de UUID criptográficamente seguro y uno de comprobación de detención del vehículo son obligaciones inyectadas, nunca `Math.random` o un toggle del conductor.
- **No** se incluye un servidor nuevo ni se asume que las rutas localhost G58/G60B existen remotamente.

## G61B — Auth Driver HTTPS

`apps/movete-driver/src/domain/driver-https-staging-auth.mjs` y pruebas:
- Exige un SDK Auth real inyectado desde un punto de composición que no almacene claves de servicio ni contraseñas en la app.
- Recupera la sesión, valida el vencimiento, llama al SDK `getUser(access_token)`, coteja ID, evita usuarios anónimos/no confirmados.
- Requiere `verifyExclusiveDriverRole({apiOrigin,userId,accessToken})` **independiente del JWT y de los metadatos del cliente**. Sin prueba de rol exclusivo emitida por backend, la app no obtiene sesión Driver.
- La suscripción de Auth envía una notificación **sin bearer**, para que la UI invalide todas las conversaciones en logout/cambio de cuenta. Un backend de STAGING tendrá que implementar la fuente de roles apropiada.
- Iniciar o conectar este adaptador exige autorización explícita; `liveEnabled` permanece false.

## G61C — Criterio de salida automatizado

El manifiesto `docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json` identifica **17 gates obligatorios**. El script `scripts/check-movete-launch-gates.mjs` valida estado, evidencia, rol responsable y consentimiento explícito del Owner. Un `npm test` o un SUCCESS de GitHub Actions **no** cambia esos estados.

Ejecutar:
```bash
node scripts/check-movete-launch-gates.mjs --json
node scripts/check-movete-launch-gates.mjs --require-go
```
La última orden devuelve código distinto de cero si hay gates pendientes, pruebas insuficientes o falta orden de producción. Los tests del gate corren en el workflow de aislamiento de dos aplicaciones; es **correcto** que el reporte general de lanzamiento sea NO_GO mientras el CI del código permanezca en verde.

## Trabajos concretos restantes, por bloque

| Prioridad | Área | Responsable | Condición de cierre |
|---|---|---|---|
| P0 | Identidad, rol y servidor HTTPS | A + Owner | Host STAGING y proveedor externo aprobados; JWT y revocación probados contra servidor de verdad, sin falsificar claims |
| P0 | Driver: registro, documentación y KYC | A | Altas reales autorizadas, documentos cifrados en backend, revisión por Admin y alta restringida al vehículo habilitado |
| P0 | Cliente: solicitud de viajes y pedidos | B | Reserva real con origen/destino, tarifa coherente Gs, zona y conductor confirmado transaccionalmente |
| P0 | Oferta, aceptación, despacho y viaje | A | Dos dispositivos reales intercambian ofertas; una sola aceptación; ruta, inicio/cierre, GPS y comisiones concilian |
| P0 | Supermercados, farmacias y restaurantes | A/B | Catálogo privado, carrito, stock, preparación, despacho, entrega, cancelación y soporte auditables |
| P0 | Chat bidireccional y push | A/B | Mensajes físicos seguros, reconexión sin duplicados, marker de leído real y privacidad de push |
| P0 | Pagos y devoluciones | A/B + Owner | PSP autorizado, cobro y devolución idempotentes, estados y auditoría contable real |
| P0 | Seguridad y emergencias | A/B + Owner | SOS escalable a operadores con tiempos de respuesta, control de fraude, seguro y rutas |
| P0 | Admin Web | B | Roles MFA, validación KYC, zonas, comercios, incidentes, configuración y auditoría en entorno real |
| P0 | Distribución Android/iOS | A/B | APK/AAB/IPA firmados y ensayos de permisos, GPS, push, lifecycle, batería y falta de red en teléfonos reales |
| P0 | Lanzamiento legal/operativo Paraguay | Owner | Términos, privacidad, seguros, municipios, impuestos, equipo de soporte y protocolos autorizados |
| P0 | GO/NO-GO final | Owner | 17 gates verificados con evidencia revisada y orden expresa de despliegue |

Este roadmap no introduce límites artificiales de 50 usuarios o registros, ni restringe cobertura por falta de conductores: **cobertura geográfica y disponibilidad real son cosas distintas**.

## Estado honesto

Los componentes G42–G60D y G61A/B son importantes pero no prueban disponibilidad comercial. El CI verifica semántica de código, PostgreSQL disposable, TypeScript y export Expo web; **no verifica app firmada de tienda, prestación de servicio con personas reales, seguridad de pagos ni cumplimiento legal**.

### Lo que requiere una decisión externa

Para completar la aplicación operativa hará falta autorizar un proveedor Auth, un ambiente HTTPS STAGING, una base de datos protegida, credenciales gestionadas **fuera de código**, dispositivos de prueba y el proveedor de pagos escogido. Sin esa infraestructura se puede seguir cerrando código y tests, pero no certificar la operación real. Ninguna acción de despliegue, merge, LIVE, VPS ni PSP se ejecutó.
