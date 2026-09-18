# iOS Widget

Planned native implementation: Swift + WidgetKit.

The widget will consume only a sanitized QORE Mobile snapshot and will display:

- daily portfolio P/L
- equity
- drawdown usage
- active positions
- healthy/total runtimes
- last refresh time

The widget is a snapshot surface, not a continuous trading connection.

No MT5 or provider credential is available to the widget.

Implementation begins after the authenticated app snapshot/cache boundary is established.
