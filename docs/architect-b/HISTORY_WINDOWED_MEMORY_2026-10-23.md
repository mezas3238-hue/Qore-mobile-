# Movete Fácil — B29 historial Cliente con memoria acotada

**Fecha:** 23 de octubre de 2026  
**Ámbito:** Arquitecto B; aplicación Cliente.  
**Estado:** implementación y QA local completas; pendiente cierre GitHub.

## Problema

El historial no tiene un límite global de servicios, pero el store anterior acumulaba cada página en memoria. Un usuario con años de viajes, envíos y pedidos podía provocar crecimiento lineal aun cuando `FlatList` virtualizara el render.

La virtualización visual no libera los objetos conservados por el dominio. Por eso se necesitaba una ventana explícita sin convertirla en un límite del historial del servidor.

## Implementación

`createClientHistoryStore` mantiene por defecto hasta 500 servicios y permite configurar entre 50 y 5.000 para pruebas controladas.

- El endpoint continúa paginado por cursor y puede recorrerse sin tope global.
- Al anexar páginas más antiguas, el store conserva la ventana que el usuario está recorriendo y libera los elementos recientes que ya quedaron atrás.
- El snapshot expone `maxItems`, `rowsRead`, `evictedCount` y `hasEvictedNewer`.
- `rowsRead` es telemetría local de filas procesadas, no una cifra global ni un total del servidor.
- La UI informa cuando se liberaron registros y ofrece “Volver a los servicios más recientes”, que reinicia la consulta con cursor nulo.
- Los contadores no se persisten; cambio de cuenta, logout, expiración o respuesta inválida limpian el store.

No se almacena PII, importes, recibos o identidades de conductor. La deduplicación visible sigue usando `kind + serviceId` y conserva la revisión mayor dentro de la ventana.

## Estrés verificable

La nueva prueba consume 100.000 servicios sintéticos válidos en 2.000 páginas de 50:

- filas recorridas: 100.000;
- elementos máximos conservados: 500;
- elementos liberados al desplazar la ventana: 99.500;
- cursor final: `null`;
- recorrido global: completo, sin techo artificial.

La primera ejecución del test falló porque el fixture generaba `createdAt` posteriores al reloj de validación. Se corrigió el dataset; no se relajó el control temporal.

Resultado final local: **212/212 tests Cliente PASS**, TypeScript SUCCESS y Expo web export SUCCESS.

## Límite contractual

El contrato observado solo define `nextCursor` hacia páginas antiguas. B no inventa un `previousCursor`. Por eso la app puede volver al inicio reciente mediante una consulta limpia, pero la navegación reversa página a página queda pendiente de una semántica bidireccional certificada por A.

Este límite no impide recorrer todo el historial ni estabilizar memoria; sí impide prometer navegación inversa granular sin soporte del servidor.
