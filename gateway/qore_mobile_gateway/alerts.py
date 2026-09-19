from datetime import datetime

from .models import (
    AlertKind,
    AlertSeverity,
    AlertSnapshot,
    Freshness,
    PositionSnapshot,
    RiskSnapshot,
    RuntimeSnapshot,
)
from .repository import ReadRepository


def position_opened_alert(
    *,
    event_id: str,
    position: PositionSnapshot,
    raised_at: datetime,
) -> AlertSnapshot:
    return AlertSnapshot(
        alert_id=f"position-opened:{event_id}",
        kind=AlertKind.POSITION_OPENED,
        severity=AlertSeverity.INFO,
        title=f"Posición abierta · {position.symbol}",
        detail=(
            f"{position.trader_id} abrió una posición {position.side.value} "
            f"en {position.symbol}."
        ),
        source="gateway.telemetry",
        raised_at=raised_at,
        as_of=raised_at,
        account_id=position.account_id,
        trader_id=position.trader_id,
        position_id=position.position_id,
    )


def position_closed_alert(
    *,
    event_id: str,
    account_id: str,
    position_id: str,
    position: PositionSnapshot | None,
    raised_at: datetime,
) -> AlertSnapshot:
    symbol = position.symbol if position is not None else "posición"
    trader_id = position.trader_id if position is not None else None
    return AlertSnapshot(
        alert_id=f"position-closed:{event_id}",
        kind=AlertKind.POSITION_CLOSED,
        severity=AlertSeverity.INFO,
        title=f"Posición cerrada · {symbol}",
        detail=(
            f"{trader_id or 'QORE'} cerró {symbol}."
        ),
        source="gateway.telemetry",
        raised_at=raised_at,
        as_of=raised_at,
        account_id=account_id,
        trader_id=trader_id,
        position_id=position_id,
    )



_CANONICAL_RISK_STATES = frozenset({"clear", "degraded", "blocked"})


def risk_state_alerts(
    *,
    event_id: str,
    previous: RiskSnapshot | None,
    current: RiskSnapshot,
    raised_at: datetime,
) -> list[AlertSnapshot]:
    """Project only canonical QORE Risk state transitions into mobile alerts."""

    current_state = current.state.strip().lower()
    previous_state = (
        previous.state.strip().lower()
        if previous is not None
        else None
    )

    if current_state not in _CANONICAL_RISK_STATES:
        return []
    if previous_state == current_state:
        return []

    if current_state == "degraded":
        kind = AlertKind.RISK_THRESHOLD
        severity = AlertSeverity.WARNING
        title = "QORE Risk degradado"
        detail = (
            f"{current.account_id} cambió a DEGRADED según QORE Risk."
        )
    elif current_state == "blocked":
        kind = AlertKind.RISK_LOCK
        severity = AlertSeverity.CRITICAL
        title = "QORE Risk bloqueado"
        detail = (
            f"{current.account_id} cambió a BLOCKED según QORE Risk."
        )
    else:
        if previous_state not in {"degraded", "blocked"}:
            return []
        kind = AlertKind.RISK_SAFE
        severity = AlertSeverity.INFO
        title = "QORE Risk recuperado"
        detail = (
            f"{current.account_id} volvió a CLEAR según QORE Risk."
        )

    return [
        AlertSnapshot(
            alert_id=(
                f"risk:{current.account_id}:{kind.value}:{event_id}"
            ),
            kind=kind,
            severity=severity,
            title=title,
            detail=detail,
            source=current.source,
            raised_at=raised_at,
            as_of=raised_at,
            account_id=current.account_id,
        )
    ]


def runtime_health_alerts(
    runtimes: list[RuntimeSnapshot],
    *,
    now: datetime,
) -> list[AlertSnapshot]:
    alerts: list[AlertSnapshot] = []

    for runtime in runtimes:
        if runtime.reconciliation_required:
            alerts.append(
                AlertSnapshot(
                    alert_id=f"runtime:{runtime.runtime_id}:reconciliation",
                    kind=AlertKind.RECONCILIATION_REQUIRED,
                    severity=AlertSeverity.WARNING,
                    title="Reconciliación requerida",
                    detail=(
                        f"{runtime.runtime_id} detectó una brecha de secuencia "
                        "y no debe aceptar estado incremental hasta reconciliar."
                    ),
                    source="gateway.runtime",
                    raised_at=runtime.as_of,
                    as_of=now,
                    runtime_id=runtime.runtime_id,
                )
            )

        if runtime.freshness == Freshness.DELAYED:
            kind = AlertKind.RUNTIME_DELAYED
            severity = AlertSeverity.WARNING
            title = "Runtime con demora"
        elif runtime.freshness == Freshness.STALE:
            kind = AlertKind.RUNTIME_STALE
            severity = AlertSeverity.WARNING
            title = "Runtime stale"
        elif runtime.freshness == Freshness.OFFLINE:
            kind = AlertKind.RUNTIME_OFFLINE
            severity = AlertSeverity.CRITICAL
            title = "Runtime offline"
        else:
            continue

        alerts.append(
            AlertSnapshot(
                alert_id=f"runtime:{runtime.runtime_id}:{kind.value}",
                kind=kind,
                severity=severity,
                title=title,
                detail=(
                    f"{runtime.runtime_id} está {runtime.freshness.value}. "
                    f"Último heartbeat: {runtime.last_heartbeat or 'desconocido'}."
                ),
                source="gateway.runtime",
                raised_at=runtime.as_of,
                as_of=now,
                runtime_id=runtime.runtime_id,
            )
        )

    return alerts


def current_alerts(
    *,
    repository: ReadRepository,
    runtimes: list[RuntimeSnapshot],
    now: datetime,
) -> list[AlertSnapshot]:
    merged = {
        alert.alert_id: alert
        for alert in repository.list_alerts(include_resolved=True)
    }
    for alert in runtime_health_alerts(runtimes, now=now):
        merged[alert.alert_id] = alert

    return sorted(
        merged.values(),
        key=lambda item: item.raised_at,
        reverse=True,
    )
