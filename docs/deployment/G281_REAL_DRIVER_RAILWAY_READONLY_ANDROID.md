# G281 — Driver Auth real → Railway → Supabase (STAGING, sin escrituras)

## Qué está verificado antes de ejecutar
- QA G275/G261: ocho cuentas independientes y ocho sesiones revocadas.
- QA G278: Passenger + Driver + owner_admin reales contra Railway; acceso ajeno denegado y token revocado rechazado.
- SQL G280 instalado en Supabase PG17 `mrjzxftsdxzepzbcuids`: los cuatro Driver tienen 0 documentos y licencia revisada=FALSE. Solo `service_role` ejecuta las dos RPC.
- CI de G281: mocks, sin secretos ni acceso de red. No sustituye una ejecución real.

## Operación desde Android Codespaces
El **mismo** Codespace donde corrió G275 y G278 debe conservar el manifiesto privado original `$HOME/.qore-qa-private/actors.json` con permisos restrictivos. Nunca imprimir, adjuntar ni subir el manifiesto, JWT, claves o contraseñas. No volver a ejecutar G275 `--apply`.

```bash
git fetch origin &&
(git switch integration/qore-g281-driver-real-qa-railway-readonly-20261031 ||
 git switch --track origin/integration/qore-g281-driver-real-qa-railway-readonly-20261031) &&
git pull --ff-only &&
QORE_QA_DRIVER_READONLY_APPROVED=CONFIRM_READ_ONLY_STAGING \
node apps/mobility-expo/scripts/g281-real-driver-railway-readonly.mjs --verify
```

El operador ya tiene `QORE_STAGING_PROJECT_REF=mrjzxftsdxzepzbcuids`,
`QORE_MOBILITY_ENV=staging`, `LIVE_TRIPS_ENABLED=false`,
`QORE_STAGING_ANON_KEY` y `QORE_QA_MANIFEST_FILE` configuradas desde G278.
**No** establecer `QORE_QA_ACTORS_JSON`. Si cambió de Codespace, restablecer los secretos por canales privados, nunca por terminal con `echo`.

## Solución del diagnóstico \`G281 BLOCKED\` en Android

Si se reabre o reinicia Codespaces, las variables que se exportaron solo
dentro del terminal anterior pueden desaparecer aunque el archivo privado
siga existiendo. El nuevo operador G281 emite **únicamente** códigos
constantes sin revelar secretos:

- \`G281_PRIVATE_MANIFEST_PATH_MISSING\`: la variable de ruta no está exportada.
- \`G281_PRIVATE_MANIFEST_UNREADABLE_OR_INVALID\`: ruta inexistente, sin acceso
  o manifiesto no legible, sin decir cuál.
- \`G281_STAGING_PROJECT_REF_MISSING_OR_DIFFERENT\` y
  \`G281_STAGING_ENVIRONMENT_REQUIRED\`: restablecer STAGING.
- \`G281_LIVE_TRIPS_MUST_BE_DISABLED\`: \`LIVE_TRIPS_ENABLED=false\`.
- \`G281_PUBLIC_KEY_MISSING_OR_INVALID\`: restaurar la clave **pública**
  de Codespaces Secrets, sin imprimirla ni enviarla por chat.
- \`G281_PRIVATE_OPERATOR_HOST_REQUIRED\`: no ejecutar en CI/Railway.

En el Codespace autorizado se pueden restaurar solo las variables que no
son secretos (el script no lee ni publica el contenido del manifiesto):

\`\`\`bash
export QORE_STAGING_PROJECT_REF=mrjzxftsdxzepzbcuids
export QORE_MOBILITY_ENV=staging
export LIVE_TRIPS_ENABLED=false
export QORE_QA_MANIFEST_FILE="$HOME/.qore-qa-private/actors.json"
git pull --ff-only
QORE_QA_DRIVER_READONLY_APPROVED=CONFIRM_READ_ONLY_STAGING \
  node apps/mobility-expo/scripts/g281-real-driver-railway-readonly.mjs --verify
\`\`\`

Si aparece \`G281_PUBLIC_KEY_MISSING_OR_INVALID\`, comprobar únicamente
que \`QORE_STAGING_ANON_KEY\` esté disponible en el terminal, sin imprimirla.
**No volver a ejecutar \`--apply\`, no modificar Auth ni cambiar a Live**.
Después del preflight, los errores HTTP aparecerán como JSON con \`code\`.


## Resultado esperado
```json
{"ok":true,"mode":"G281_DRIVER_READONLY_BRIDGE","realSessionsVerified":2,"driverDocumentsEmpty":true,"licenseApprovalDenied":true,"passengerAccessDenied":2,"revocationVerified":true,"externalJourneysCertified":0,"commercialEnabled":false}
```

Esto demuestra 401 anónimo, 200 Driver para consulta de documentos vacíos y licencia pendiente, 403 Passenger y 401 tras revocar sesión Driver. **No** aprueba conductor ni acredita 5 recorridos E2E. Si la salida contiene `"ok":false`, no reintentar a ciegas ni forzar permisos: registrar únicamente el código de fallo y revisar backend/RPC, manteniendo STAGING bloqueado. No desplegar G269/113, pagos ni LIVE a partir de esta prueba.
