# QORE Mobile — R34: marcador de lectura G55 y referencia visual de movilidad
Fecha: 2026-10-24. Propiedad exclusiva Arquitecto B, PR #8 DRAFT. SIN MERGE / SIN LIVE / SIN DEPLOY.

## 1. Alcance implementado
- `apps/movete-cliente/src/domain/g55-chat-read-marker.mjs`: validador puro de `ChatHistoryWithMarkerG55`, `ChatHistoryPageG52`, `ChatReadMarkerG55` y receipt exacto.
- `apps/movete-cliente/src/domain/g55-chat-read-marker.test.mjs`: pruebas de aislamiento, asignación activa, exclusión Passenger, TTL, expiración, mensajes malformados, reentrancia, logout durante POST, confirmación explícita y ACK corrupto.
- El flujo es de DOMINIO QA únicamente: acepta una página sintética autorizada y prepara marcador temporal en memoria. No se conecta a `ClientRuntime`, ni a red, ni al evento nativo de visibilidad. No se ha creado ni enviado ninguna lectura real.
- `markVisible` exige evidencia booleana de pantalla visible y app foreground, además de coincidencia exacta de usuario/sesión/hilo/mensaje y transporte certificado inyectado. Esta evidencia NO sustituye una implementación de `viewabilityConfig` nativa que garantice visibilidad de la fila, por lo que la UI seguirá OFF.
- Un GET/aceptación NO invoca POST ni confirma leído. La única confirmación vendrá del ACK persistido G55, con `readConfirmed:true`; HTTP 200 vacío, error o timeout no certifica nada.
- No se genera ni se acepta `throughSeq` a partir de índice, revisión, ID o timestamps. El gateway legacy G51 continúa sin usar.

## 2. Contrato A aún bloqueante
OpenAPI A `1.0.0-g55` (65 rutas, blob `726a1cd455dd056e547dd5e572470c33433a429d`): `GET .../history-with-read-marker` no especifica `expectedConversationId` ni cursor/pin; ambas rutas G55 tienen `x-qore-runtime-wired:false`. B NO debe inventar parámetros ni declarar que existe HTTPS/JWT/PG operativo. Solicitud de A ya consta en issue #9. Falta conectar un transporte real bajo triple gate OFF, certificar paginación y visibilidad nativa, y probar lectura persistida contra PostgreSQL de STAGING autorizado.

## 3. Referencia competitiva recibida: capturas de una app de movilidad en Paraguay
Las cuatro imágenes enviadas por Owner el 24-oct muestran patrones de UX que pueden servir de referencia funcional, **no de identidad de marca ni de contrato tarifario**:
- Pantalla mapa + hoja inferior con origen/destino, recogida estimada, selección de servicio y confirmación.
- Lista de categorías agrupables por **recomendado**, **más rápido** y **más económico**, incluyendo opciones activas y deshabilitadas por disponibilidad real.
- Precio de cada alternativa claramente expresado en Gs/PYG; un precio tachado y descuento solo si el servidor devuelve promoción validada.
- Referencias ilustrativas de esa cotización: Economy G. 17.900, Bolt estándar G. 21.000, Priority G. 27.900, Envío Auto G. 17.900 y Envío Moto G. 9.900 **no disponible**. Son **datos observados de una cotización puntual ajena**, no base de tarifa global, ni valores recomendados para Movete Fácil.
- Separación entre pasajeros AUTO y servicios de envío AUTO/MOTO. Moto de pasajeros NO queda autorizado ni habilitado por aparecer en una captura de competidor.
- No trasladar a GitHub rutas de búsqueda, geolocalización, medios de pago ni identificadores personales presentes en imágenes del Owner.

## 4. Aceptación UI propia (Lovable posteriormente, infraestructura primero)
1. Identidad Movete Fácil original; no copiar iconografía, marca, colores exactos ni activos protegidos del competidor.
2. Cada modalidad se alimenta de `ServerPricedQuoteV1` + disponibilidad/eligibilidad backend; cobertura por zona NO equivale a chofer disponible.
3. `pickupEta` y ruta solo cuando hay providencia/frescura verificable desde servidor; no ETA inventada ni presentación de drivers ficticios.
4. PYG entero, sin cálculo de tarifa definitiva ni descuento en frontend; base y descuento con importes auditables en servidor y TTL.
5. Celdas inactivas explican indisponibilidad; nunca permiten contratar sin elegibilidad actual.
6. Filtros recomendado/rápido/económico requieren conjuntos de datos verdaderos y criterios explicables; no reordenar por engaño.
7. Accesibilidad para lector de pantalla, contraste, letra grande, foco y desplazamiento de opciones; test nativo posterior.
8. Cliente, Driver y Admin independientes. No activar cobros, llamadas, navegación con servicio real ni despliegue sin autorización Owner.

## 5. Continuación autónoma
- R34: cerrar transporte HTTPS POST G55 y primer GET solo si A publica cursor/pin y autorización; si no, mantener aislado el módulo y construir pruebas de carrera con G51/G52/G53 y limpieza al rotar JWT.
- Seguir pruebas de Cliente, Admin, backend simulado y UI de viajes/envíos, sin invadir archivos A.
- Mantener PR #8 DRAFT y verificar workflows sobre SHA final de cada corte, sin afirmar 3/3 GREEN antes de completarse.
