# ADR — CRT V34.12X TradingView vs cTrader DEMO: origen de las velas y legitimidad de alertas

**Owner 05-nov-2026 | QORE Mobile + widget existente | QA / NO LIVE / NO MERGE / NO TRADING.**

## Decisión

El Owner detecta un bloqueo arquitectónico: **las velas de cTrader DEMO pueden diferir de las velas de TradingView**, y por tanto un CRT o MSS detectado en cTrader no equivale necesariamente al CRT/MSS que ya reconoce el indicador **V34.12X**. No se habilitará ninguna alerta atribuida al V34.12X sin pruebas de equivalencia de datos y de señal. TradingView V34.12X (34 feeds prefijo `IC:`) continúa siendo la referencia metodológica aprobada.

El repositorio contiene una bandeja **OFFLINE_REPLAY**, con estado `QA_NOT_CONNECTED` / `OFFLINE_REPLAY_ONLY`, y un aviso local explícitamente `NO OPERAR`. **Esto NO es una integración certificada de cTrader DEMO, NO es un push real, NO garantiza llegada con el móvil inactivo.** Mantener tales etiquetas hasta certificación.

## Por qué puede haber divergencia

- Proveedor de datos y cuenta DEMO diferentes; aun con IC Markets en ambas plataformas, feeds/horarios de M5 podrían no coincidir.
- Apertura UTC exacta M5, fase del feed (+0..+4 min), H4 NY, horario de verano, sesiones 24h, fines de semana y gaps.
- Diferencias de OHLC y bid/ask, precisión/tick size; cambios mínimos pueden decidir si hay barrida C1/C2, retorno, pivote MSS o FVG.
- Barra M5 incompleta versus cerrada: comparar exclusivamente velas M5 definitivas, con UTC y proveedor identificados.
- Los eventos y pantallas del chart TradingView no son API de datos. TradingView **Free no incluye alertas técnicas sobre indicadores** según su tabla de planes vigente (05-nov-2026); no se puede emitir eventos de forma nativa desde una `table` Pine sin alerta gestionada por TradingView. No usar scraping, lectura de pantalla ni ingeniería de bypass.

Fuentes: TradingView pricing https://es.tradingview.com/pricing/ ; TradingView Pine data feeds https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/ ; cTrader broker feeds https://help.ctrader.com/trading-with-ctrader/markets/ .

## Soluciones admisibles

**A. Fuente exacta certificada:** buscar un canal autorizado de cotizaciones con la misma fuente y calendario que `IC:` de V34.12X. Reconstruir H4 y MSS por el motor equivalente, confrontando salida. No afirmar que exista API TradingView pública para extraer los resultados Pine ni acceso a los 34 mercados; verificar proveedor y permiso de uso.

**B. cTrader DEMO candidato:** identificar broker exacto de la cuenta, familia de precios, servidor, horarios y disponibilidad de los 34 símbolos. Extraer M5 cerradas con `Bars`/OpenTime/OHLC y comparar con registros equivalentes de la misma fuente/periodo del V34.12X. Si alguna fuente carece de muestra confiable, estado **FUENTE_NO_CERTIFICADA**; no inventar coincidencia.

**C. Alertas del indicador en TradingView:** posibilidad técnica solo si el plan/cuenta permite alertas Pine y una ruta de salida autorizada; V34.12X actualmente NO incluye `alert()` ni `alertcondition()`. No prometer automatización en cuenta Free.

## Certificación por símbolo antes de atribuir alertas a V34.12X

1. Inventario canónico de los 34 pares IC (incluida equivalencia `IC:USTEC` / `NDX100` y `IC:US500` / `SPX500`), IDs, broker/símbolo de cTrader, disponibilidad de histórico, unidad de precios y timestamp UTC.
2. Comparar velas M5 CERRADAS de ambas fuentes, inicialmente EURUSD, GBPUSD, USDCAD, BTCUSD, XAUUSD y luego el resto. Para cada vela confrontar UTC open, OHLC, gaps y precisión; separar diferencias **de precio** de diferencias **de fase**.
3. Reconstruir H4, 48 barras M5 consecutivas, horario NY/DST; contrastar C1, C2 provisional, ratificación C2, C3, Inside, Multi4, Multi-N, MSS M5 y M15 causales, pivotes, PDH/PDL y FVG.
4. Rechazar como equivalentes las alertas cuyos niveles críticos diverjan aunque sea un tick que cambie la condición de barrida/cierre. Una tolerancia numérica puede usarse en un informe diagnóstico, **no** para aprobar silenciosamente patrones diferentes.
5. Exigir evento temporal, deduplicación, expiración 4 horas, autenticación de fuente Railway, permisos Android para tono/vibración y prueba con app en segundo plano. Etiquetar siempre fuente (TV/IC/cTrader) y estado de certificación.
6. Si no hay equivalencia certificada, mostrar al Owner **“cTrader DEMO · CRT NO VERIFICADO CON V34.12X”** solo en QA; NO comunicarlo como señal del indicador aprobado.

## Bloqueos actuales

- No se cuenta aquí con dataset exportado del V34.12X por símbolo y minuto M5 ni del broker/servidor de cTrader DEMO.
- No existe comprobación 34/34 de equivalencia de velas, patrones, MSS y FVG; no se ha confirmado conexión cTrader DEMO → Railway real.
- La app actual admite replay QA, y no tiene todavía un sistema de notificaciones de CRT de mercado con sonido/vibración configurables y push confiable.
- No ajustar automáticamente el motor para «parecerse» a cTrader; equivalencia significa **mismos datos y reglas verificadas**, no solo nombres de símbolos.

**Resultado:** fuente de la señal primero; notificación exclusiva después. El indicador V34.12X queda intacto. No MERGE, no LIVE, no activar emisión de señales sin evidencia Owner.