# Movete Fácil · Arquitecto B · Continuidad R21–R22: privacidad y orden del chat

**Corte:** 23-oct-2026 (Paraguay), PR #8 DRAFT, rama `feature/mobility-cliente-admin-parallel-20261022`.
**Áreas permitidas:** `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`. No merge, VPS, LIVE, PSP, datos/documentos reales ni secretos.

## Punto de partida verificado
- R20 en [`bce9638a`](https://github.com/mezas3238-hue/Qore-mobile-/commit/bce9638a33d3015b3d7a3ea85cb6e48b298c3a6e): tres workflows SUCCESS, 479/479 pruebas Cliente y 185/185 Admin. Último documento R18–R20 [`50beedb0`](https://github.com/mezas3238-hue/Qore-mobile-/commit/50beedb0b34ad4a81ee5487dc99683a1ce7d2ea6): tres workflows SUCCESS confirmados después.
- Handoff integral de Arquitecto B R1–R13, historial y R14–R20 permanecen en `docs/architect-b/**`.

## R21 · Eliminar referencia duplicada a cuerpos privados
- **Problema:** `validPage()` ya copiaba cada mensaje a `state.messages`, pero se guardaba además el DTO completo con `messages[]` dentro de `state.header`. La purga por TTL R18 vaciaba `state.messages` pero, si existía un ACK incierto, `state.header.messages` retenía en RAM una copia del historial. La UI la ocultaba; eso no garantizaba eliminación física.
- **Corrección:** [commit `ff8c45dd`](https://github.com/mezas3238-hue/Qore-mobile-/commit/ff8c45dd2604ddbc7d3910875f1fe6c48b4974c4), `passenger-chat-flow.mjs`: proyección `authorizationHeader` limitada a `conversationId, serviceId, serviceKind, ownerId, expiresAt, revision` en primeras lecturas y revalidación tras TTL. No almacenar ni un mensaje ni un cursor en ese encabezado.
- **Pruebas regresivas:** [commit `665f7fd1`](https://github.com/mezas3238-hue/Qore-mobile-/commit/665f7fd15e0f28028ee2a7611764a668ab820a25): aseguran paginación, POST confirmado y reconciliación idempotente con mismo `requestKey` tras expirar TTL. Limitación: prueba funcional en Node; la eliminación de referencias se fundamenta además en revisión de estructura de datos, no en medición de heap nativo.
- **CI SHA `665f7fd1` VERIFICADA:** [Cliente/Driver+aislamiento #40047308746](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047308746) SUCCESS, Cliente **481/481 PASS, 0 FAIL**, TypeScript y Expo web exports SUCCESS; [Admin #40047308735](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047308735) SUCCESS; [ownership #40047308734](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047308734) SUCCESS. Admin conservaba 185/185 PASS. Total de suites QA 666.

## R22 · Orden cronológico de páginas de mensajes
- **Riesgo:** `validPage` admitía mensajes internamente desordenados, y `open({older:true})` no comprobaba que el primer mensaje de la nueva página fuese tan antiguo como el último de la ventana autorizada. Un backend inconsistente podía insertar mensajes supuestamente antiguos por encima de otros.
- **Corrección:** [commit `eb86c202`](https://github.com/mezas3238-hue/Qore-mobile-/commit/eb86c202312741600e4e7e54eebeccb5d8775bf2). Una página debe ser no creciente en `createdAt`, y la página `older` no puede empezar con un mensaje más reciente que el último visto. Tiempos iguales siguen admitidos (falta desempate servidor definido por A). Ante inversión entre páginas: error `CHAT_MESSAGE_ORDER_VIOLATION` y purga privada.
- **Pruebas:** [commit `636d6fe1`](https://github.com/mezas3238-hue/Qore-mobile-/commit/636d6fe1f27330ad908f66ce0d33dbc59df0f066): página internamente invertida, página antigua que inserta un mensaje reciente, orden válido incluyendo timestamp igual.
- **CI del código SHA `636d6fe1`:** [aislamiento+Cliente+Driver #40047404023](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047404023), [Admin #40047403981](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047403981), [ownership #40047404029](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047404029). Comprobar resultados finales y logs antes de afirmar número de pruebas R22.

## Dependencia A actual (sin inventar producción)
OpenAPI rama A `feature/mobility-monorepo-isolated-20261016` en G50, 59 paths y chat POST abrir + GET/POST mensajes, pero `x-qore-runtime-wired:false`, `x-qore-qa-only:true`: **sin endpoint HTTPS real operativo para teléfonos**. DTO G50 usa `seq/nextAfter/senderId/createdAt` ISO, mientras B exige autoridad verificada por sesión, `revision`, `senderRole`, cursor seguro y ACK correlacionado por `requestKey`. La coordinación P0 está en [issue #9, comentario técnico R20/G50](https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6377609964).

## Próximos pasos inmediatos
1. Validar CI R22 y resolver errores exclusivamente en archivos B.
2. Auditar invariantes de selección desde Inbox/historial/seguimiento y borrado de borrador al cambiar `sessionRevision`/servicio/conversación; pruebas negativas de carrera de pantallas.
3. Definir con A orden/dirección de `seq` y su relación con `createdAt`, estabilidad del snapshot y empate, autorización server-side e idempotencia. **No conectar gates** hasta A certifique endpoints reales STAGING con JWT/RLS y dos usuarios sintéticos.
4. Seguir Cliente/Admin: accesibilidad, reintento offline sin doble cobro/mensaje, pruebas nativas Android/iOS una vez disponible entorno. Lovable es interfaz posterior; no confundir Expo export con app lista.
5. Mantener ramas y PR #7/#8 en DRAFT; no modificar rutas de Arquitecto A ni datos reales.

**Mandato Owner:** avance continuo salvo bloqueo real. Toda evidencia de GitHub aquí se limita a los SHAs/runs explícitamente referidos.
