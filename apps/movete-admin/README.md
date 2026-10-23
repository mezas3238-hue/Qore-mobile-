# Movete Fácil Admin — web independiente (Arquitecto B)

Interfaz React/TypeScript/Vite **solo web**, separada de Cliente y Driver.

Estado inicial: UI de QA, **no es panel operativo**. Todo aparece como "Sin conexión" hasta recibir backend Admin y Auth auditados por A (issue #9). No se almacenan credenciales, PII, claves de servicio, cookies ni documentos; no existen llamadas de red desde las pantallas.

## Ejecutar

- Node >=22.13, `npm install` dentro de **este directorio**, sin modificar root.
- `npm run check` comprueba TypeScript + tests de frontera segura.
- `npm run build` genera assets web estáticos, **no hace deploy**.
- `npm run dev` sirve únicamente en localhost.

El módulo `src/admin-access.mjs` contiene un adaptador no conectado: defecto `enabled=false` y `contractCertified=false`. Solo el backend de A puede verificar roles, autorización del revisor y datos. Un contrato en OpenAPI no equivale a endpoint disponible.

Los indicadores son "Sin conexión" y las pantallas no inventan personas, autorizaciones, expedientes, GPS ni dinero. Nunca colocar una clave `service_role` o `sb_secret_*` en el bundle del navegador.

PR #8 DRAFT · carpetas exclusivas B · no merge/live.
