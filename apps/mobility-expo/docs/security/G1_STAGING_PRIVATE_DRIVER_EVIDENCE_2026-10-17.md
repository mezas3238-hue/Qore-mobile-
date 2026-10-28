# G1-STORAGE — depósito privado de licencias de STAGING (17-10-2026)

**Aplicado y verificado en base Lovable STAGING nueva**: proyecto 9c677bb2-746b-419f-ad9c-dd6d26bab944. No usar contra el proyecto antiguo 2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed.

## Migración aplicada

Archivo: `docs/backend/staging_only/G1_PRIVATE_DOCS_BUCKET_STAGING_ONLY.sql`. La transacción incluye precondición de 0 usuarios Auth, 0 buckets, 0 objetos, ninguna política previa en storage.objects y RLS activa, además de postcondición verificable antes de COMMIT.

Consulta posterior independiente confirmó:

- Bucket: `mobility-staging-driver-evidence`; **public=false**, tope **5242880 bytes (5 MiB)**, allowed MIME **image/jpeg** e **image/png**.
- **Cero usuarios** de Auth y **cero objetos** almacenados.
- INSERT: solo `authenticated`, propietario `owner_id = auth.uid()` y carpeta `storage.foldername(name) = ARRAY[auth.uid()]`; archivo licencia-jpg/png con patrón limitado.
- SELECT: solo usuario autenticado propietario y con carpeta coincidente; roles anon sin política.
- No hay políticas de UPDATE ni DELETE para clientes. El administrador opera a través de servicio privilegiado protegido; jamás se inserta service_role en Expo.

## Qué no ha sido certificado

Faltan dos usuarios ficticios con sesión Auth real, pruebas de carga/acceso cruzado con JWT, simulación de MIME falsificado, validación de bytes real del lado servidor, procedimiento de retención y borrado auditado. El bucket no demuestra autenticidad documental.

La app Expo heredada sigue usando el bucket viejo `driver-docs` y RPC legacy de registro AUTO: no conectar a staging sin reestructurar el adaptador. La categoría MOTO no está autorizada para ofrecer viajes. `LIVE_TRIPS_ENABLED=false`.
