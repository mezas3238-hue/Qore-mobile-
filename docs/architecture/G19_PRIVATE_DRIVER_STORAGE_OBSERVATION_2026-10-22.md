# QORE Mobile / Movete Fácil Driver — G19: comprobación privada de archivos

**Arquitecto A** · Rama `feature/mobility-monorepo-isolated-20261016` · PR #7 DRAFT.

**Estado:** infraestructura y pruebas sintéticas; **no se han subido documentos reales, no hay un escáner de malware conectado, no hay despliegue y no se ha aprobado LIVE**.

## Problema

G17 admitía el registro de referencias a documentos privados mediante un adaptador `observePrivateObject`. El runtime anterior solo contenía un adaptador que rechazaba todo: correcto para no aceptar archivos falsos, pero sin una comprobación implementada de bytes y revisiones. G19 entrega una implementación **condicionada a componentes verificados del servidor**, sin confiar en datos proporcionados desde el celular.

## Contrato de G19

`apps/mobility-expo/server/g19-private-driver-evidence-observer.mjs` exporta:

`createVerifiedPrivateDriverEvidenceObserver({getObjectMetadata, downloadObject, scanBytes})`

Los tres adaptadores se inyectan **desde el servidor**, nunca desde el cliente, y no existen implementaciones permisivas por defecto.

1. `getObjectMetadata({bucketId,objectKey})` obtiene una ficha independiente del objeto. Debe devolver `bucketId='mobility-staging-driver-evidence'`, `public=false`, `ownerId` igual al actor verificado, `objectKey`, `objectId` UUID, `version` no vacía y **que cambie en cada sobrescritura**, `byteSize` (máx. 5 MiB) y `mimeType` JPEG/PNG.
2. `downloadObject({bucketId,objectKey,version,maxBytes})` descarga exactamente la **revisión solicitada** y devuelve `{bytes:Uint8Array,version}`. Si la infraestructura de Storage no soporta fijación de versión, **no conectar este adaptador**.
3. G19 coteja longitud real y cabecera JPEG/PNG, calcula SHA-256 en el servidor y llama `scanBytes({bytes,sha256Hex,mimeType})`. El escáner externo debe **decodificar** y analizar la imagen; una coincidencia de cabecera no basta. La respuesta requiere `verdict='clean'`, SHA idéntico y nombre válido del motor.
4. Repite `getObjectMetadata` y compara versión, bucket, propietario, ID, tamaño, tipo y privacidad. Si cambia algo, rechaza.
5. Devuelve exclusivamente `serverObserved=true`, `malwareScanPassed=true`, `ownerId`, `storageBucket`, `objectKey`, `mimeType`, `byteSize`, `sha256Hex`, necesarios para el RPC G17. El cliente recibe solo `documentId`, estado `pending` y `driverEligible=false`; jamás recibe bytes, hash o ruta a través de una respuesta KYC.
6. Borra la copia temporal del buffer usada para inspección y oculta detalles sensibles de excepciones al cliente.

**Importante:** las etiquetas `serverObserved` y `malwareScanPassed` son el resultado de la función G19 después de sus comprobaciones, no flags aceptados del teléfono.

## Conexión al runtime

`g4-staging-runtime.mjs` recibe `privateEvidenceAdapters=null` por defecto. Así G17 sigue **bloqueado** sin Storage y escáner confiables. Cuando un proveedor real haya sido elegido, el proceso local de STAGING debe inyectar los tres adaptadores, y G19 construirá el observador seguro.

Se retiró la opción genérica de sustituir el observador por `observePrivateObject` sin comprobación en el runtime. No se modifican ni publican rutas de Supabase, credenciales, hashes reales ni objetos personales.

## Endurecimiento SQL y categorías

En `G17_PRIVATE_DRIVER_DOCUMENTS_POSTGRES_CI_ONLY.sql`:
- Solo **`licencia`** puede registrar referencias hasta que se auditen y apliquen las políticas privadas de subida para las demás categorías. El bucket G1 actual únicamente permite licencias; no se abren identidades, seguros ni documentos del vehículo por accidente.
- `service_role` solo puede modificar las columnas **status/reviewer_id/reviewed_at** de la tabla de evidencias; no puede editar después propietario, llave de objeto, SHA-256, categoría o tamaño.
- La tabla de decisiones administrativas es append-only. Pasajeros y conexiones anónimas no tienen acceso SQL directo. Registro o aprobación de evidencia no habilitan viajes.

## Pruebas y limitaciones

- `g19-private-driver-evidence-observer.test.mjs`: propietario distinto, bucket público, MIME falso, revisión cambiada, longitud incorrecta, objeto remplazado, virus o escáner ausente, rutas inválidas y bytes sintéticos JPEG/PNG.
- `g19-evidence-to-g17-integration.test.mjs`: integración completa con el gateway G17; **solo una verificación limpia** puede crear un registro `pending`. Se prueban las negativas sin tocar la base.
- PostgreSQL desechable: privilegios por columna, rechazo de categorías sin política de Storage, propietario, auditoría y reintentos de registro.

**El escáner de las pruebas es un doble sintético `TEST_ONLY_SCANNER`; NO debe utilizarse en ningún entorno real.** Los ficheros JPEG/PNG de pruebas son bytes mínimos preparados para ejercitar contratos, no documentación legítima ni una prueba de seguridad de formato. No hay autorización para activar la conexión a un proveedor real.

## Pendientes de ingeniería antes de habilitar documentos

1. Elegir/proveer Storage privado en un entorno STAGING autorizado y garantizar acceso servidor a metadatos de propietario y versión **inmutable** del objeto.
2. Elegir un escáner real de malware y decodificación robusta de imágenes, con versiones actualizadas, límites de CPU/memoria y cuarentena.
3. Comprobar conservación/retención, eliminación segura, recuperación, caducidad, auditoría y acceso de revisor independiente.
4. Auditar políticas de nuevas categorías antes de habilitarlas, y definir si requieren almacenamiento y plazo distinto.
5. Integrar Auth real en la app Driver, incluida revocación y consentimiento para uploads; no compartir token entre apps.
6. Ejecución E2E de cargas sintéticas contra STAGING autorizado con observabilidad y bloqueo de operaciones LIVE, más revisión de seguridad.

## Propiedad de archivos

**Arquitecto A:** `apps/mobility-expo/**`, `apps/movete-driver/**`, `docs/architecture/**`, workflows compartidos y SQL. **Arquitecto B:** `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`. Ningún archivo del B debe cambiarse aquí.

No merge, no deploy, no SQL remoto, no operación LIVE, no pagos ni notificaciones reales.
