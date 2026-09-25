from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

TRADER_DISPLAY = {
    "VT08_FOREX": ("VT08 Forex", "AUDJPY / GBPUSD / GBPJPY"),
    "R34_XAUUSD": ("Turtle Soup XAUUSD R34", "XAUUSD"),
    "R38_EURUSD": ("Turtle Soup EURUSD R38", "EURUSD"),
    "R43_GBPUSD": ("Turtle Soup GBPUSD R43", "GBPUSD"),
    "R38_GBPJPY": ("Turtle Soup GBPJPY R38", "GBPJPY"),
    "R42_AUDJPY": ("Turtle Soup AUDJPY R42", "AUDJPY"),
    "VT31_NAS100": ("VT31 NAS100", "NAS100"),
}


def _read_json(path: Path) -> dict[str, Any]:
    for attempt in range(5):
        try:
            if not path.exists():
                return {}
            return json.loads(path.read_text(encoding="utf-8-sig"))
        except (PermissionError, FileNotFoundError):
            if attempt == 4:
                raise
            time.sleep(0.1)
    return {}


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _freshness(now: datetime, last_seen: datetime | None) -> str:
    if last_seen is None:
        return "unknown"
    age = (now - last_seen).total_seconds()
    if age < 0:
        return "unknown"
    if age <= 5:
        return "live"
    if age <= 15:
        return "delayed"
    if age <= 60:
        return "stale"
    return "offline"


def _next_sequence(path: Path) -> int:
    current = 0
    if path.exists():
        try:
            current = int(path.read_text(encoding="utf-8").strip() or "0")
        except ValueError:
            current = 0
    value = current + 1
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(str(value), encoding="utf-8")
    os.replace(temp, path)
    return value


def _mobile_trader_id(raw: str) -> str:
    return f"CTRADER_DEMO_{raw}"


def _load_services(root: Path) -> tuple[Any, Any]:
    src = str(root / "src")
    if src not in sys.path:
        sys.path.insert(0, src)

    from qore.infrastructure.ctrader_demo_free_binding import (
        discover_free_account_binding,
    )
    from qore.infrastructure.ctrader_demo_free_position_service import (
        CTraderDemoFreePositionService,
    )
    from qore.infrastructure.ctrader_demo_free_sink import credentials_from_environment
    from qore.infrastructure.ctrader_open_api_client import (
        SpotwareCTraderOpenApiClient,
    )

    credentials = credentials_from_environment()
    client = SpotwareCTraderOpenApiClient(credentials=credentials)
    binding = discover_free_account_binding(client)
    service = CTraderDemoFreePositionService(
        client=client,
        configuration=binding.configuration,
    )
    return client, service


def _close_client(client: Any) -> None:
    for name in ("close", "disconnect", "shutdown"):
        method = getattr(client, name, None)
        if callable(method):
            try:
                method()
            except Exception:
                pass
            return


