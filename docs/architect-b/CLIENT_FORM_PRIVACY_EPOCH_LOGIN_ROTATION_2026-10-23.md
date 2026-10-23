# QORE Mobile — Cliente B: frontera de privacidad de formularios
23/10/2026 · QA sintético · PR #8 DRAFT

## P0 corregido
Las vistas `app/viaje.tsx` y `app/envios.tsx` mantenían direcciones, peso, medidas y preferencias en `useState`, borrándolos sólo cuando cambiaba el *subject* público. La pantalla `app/soporte.tsx` no había integrado ninguna señal de sesión y conservaba la descripción de práctica. Un logout, nuevo login del mismo usuario o renovación de JWT con idéntico subject podía dejar datos locales visibles.

## Implementación
En `client-session.mjs` se separa `privacyEpoch` de `epoch` de operaciones. Su propiedad pública es sólo un contador seguro (`privacyRevision()`), incrementado al iniciar una identidad, rotar JWT/caducidad, cambiar cuenta, cerrar/caducar/revocar la sesión. Un refresh idéntico deja el contador estable: no elimina rutas si no cambia la autenticación.
`client-experience.snapshot()` publica `privateViewRevision` tanto autenticado como desconectado, **sin JWT, dirección ni texto**.
Las tres pantallas usan un componente de formulario interno con `key={view.privateViewRevision}`. React lo desmonta sin renderizar el estado anterior en la identidad nueva (a diferencia de limpiar con `useEffect` después de render). No se usa almacenamiento persistente, telemetría ni envíos automáticos.

## Evidencia
Pruebas del controlador: login, refresh idéntico, rotación del mismo usuario, cambio de cuenta, logout, expiración. Pruebas de composición aseguran la revisión creciente y cero token en snapshots. Las builds Expo y TypeScript validan las tres pantallas. No implica pruebas Android nativas ni IAM real.

## Límites
Backend A sigue requiriendo JWT real, autorización STAGING y precotización sin despacho. Driver/Admin no se modifican. NO MERGE / NO LIVE.