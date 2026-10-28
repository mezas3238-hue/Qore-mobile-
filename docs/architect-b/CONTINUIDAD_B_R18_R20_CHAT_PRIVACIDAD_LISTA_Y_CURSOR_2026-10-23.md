# QORE Mobile — Arquitecto B R18–R20 · Privacidad, rendimiento y expiración de cursores

**Fecha:** 23-oct-2026 Paraguay. **PR #8 DRAFT**, rama `feature/mobility-cliente-admin-parallel-20261022`, sin merge, despliegue, VPS, pagos reales ni documentación privada. Continuación de [R17](./CONTINUIDAD_B_R17_CHAT_ACK_REVISION_CURSOR_2026-10-23.md) y [Handoff maestro R1–R13](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md). Edición exclusiva B: `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`.

## Implementaciones publicadas

### R18 — borrado efectivo del historial al expirar permiso
- [`85e136d6`](https://github.com/mezas3238-hue/Qore-mobile-/commit/85e136d691a2d5fdd51f1d8d7f802d1c765e0e46): `passenger-chat-flow.mjs` borra físicamente filas y cursores locales vencidos incluso con un `pendingSend`. Solo retiene el contexto mínimo del intento ambiguo (misma clave y cuerpo pendiente + identidad de hilo) para que `retryPending()` revalide antes de contactar al backend.
- [`b07663a2`](https://github.com/mezas3238-hue/Qore-mobile-/commit/b07663a2fc9c66da3b55d73dfeec5446a9410179) y [`69b97d92`](https://github.com/mezas3238-hue/Qore-mobile-/commit/69b97d92f31a3919011011cad73a5e5d1fa72fc2): dos pruebas adversariales: la memoria purgada NO reaparece ni si retrocede el reloj; una lectura antigua en vuelo pierde autoridad si la autorización local expira.
- **CI del corte R18 `69b97d92`:** [Cliente/Driver/aislamiento #40045539968](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40045539968), [Admin #40045539951](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40045539951), [boundary #40045539961](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40045539961) 3/3 SUCCESS. **Cliente 477/477 PASS**, Admin **185/185 PASS**, 662 tests de QA.

### R19 — FlatList nativa virtualizada
- [`d72fcbea`](https://github.com/mezas3238-hue/Qore-mobile-/commit/d72fcbea3c2997cca59a3e26343004319d50ee6c) cambia `app/mensajes.tsx` de `ScrollView` que montaba todas las filas a `FlatList` con `initialNumToRender=12`, `maxToRenderPerBatch=18` y `windowSize=7`. Conserva validación exacta de `serviceId/serviceKind/conversationId`, semántica `pendingSend`, exclusión de mensajes cruzados, accesibilidad de avisos y paginación de servidor sin límite global.
- CI de este corte: [isolation #40045605009](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40045605009), [Admin #40045604998](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40045604998), [boundary #40045604999](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40045604999) **3/3 SUCCESS**, Cliente **477/477 PASS**, TS + Expo web export y Admin build. **No equivale a rendimiento medido en Android/iOS físicos.**

### R20 — cursor cuya autorización vence durante la red
- [`68924ea3`](https://github.com/mezas3238-hue/Qore-mobile-/commit/68924ea3e733184ef442d4e250ad0a12da92bd06): en `passenger-chat-flow.mjs`, al resolver `older:true`, bloquear si el TTL de la autorización de página anterior venció durante el GET, aunque la respuesta nueva alegue TTL fresco.
- [`47674f93`](https://github.com/mezas3238-hue/Qore-mobile-/commit/47674f93d35963c0d89c5ad34a1698ed0dc6b576): `passenger-chat-inbox.mjs` hace lo mismo para `load({next:true})`. Los fallos purgan la cadena privada, sin cursor reciclado ni capacidad falsa de abrir un hilo.
- [`26c1a980`](https://github.com/mezas3238-hue/Qore-mobile-/commit/26c1a980591344b5d378a82e968d84113544171a) y [`bce9638a`](https://github.com/mezas3238-hue/Qore-mobile-/commit/bce9638a33d3015b3d7a3ea85cb6e48b298c3a6e): dos pruebas de red sintética atrasada con reloj avanzado durante GET.
- CI R20: [isolation #40045730806](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40045730806), [Admin #40045730790](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40045730790), [boundary #40045730970](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40045730970). Revisar **conclusión final del mismo SHA** antes de declarar 479/479 tests o 664/664. Al publicar este informe, boundary y Admin estaban SUCCESS, isolation seguía ejecutándose.

## Cambio real en la dependencia A: OpenAPI G50

Lectura directa de rama A `feature/mobility-monorepo-isolated-20261016`, blob OpenAPI `dd7400e6c1175ced78bd8583a9607134bc9196d2`:
- `1.0.0-g50`, 59 rutas. Incluye POST `/v1/staging/chat/services/{serviceKind}/{serviceId}/conversation` y GET/POST `/v1/staging/chat/conversations/{conversationId}/messages`.
- **`x-qore-runtime-wired:false` / `x-qore-qa-only:true`**, por tanto **NO se pueden llamar desde las apps**, no hay chat disponible en teléfonos.
- DTO de A usa `seq/nextAfter`, `senderId`, fecha ISO y ACK sin `requestKey` explícito; B usa revisión monotónica, `senderRole`, timestamp de milisegundos, cursor opaco y ACK correlacionado. Sin adapter aprobado no activar HTTP.
- Solicitud de interoperabilidad y correcciones al Arquitecto A documentada en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6377609964). A conserva autoría exclusiva de su servidor, SQL, JWT/RLS y Driver.

## Próximos pasos B, continuos

1. Confirmar CI R20 final y corregir únicamente dentro de B si falla.
2. Auditar interacción Cliente de `historial`/`seguimiento` y navegación hasta chat con sesión rotada, TTL y cambio de asignación.
3. Preparar adapter HTTP estricto **solo después** de respuesta contractual de A; sin inventar URL real, sesión JWT de QA, campos autorizables ni mapa de identidades. Coordinar respuesta idempotente `requestKey` y cursores consistentes.
4. Verificar accesibilidad y rendimiento en teléfonos Android/iOS cuando haya dispositivos y autorización; Expo web export NO sustituye QA física.
5. Seguir UI/admin B independiente si A no ha completado endpoints sin editar sus rutas ni detener el proyecto.

**Verdad operativa:** backend G50 tiene código/contrato QA, todavía NO runtime certificado; Cliente, Driver y Admin NO son apps desplegadas o listas para cobros. Sin MERGE, LIVE, PII, secretos o PSP reales hasta mandato Owner.