def build_snapshot(
    *,
    root: Path,
    runtime_id: str,
    account_id: str,
    sequence: int,
    position_service: Any,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    runtime_state = _read_json(
        root / "var" / "ctrader_demo_signal_runtime" / "runtime-state.json"
    )
    binding = _read_json(root / "var" / "ctrader_demo_free" / "binding.json")
    heartbeat = _parse_time(runtime_state.get("heartbeat_at"))
    freshness = _freshness(now, heartbeat)

    if str(binding.get("environment", "")).upper() != "DEMO":
        raise RuntimeError("cTrader mobile bridge refuses non-DEMO binding")

    account = position_service.account_snapshot(observed_at=now)
    positions_native = position_service.positions()
    unrealized = position_service.unrealized_by_position()

    positions: list[dict[str, Any]] = []
    for position in positions_native:
        raw_trader = position.trader_id.value
        positions.append(
            {
                "position_id": f"ctrader-demo:{position.position_id}",
                "account_id": account_id,
                "trader_id": _mobile_trader_id(raw_trader),
                "symbol": position.qore_symbol,
                "side": position.side,
                "entry": float(position.entry_price),
                "current_price": None,
                "stop": (
                    float(position.stop_loss)
                    if position.stop_loss is not None
                    else None
                ),
                "target": (
                    float(position.take_profit)
                    if position.take_profit is not None
                    else None
                ),
                "size": float(position.volume_units),
                "unrealized_pnl": float(unrealized.get(position.position_id, 0)),
                "r_state": None,
                "opened_at": position.opened_at.astimezone(UTC).isoformat(),
                "as_of": now.isoformat(),
            }
        )

    allocations = binding.get("allocations", {})
    if not isinstance(allocations, dict):
        allocations = {}

    traders: list[dict[str, Any]] = []
    for raw_trader in allocations:
        if raw_trader not in TRADER_DISPLAY:
            continue
        name, market = TRADER_DISPLAY[raw_trader]
        traders.append(
            {
                "trader_id": _mobile_trader_id(raw_trader),
                "account_id": account_id,
                "name": f"{name} · cTrader Demo",
                "market": market,
                "mode": "demo",
                "state": "running",
                "last_market_read": heartbeat.isoformat() if heartbeat else None,
                "last_signal_or_abstention": None,
                "freshness": freshness,
                "as_of": now.isoformat(),
            }
        )

    account_snapshot = {
        "account_id": account_id,
        "provider": "cTrader",
        "label": "cTrader Demo Free",
        "mode": "demo",
        "runtime_id": runtime_id,
        "balance": float(account.balance),
        "equity": float(account.equity),
        "realized_pnl_today": None,
        "floating_pnl": float(account.net_unrealized_pnl),
        "daily_drawdown_fraction": None,
        "total_drawdown_fraction": None,
        "open_positions": len(positions),
        "last_heartbeat": heartbeat.isoformat() if heartbeat else None,
        "as_of": now.isoformat(),
        "freshness": freshness,
    }

    return {
        "schema_version": "0.1",
        "runtime_id": runtime_id,
        "account_id": account_id,
        "sequence": sequence,
        "event_time": (heartbeat or now).isoformat(),
        "emitted_at": now.isoformat(),
        "account": account_snapshot,
        "traders": traders,
        "positions": positions,
    }


def publish(
    *,
    gateway_url: str,
    runtime_id: str,
    secret: bytes,
    payload: dict[str, Any],
) -> None:
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(secret, body, hashlib.sha256).hexdigest()
    request = urllib.request.Request(
        gateway_url.rstrip("/") + "/v1/runtime/reconcile",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Qore-Runtime-Id": runtime_id,
            "X-Qore-Signature": f"v1={signature}",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            if response.status != 202:
                raise RuntimeError(f"unexpected gateway status {response.status}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"gateway rejected cTrader telemetry: {exc.code} {detail}"
        ) from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--gateway-url", required=True)
    parser.add_argument("--runtime-id", required=True)
    parser.add_argument("--account-id", required=True)
    parser.add_argument("--secret-file", type=Path, required=True)
    parser.add_argument("--sequence-file", type=Path, required=True)
    parser.add_argument("--interval", type=float, default=2.0)
    args = parser.parse_args()

    secret = args.secret_file.read_text(encoding="utf-8").strip().encode("utf-8")
    if not secret:
        raise RuntimeError("cTrader runtime telemetry secret is empty")

    client: Any | None = None
    service: Any | None = None
    consecutive_failures = 0
    try:
        client, service = _load_services(args.root)
        while True:
            cycle_started = time.monotonic()
            try:
                sequence = _next_sequence(args.sequence_file)
                snapshot = build_snapshot(
                    root=args.root,
                    runtime_id=args.runtime_id,
                    account_id=args.account_id,
                    sequence=sequence,
                    position_service=service,
                )
                publish(
                    gateway_url=args.gateway_url,
                    runtime_id=args.runtime_id,
                    secret=secret,
                    payload=snapshot,
                )
                consecutive_failures = 0
            except Exception as exc:
                consecutive_failures += 1
                print(
                    f"cTrader telemetry cycle failed ({consecutive_failures}): "
                    f"{type(exc).__name__}: {exc}",
                    file=sys.stderr,
                    flush=True,
                )
                if consecutive_failures % 5 == 0:
                    if client is not None:
                        _close_client(client)
                    time.sleep(0.5)
                    client, service = _load_services(args.root)

            elapsed = time.monotonic() - cycle_started
            time.sleep(max(0.25, max(1.0, args.interval) - elapsed))
    finally:
        if client is not None:
            _close_client(client)


if __name__ == "__main__":
    raise SystemExit(main())
