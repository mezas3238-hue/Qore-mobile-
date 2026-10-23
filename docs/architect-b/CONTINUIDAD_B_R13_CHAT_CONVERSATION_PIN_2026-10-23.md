# QORE Mobile / Movete Fácil — Arquitecto B R13 · Chat ligado a conversación exacta

**Fecha:** 23-oct-2026, Paraguay. **PR #8** `feature/mobility-cliente-admin-parallel-20261022` **DRAFT**; base PR #7 A. **No merge, producción, despliegues, pagos reales, VPS, secretos ni PII real.**

## Continuidad obligatoria
Revisar antes de editar los handoffs B R3→R11 en `docs/architect-b/`, el avance R12 registrado en PR #8 y el [issue de coordinación A/B #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9). Nunca reiniciar ni pisar ficheros del Arquitecto A. Responsabilidad exclusiva B: `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`.

## Estado previo verificado R12
Commit B `f1c9e936c18a59bfcf48383a1268a3b1e71d2303`: bandeja `/conversaciones` conserva temporalmente la última lista verificada si falla la red, muestra `stale` y **deshabilita abrir chats**, paginación y cachés cuando TTL, JWT, autorización o revisión no son válidos. Cliente **453/453** y Admin **185/185** PASS; workflows de aislamiento/propiedad/QA SUCCESS. Chat HTTP real todavía no existe.

## Avances publicados en R13

### 1. [`00344220`](https://github.com/mezas3238-hue/Qore-mobile-/commit/00344220ab560a8058d617286de2f8bbf93257af)
**Seguridad de hilo exacto y protección ante reasignación**:
- `passenger-chat-flow.mjs`: `open({serviceId, serviceKind, expectedConversationId?})`; la identidad esperada se valida como UUID, se compara contra el `conversationId` realmente recibido por la lectura del servidor y se revalida en páginas antiguas. Un hilo distinto es rechazado con `INVALID_CHAT_PAGE` y la memoria del chat se limpia.
- `snapshot().conversationId` expone únicamente el hilo actual previamente validado o el contexto estrictamente necesario para reconciliar una solicitud idempotente. Sin conversación autorizada se entrega `null`.
- `app/conversaciones.tsx` ahora pasa `conversationId` exacto en el enlace `/mensajes`; `mensajes.tsx` valida el parámetro y no intenta abrir chats con referencias manipuladas. Se compara **servicio + tipo + conversación** antes de mostrar mensajes o editor. El botón de un nuevo hilo no muestra contenidos del hilo anterior.
- `passenger-chat-navigation.mjs` incorpora `conversationId` a la clave privada de montaje React para borrar el borrador incluso si cambia solamente el conductor/hilo del mismo envío. Los enlaces directos desde un historial sin `conversationId` mantienen el GET autoritativo del servidor, pero NO se consideran autorización.
- `client-experience.d.mts` actualizada y +5 pruebas: hilo incorrecto, paginación de hilo diferente, UUID manipulado, historial sin referencia y remount de borrador.
- [CI de este SHA](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs?query=head_sha%3A00344220ab560a8058d617286de2f8bbf93257af): separación B, Admin y Cliente/Driver SUCCESS.

### 2. [`407f093d`](https://github.com/mezas3238-hue/Qore-mobile-/commit/407f093d8b2cd875f8eb3849078965969ae24c6d)
**Revocación de avisos y UX ante reasignación**:
- `client-experience.mjs`: si la certificación del chat no está activa, limpia inmediatamente el almacén de hints; no reanima avisos cuando el gate vuelva a habilitarse. Rechazar un hint durante revocación también borra avisos previos.
- `app/mensajes.tsx` indica al pasajero que debe actualizar `Mis conversaciones` cuando cambió la asignación/hilo.
- +2 pruebas de privacidad del almacén de hints.
- [Cliente + Driver + aislamiento #40032556853 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40032556853): **460/460 Cliente PASS**, TypeScript + Expo web export Cliente/Driver y aislamiento SUCCESS.
- [Admin Web #40032556387 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40032556387): **185/185 PASS**, TypeScript/build SUCCESS.
- [Architect B ownership #40032556404 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40032556404).
- Ejecución adicional aislamiento `#40032552484` SUCCESS. **Total QA 645/645 PASS**. Estas son pruebas de dominio y exportación web, **no Android/iOS nativo ni conversación real**.

## Integración y dependencia Arquitecto A

Último PR #7 consultado: HEAD `201a687abf68df13b4947296f230b53b2f361fd6`, OpenAPI `1.0.0-g48`, 57 rutas, **0 `chat/message/conversation`**. No confundir Driver inbox de ofertas con mensajes. A tiene que construir en su área:
1. Conversación inmutable `conversationId` vinculada a usuario Passenger, ID de servicio RIDE/DELIVERY/MERCHANT_ORDER y Driver/repartidor realmente asignado, con JWT/RLS y revalidación en **cada** lectura/escritura.
2. Ante **reasignación**, invalidar conversación anterior, emitir nuevo `conversationId`, prohibir reutilizar hilos viejos, colisiones de mensajes y respuestas de un Driver anterior.
3. PostgreSQL de mensajes idempotentes por `requestKey`, confirmación de `serverStored:true` después del commit durable, cursor opaco firmado/ordenado y permisos TTL.
4. Inbox y respuesta nativos de **app Driver separada**, push genérico con privacidad y políticas antiabuso; ninguna notificación concede autorización.
5. Acordar contrato OpenAPI exacto con B a través de [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9), comprobar runtime STAGING real y tests E2E cross-account, reassign, split-brain y fail-closed. **B no inventará rutas ni activará el chat** antes de esto.

## Siguiente trabajo B — sin detenerse salvo bloqueo real

1. Validar CI del HEAD posterior a este documento y arreglar posibles errores en área B; registrar métricas exactas.
2. Ejercitar pruebas de flujo/estado al rotar JWT durante navegación entre dos conversaciones del mismo envío; timeout tardío y control de `requestKey` pendiente.
3. Corregir render UI bajo conexión intermitente y probar accesibilidad Android/iOS; no declarar certificados móviles nativos por Expo web export.
4. En cuanto A publique rutas reales, implementar gateway autenticado HTTPS STAGING pinned, pruebas con Driver auténtico y revisiones de seguridad. Hasta entonces avanzar en partes B independientes.

**Mandato Owner:** dos apps totalmente distintas, Cliente ≠ Driver; atender entregas de autos y motos y pedidos comerciales, sin techo arbitrario global de registros ni conversaciones, sin merge/LIVE hasta aprobación expresa.
