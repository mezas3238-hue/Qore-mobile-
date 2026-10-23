# QORE Mobile — Paginación integral sin límite global de registros
**Fecha:** 23 de octubre de 2026 · **Arquitecto B** · [PR #8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8)

## Directiva del propietario
**Movete Fácil NO admite un techo artificial de 50 ni de 100 conductores, usuarios, viajes, envíos, pedidos, zonas, expedientes o incidentes.** El máximo de elementos por respuesta HTTP es una medida de seguridad y rendimiento; **NO es el máximo de registros de la base de datos ni de registros admitidos por la plataforma**. Backend A debe confirmar este contrato de capacidad para PostgreSQL y las reglas de elegibilidad.

## Trabajo realizado por Arquitecto B
- `ab50dbac0f267968af03067fe8a8c1922d31d596`: `page-cursor.mjs`, validador de cursor opaco URL-safe y navegador con pila de cursores anterior/siguiente. Prueba 251 páginas seguidas sin tope global, rechazo de cursor cíclico, limpieza al cambiar sesión.
- `938e06aa6490a75ae52dbda749db525dd2ddbe68`: módulos `kyc-queue`, `zone-overview`, `incidents-overview` y `audit-feed` aceptan `nextCursor` opcional sin romper los DTO antiguos; mantienen límites de lote (KYC/incidentes/audit 100, zonas 200) **solo por página**.
- `65cf18500bfca03f935861cf5ea58080b33e6770`: `admin-read-gateway` codifica `?cursor=... ` solo desde tokens válidos, nunca a partir de rutas/URL arbitrarias, prohibido para Owner finance aggregate. `admin-experience` cambia la página activa y descarta páginas anteriores en vez de mantener datos privados masivos en RAM. Pruebas 151 páginas de KYC, volver atrás, ningún máximo de expedientes. El primer CI detectó falta de `pagination` sin sesión y se corrigió sin omitir pruebas.
- `64d00dffca835b634f681e977b64ff92d13360ba`: snapshot sin sesión devuelve paginación vacía y nunca expone datos anteriores.
- `af7f0a4b5b06caf1368484a1b6dc36db75e2a078`: Admin Web agrega controles accesibles `Anterior` / `Siguiente`, muestra número de página actual, nunca reporta total global inventado. [CI Admin #39921570353 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39921570353).
- `c6f3793e359d2cde63bac378c4ee4d9736570b2a`: Cliente `history-feed` conserva acumulación de 100 páginas de 50 ítems (5.000 servicios) con prueba y cursor URL-safe; pantalla `historial.tsx` usa `FlatList` virtualizada para no renderizar 5.000 tarjetas a la vez. [CI Admin #39921744503 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39921744503); Cliente isolation #39921744487 SUCCESS, boundary #39921744479 SUCCESS.
- `ea675b0756eaaaeecd686e8ad360136781d5c51e`: permite que una misma zona geográfica tenga varias modalidades `AUTO_RIDE`, `AUTO_DELIVERY`, `MOTO_DELIVERY` sin colisión de clave/UI, cada modalidad mantiene política independiente. Prueba adicional.

## Contratos propuestos para A — no son endpoints confirmados
Todas las respuestas de listados **incluyen opcionalmente** `nextCursor` string URL-safe de 1–256 caracteres, o `null` al terminar. En Cliente el campo ya existía, con límite 200. El frontend soporta `GET /ruta?cursor=<opaque>` conservando la ruta fija, sesión y permiso.

**A debe implementar y certificar:**
1. **Registro ilimitado por definición de producto.** Prohibido programar un `MAX_USERS=50`, `MAX_DRIVERS=50` o `LIMIT 50` como cardinalidad total de una tabla/colección. Los registros PostgreSQL deben crecer según capacidad real e infraestructura disponible, con backups, observabilidad y mantenimiento.
2. **Paginación keyset/cursor** por índices compuestos estables, orden determinístico y snapshot/revisión cuando aplique; máximos de página configurables pero no techo del sistema. Tokens de cursor firmados o protegidos, con contexto de rol/sujeto, filtro, orden, expiración y revisión. Un cursor entre cuentas debe causar 403/invalid.
3. **JWT/RLS y MFA Admin** validados en cada página, no solo la primera. No filtrar IDs/PII ajenos ni documentos por su URL. `owner` no hereda lectura KYC de `admin`.
4. **Carga funcional completa** con pruebas de 1, 50, 51, 100, 101, 1.000, 10.000 y lotes mayores en STAGING sintético, midiendo paginación, deduplicación, latencia p95, consumo de memoria y borrado de datos caducados. Sin SQL real en producción sin autorización.
5. **Reanudar tras red caída** manteniendo cursor de página sólo si la sesión es la misma; un cursor vencido debe reiniciar la búsqueda con indicación explícita, no ocultar registros.
6. **No promover a LIVE** sin que Owner apruebe pruebas, reglas municipales y seguridad.

## Límites técnicos honestos
- No se construyó ni modificó PostgreSQL desde la rama B; por eso no afirmamos que la base instalada ya acepte infinitas cuentas. El frontend **no impone techo global**, pero la capacidad operativa final depende de A.
- Los DTOs KYC/zonas/incidentes/auditoría son propuestas y siguen desconectados de STAGING real por defecto. El motor Admin sí pasó pruebas de paginación sintética.
- `FlatList` evita dibujar miles de elementos simultáneos en Cliente; en esta fase no descarga automáticamente el historial desde un endpoint real porque A debe certificar Auth y contrato de historial.
- Los números 50, 100 y 200 permanecen **como máximos por respuesta**, una práctica necesaria para evitar payloads enormes. Se pueden emitir y consumir páginas sucesivas hasta agotar la fuente.

## Continuidad inmediata
- A responde la capacidad sin tope y los DTO de paginación en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
- B integra el contrato final STAGING con credenciales sintéticas y pruebas E2E. El PR #8 permanece DRAFT, sin merge ni despliegue.
