# Movete Fácil — Arquitecto B · R23 borrador privado y reasignación

**Corte de trabajo:** 23-oct-2026 Paraguay, rama `feature/mobility-cliente-admin-parallel-20261022`, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) DRAFT. Sin merge, LIVE, VPS, pagos ni datos privados reales. Alcance únicamente Cliente y docs B.

## Punto de partida constatado

- Documento anterior R21–R22 [`a329e7ae`](https://github.com/mezas3238-hue/Qore-mobile-/commit/a329e7ae48603da19fa2d03a9d681bb625f184ab) tiene tres workflows SUCCESS.
- R22 [`636d6fe1`](https://github.com/mezas3238-hue/Qore-mobile-/commit/636d6fe1f27330ad908f66ce0d33dbc59df0f066) CI del código: 3/3 SUCCESS, **484/484 pruebas Cliente**, **185/185 Admin**, total 669/669 (QA sintética); typecheck y exports web.
- Backend A OpenAPI G50 identifica rutas chat pero `x-qore-runtime-wired:false`; no integrar sin runtime autenticado.

## Hallazgo R23

`apps/movete-cliente/app/mensajes.tsx` usa un `PrivateChat key={passengerChatPrivateViewKey(...)}` para desmontar `draft` y `feedback` cuando cambia JWT, servicio o conversación. La navegación desde `historial` no pasa `conversationId` (por diseño: el historial no autoriza asignación). Anteriormente el key se basaba solo en `sessionRevision + serviceKind + serviceId + NO_THREAD`. Si A reasigna un Driver en el mismo servicio, el servidor puede proporcionar **conversationId nuevo** sin cambiar URL, servicio ni revisión de sesión. El `draft` del hilo anterior podía persistir y ser enviado al nuevo asignado.

## Cambios publicados
1. [`39d395ce`](https://github.com/mezas3238-hue/Qore-mobile-/commit/39d395ce7cb599da8903c727038b911586d55b68): `passenger-chat-navigation.mjs` amplía `passengerChatPrivateViewKey` con `authorizedConversationId`, `authorizedServiceId`, `authorizedServiceKind`, `authorized`. Cuando la URL **no** fija hilo, vincula el key al ID autorizado por el servidor **solo si** hay sesión válida, el servicio coincide, el tipo coincide, hay `authorized:true` y UUID válido. En enlaces que ya fijan `conversationId` nunca toma prioridad una segunda referencia.
2. [`728edfe5`](https://github.com/mezas3238-hue/Qore-mobile-/commit/728edfe5c83c23c14f9e605c4e7fb2bb3de591f0): `app/mensajes.tsx` suministra exclusivamente `view.chat` con `view.authenticated && view.chat.contractReady && view.chat.active` y coincidencia de servicio a la clave React. Reasignar provoca desmontar editor y limpiar el texto de otro Driver **sin usar timeout ni useEffect tardío**.
3. [`f7b5102a`](https://github.com/mezas3238-hue/Qore-mobile-/commit/f7b5102a8fc67e9e3c9954a2284a3f0257586804): cuatro pruebas: cambio de hilo para el mismo servicio/JWT, ignorar otro servicio/tipo/autorización revocada, URL explícita no reemplazable por ID ajeno, sesión inválida nunca monta editor de otro hilo.

## CI y siguientes acciones
- CI del SHA R23 `f7b5102a`:
  - [Cliente/Driver y aislamiento #40047684985](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047684985)
  - [Admin #40047685064](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047685064)
  - [Ownership #40047685069](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047685069)
  - **Verificar conclusión y conteos exactos antes de afirmar PASS R23**. Al publicar estaban en cola.
- Confirmar TypeScript/Expo web export de Cliente; si falla, corregir rutas B solamente. La prueba de `key` es de función pura; una prueba E2E React Navigation/Android de remount sigue pendiente hasta contar con entorno nativo.
- Auditar cambio de conversación durante red/TTL, mensajes pendientes, y guardas de permiso en UI/Admin sin habilitar producción.
- Coordinar con A contrato G50/G51 en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9), incluido DTO `revision`, `senderRole`, `requestKey` y cursores monotónicos; no inventar adapter ni endpoint HTTPS.
- Mantener separación Cliente/Driver/Admin, PR #7/#8 DRAFT, no merges.

**No se usa LIVE ni se afirma conversación real entre teléfonos.** La UI y gateway de Cliente permanecen cerrados hasta STAGING autenticado con A.
