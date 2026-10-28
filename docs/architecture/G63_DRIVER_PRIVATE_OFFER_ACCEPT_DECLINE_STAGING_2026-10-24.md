# QORE Mobile — G63: decisiones Driver seguras e integradas en STAGING

**Arquitecto A · 24 octubre 2026 · PR #7 DRAFT · no merge / no LIVE / no despliegue.**

## Avance funcional

G62 creó una composición Driver que compartía Auth y transporte para estado de conductor, ofertas, KYC y chat, pero la pantalla `app/ofertas.tsx` solo permitía lectura. **G63 integra una decisión manual de aceptación o rechazo** para la oferta privada recibida por el mismo conductor verificado, sin modificar la app Cliente ni el panel Admin del Arquitecto B.

### Cambios reales

- `driver-offer-decision.mjs`: reutiliza las rutas existentes de aceptación de autos y envíos, ahora con opción HTTPS **únicamente** hacia el DNS STAGING autorizado y fijado por el integrador (`approvedStagingHost`, `allowedByOwner:true`). Conserva soporte QA 127.0.0.1, validación de bearer y UUID, payload estricto `{offerId,requestKey}`, prohíbe identidad, GPS, precio o rol aportados por la app, y requiere ACK de decisión emitido por servidor bajo `STAGING_DEMO_ONLY`. No permite habilitar viajes comerciales, incluso cuando el backend respondió 200.
- `driver-offer-actions.mjs` y `.d.mts`: controlador aislado por usuario. Sólo permite decisiones manuales `accept` o `decline` en una oferta activa, documentada en el inbox del usuario, no caducada, con estado de licencia revisado y con origen Auth Driver explícito. Una sola decisión en vuelo, `requestKey` UUID generado por proveedor externo criptográfico y sin exposición del token en snapshot. Sólo muestra **confirmada** una decisión respaldada por ACK consistente con tipo/acción y bandera `liveEnabled:false`.
- Ante un timeout/409 o respuesta malformada, la operación se marca como **resultado incierto**. **No** hay replay automático ni reinterpretación de la desaparición de la oferta en inbox como COMMIT o rollback. Un estado incierto queda bloqueado incluso tras refrescar el inbox; en la UI se indica que es necesario consultar estado/soporte. Se requiere contrato de reconciliación de decisiones del backend antes de permitir una recuperación automática segura. `clear()` invalida la sesión y elimina datos privados en logout/swap.
- `driver-staging-runtime.mjs`: agrega `offerActions` utilizando el **mismo** `apiOrigin` HTTPS STAGING y `makeRequestKey` seguros del chat de G62. No contiene host real, cuentas ni claves.
- `DriverOfferActionsProvider.tsx`: suscrito al Auth Driver y al snapshot del workspace. Invalidación inmediata ante cambio de sesión, y comprobación de `currentLicenseApproved` antes de habilitar botones. No presenta acciones cuando el workspace está offline o carga datos.
- `DriverApplicationProviders.tsx`: integra este provider dentro de la misma aplicación independiente Driver. Su valor por defecto sigue siendo `runtime=null` y por tanto los botones quedan apagados en la distribución actual, mientras no exista un integrador STAGING autorizado.
- `app/ofertas.tsx`: para una oferta privada válida, acciones de aceptación/rechazo de prueba bajo guardas estrictas; muestra enviando, confirmado por backend o resultado incierto. Sin mensajes que sugieran viajes reales ni que el cliente recibió push.

### Evidencia y matriz QA

- `driver-offer-actions.test.mjs`: decisión autoritativa, declinar, caída después de COMMIT, ausencia de replay, vencimiento y oferta de otra sesión, KYC, claves inseguras, respuestas falsificadas y carreras de logout durante generación de UUID/HTTP.
- `driver-staging-runtime.test.mjs`: recorrido integración con los **adapters reales del dominio** `Driver`: sesión Auth, inbox, documentos/licencia, POST HTTPS a `/v1/staging/driver/offers/accept`, cuerpo estrictamente `{offerId,requestKey}`, ACK y timeout perdido. Backend respuesta simulada, no un endpoint desplegado.
- Validación requerida: Node STAGING, PostgreSQL disposable, Expo, aislamiento de las dos apps + TypeScript en un mismo SHA.

### Riesgos y próximos gates

1. Falta una ruta de **consulta de decisión durable** tras pérdida de ACK, similar al G59B chat, para distinguir resultado incierto sin volver a aceptar (nuevo gate recomendado G63B).
2. Siguen pendientes los endpoints HTTPS STAGING reales con IdP/JWT y la base de datos protegida, despacho/aceptación transaccional por asignación/vehículo, GPS en teléfono físico y pruebas E2E Cliente↔Driver.
3. La revisión de licencia STAGING existente aún informa `driverEligible:false`; revisar licencia no equivale a habilitar laboralmente al Driver. El backend, no la app, debe validar KYC total, elegibilidad, zona, vehículo, sesión y caducidad antes de aceptar realmente.
4. Pagos, soporte de emergencias, app store/Android/iOS, comercio y aprobación legal paraguaya siguen abiertos en los 17 gates `MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json`.

**Reglas inalterables:** sólo A en Driver/backend/arquitectura/CI; B conserva Cliente/Admin. No merge, producción, VPS, datos reales, credenciales o PSP sin orden Owner. Los SUCCESS de QA no significan operación comercial.
