# A03 — firma dedicada y rotación del cursor privado de historial

**QORE Mobile / Movete Fácil · Arquitecto A · 2026-10-23 · QA exclusivamente.**

El código anterior de \`g4-staging-runtime.mjs\` utilizaba el material \`serviceKey\` para firmar cursores de lectura. Desde A03, **la composición falla cerrada** sin \`historyCursorSecrets.current\`, o si éste coincide con la clave pública o con \`serviceKey\`. El gateway G26 firma con \`current\` y puede verificar temporalmente con \`previous\`, sin cambiar el formato público \`v1.<payload>.<mac>\` ni su límite de 200 caracteres: el Cliente de Arquitecto B no necesita duplicar un gateway.

## Entorno y operación permitida

- Inyectar secretos **únicamente en el backend** desde un secret manager autorizado: \`QORE_HISTORY_CURSOR_SIGNING_KEY\` y, durante rotación, \`QORE_HISTORY_CURSOR_PREVIOUS_KEY\`. NUNCA usar \`EXPO_PUBLIC_*\`, frontend, repo o logs.
- Generar la clave aleatoriamente con CSPRNG; **al menos 32 bytes de entropía** por clave, preferentemente representados en base64url. La longitud mínima validada por código **no certifica** automáticamente entropía ni custodia. Ningún secreto real forma parte de GitHub.
- Rotación segura de 2 releases: (1) agregar \`previous=old\`, \`current=new\`; (2) mantener la clave antigua mientras pueden circular cursores válidos (ventana renovada 10 minutos; considerar desfases y clientes offline), después retirarla. La respuesta a un cursor previo se firma con \`new\`. Tras retirar \`old\`, un cliente con cursor histórico recibirá 400 y debe refrescar desde la primera página.
- No reusar secreto de service-role, JWT, Storage ni proveedor PSP; limitar acceso del servidor al secret manager. Registrar solamente el motivo / conteo de rechazos, nunca la cabecera ni el MAC.
- Anomalías MVCC de G26.5 **no cambian**: la rotación firma autenticidad del cursor, pero no ofrece snapshot estable. Leer \`G26_5_HISTORY_MVCC_EVENTUAL_CONSISTENCY_2026-10-23.md\`.

## Evidencia QA y limitaciones

\`g26-rider-history-gateway.test.mjs\` valida que la clave antigua se acepta sólo durante el solapamiento, que la salida vuelve a firmarse con la nueva y que un gateway old-only o new-only rechaza la clave incorrecta. \`g4-staging-runtime.test.mjs\` rechaza ausencia, colisión con secretos de servicio y rotación inválida. Los dos HTTP test fixtures usan exclusivamente claves sintéticas.

**No equivale a secret manager instalado, Auth real, endpoint HTTPS público, sesión Admin/Owner ni aplicación operativa.** Sin permiso Owner, todo permanece en QA local y CI.
