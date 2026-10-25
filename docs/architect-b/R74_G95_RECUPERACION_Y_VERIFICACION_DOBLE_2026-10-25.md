# Arquitecto B R74 — Recuperación segura de G95 y doble verificación G4/G94

**Prioridad funcional AUTO:** corregir un bloqueo real encontrado en R73.
Tras un POST G95 ambiguo, la app ocultaba el GET de recuperación cuando la
última lectura G4 superaba 60 s o cuando G4 ya decía cancelled. R74 desacopla:
- Preparar/enviar G95: exige Booking G73 del Owner + G4 vigente (<=60 s)
  y estado searching/assigned/arriving, con confirmación humana.
- Recuperar un ACK perdido: requiere recibo privado de booking (mismo
  owner/bookingKey/tripId/quoteId, sesión JWT), **no** lectura G4 reciente.
  Solo GET G95 con la requestKey original en RAM; NO hace otro POST.
- Tras recibir G95 (POST o GET), acción explícita de verificación con
  **GET G4** para confirmar tripState=cancelled y revision>=G95 y
  **GET G94** para certificar VOIDED_QA y asiento balanceado del mismo
  bookingKey/tripId/quoteId y montos G93.
- Si cualquiera de las dos lecturas falla, Cliente mantiene G95 confirmed
  pero NO muestra el distintivo independentlyVerified. Nunca declara
  PSP cobrado/refund ni revive un pedido.
- JWT rotado, propietario distinto, recibo ajeno, revocación o pérdida
  de contrato invalidan la vista; las pruebas sintéticas lo comprueban.

**Alcance honesto:** mejora la recuperación durante la misma ejecución de
la app, incluso si el GET G4 deja de estar fresco. Un **reinicio completo**
borra la clave G95 de memoria; G26 history incluye solo serviceId/kind/status,
createdAt/revision, no bookingKey. Hace falta que A agregue una consulta
propia que permita relacionar tripId con bookingKey (con autorización) antes
de prometer recuperación post-reinicio.

**Gates QA:** G73/G93/G94/G95 y G4 todos requieren el runtime externo,
Auth y PostgreSQL certificados. CI sintética no es producción ni build
instalable. Sin merge, LIVE, gastos ni redes nuevas.
