from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import MetaTrader5 as mt5  # type: ignore

EXPECTED_SERVER = "FundedNext-Server"

TRADERS = (
    ("VT08_FOREX", "VT08 Forex", "AUDJPY / GBPUSD / GBPJPY"),
    ("R34_XAUUSD", "Turtle Soup XAUUSD R34", "XAUUSD"),
    ("R38_EURUSD", "Turtle Soup EURUSD R38", "EURUSD"),
    ("R43_GBPUSD", "Turtle Soup GBPUSD R43", "GBPUSD"),
    ("R38_GBPJPY", "Turtle Soup GBPJPY R38", "GBPJPY"),
    ("R42_AUDJPY", "Turtle Soup AUDJPY R42", "AUDJPY"),
)


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8-sig"))


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


def _position_side(position: Any) -> str:
    return "long" if int(position.type) == int(mt5.POSITION_TYPE_BUY) else "short"


def _magic(client_order_id: str) -> int:
    digest = hashlib.sha256(client_order_id.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") & 0x7FFFFFFF


def _position_lineages(root: Path) -> dict[int, str]:
    state_dir = root / "var" / "fundednext"
    mutations = _read_json(state_dir / "mt5-mutations.json")
    risk = _read_json(state_dir / "risk-reservations.json")

    authorization_to_trader: dict[str, str] = {}
    for reservation in risk.get("reservations", []):
        if not isinstance(reservation, dict):
            continue
        authorization = reservation.get("authorization")
        if not isinstance(authorization, dict):
            continue
        authorization_id = authorization.get("authorization_id")
        trader_id = authorization.get("trader_id")
        if isinstance(authorization_id, str) and isinstance(trader_id, str):
            authorization_to_trader[authorization_id] = trader_id

    magic_to_trader: dict[int, str] = {}
    for mutation in mutations.get("records", []):
        if not isinstance(mutation, dict) or mutation.get("state") != "accepted":
            continue
        client_order_id = mutation.get("client_order_id")
        authorization_id = mutation.get("risk_authorization_id")
        if not isinstance(client_order_id, str) or not isinstance(
            authorization_id, str
        ):
            continue
        trader_id = authorization_to_trader.get(authorization_id)
        if trader_id:
            magic_to_trader[_magic(client_order_id)] = trader_id
    return magic_to_trader


def _fallback_trader_for_symbol(symbol: str) -> str:
    exact = {
        "XAUUSD": "R34_XAUUSD",
        "EURUSD": "R38_EURUSD",
    }
    return exact.get(symbol.upper(), "UNATTRIBUTED_RUNTIME_POSITION")


def _positions(
    root: Path,
    account_id: str,
    now: datetime,
) -> list[dict[str, Any]]:
    raw = mt5.positions_get()
    if raw is None:
        raise RuntimeError(f"positions_get failed: {mt5.last_error()}")
    lineage_by_magic = _position_lineages(root)
    output: list[dict[str, Any]] = []
    for position in raw:
        symbol = str(position.symbol)
        trader_id = lineage_by_magic.get(
            int(position.magic),
            _fallback_trader_for_symbol(symbol),
        )
        output.append(
            {
                "position_id": str(position.ticket),
                "account_id": account_id,
                "trader_id": trader_id,
                "symbol": symbol,
                "side": _position_side(position),
                "entry": float(position.price_open),
                "current_price": float(position.price_current),
                "stop": float(position.sl) if float(position.sl) > 0 else None,
                "target": float(position.tp) if float(position.tp) > 0 else None,
                "size": float(position.volume),
                "unrealized_pnl": float(position.profit),
                "r_state": None,
                "opened_at": datetime.fromtimestamp(int(position.time), UTC).isoformat(),
                "as_of": now.isoformat(),
            }
        )
    return output


def build_snapshot(
    *,
    root: Path,
    runtime_id: str,
    account_id: str,
    mode: str,
    sequence: int,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    account = mt5.account_info()
    if account is None:
        raise RuntimeError(f"account_info failed: {mt5.last_error()}")
    if str(account.server) != EXPECTED_SERVER:
        raise RuntimeError(
            f"server mismatch: expected {EXPECTED_SERVER}, got {account.server}"
        )

    runtime_state = _read_json(root / "var" / "fundednext" / "runtime-state.json")
    safety = _read_json(root / "var" / "fundednext" / "live-safety.json")
    heartbeat = _parse_time(runtime_state.get("heartbeat_at"))
    freshness = _freshness(now, heartbeat)
    disabled = {
        str(value)
        for value in safety.get("disabled_traders", [])
        if isinstance(value, str)
    }

    positions = _positions(root, account_id, now)
    balance = float(account.balance)
    equity = float(account.equity)

    account_snapshot = {
        "account_id": account_id,
        "provider": "FundedNext",
        "label": "FundedNext Stellar Instant",
        "mode": mode,
        "runtime_id": runtime_id,
        "balance": balance,
        "equity": equity,
        "realized_pnl_today": None,
        "floating_pnl": equity - balance,
        "daily_drawdown_fraction": None,
        "total_drawdown_fraction": None,
        "open_positions": len(positions),
        "last_heartbeat": heartbeat.isoformat() if heartbeat else None,
        "as_of": now.isoformat(),
        "freshness": freshness,
    }

    trader_snapshots = [
        {
            "trader_id": trader_id,
            "account_id": account_id,
            "name": name,
            "market": market,
            "mode": mode,
            "state": "disabled" if trader_id in disabled else "running",
            "last_market_read": heartbeat.isoformat() if heartbeat else None,
            "last_signal_or_abstention": None,
            "freshness": freshness,
            "as_of": now.isoformat(),
        }
        for trader_id, name, market in TRADERS
    ]

    return {
        "schema_version": "0.1",
        "runtime_id": runtime_id,
        "account_id": account_id,
        "sequence": sequence,
        "event_time": (heartbeat or now).isoformat(),
        "emitted_at": now.isoformat(),
        "account": account_snapshot,
        "traders": trader_snapshots,
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
        raise RuntimeError(f"gateway rejected telemetry: {exc.code} {detail}") from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--gateway-url", required=True)
    parser.add_argument("--runtime-id", required=True)
    parser.add_argument("--account-id", required=True)
    parser.add_argument("--secret-file", type=Path, required=True)
    parser.add_argument("--sequence-file", type=Path, required=True)
    parser.add_argument("--mode", choices=("demo", "shadow", "live"), default="shadow")
    parser.add_argument("--interval", type=float, default=2.0)
    args = parser.parse_args()

    secret = args.secret_file.read_text(encoding="utf-8").strip().encode("utf-8")
    if not secret:
        raise RuntimeError("runtime telemetry secret is empty")

    if not mt5.initialize():
        raise RuntimeError(f"mt5.initialize failed: {mt5.last_error()}")

    try:
        while True:
            sequence = _next_sequence(args.sequence_file)
            snapshot = build_snapshot(
                root=args.root,
                runtime_id=args.runtime_id,
                account_id=args.account_id,
                mode=args.mode,
                sequence=sequence,
            )
            publish(
                gateway_url=args.gateway_url,
                runtime_id=args.runtime_id,
                secret=secret,
                payload=snapshot,
            )
            time.sleep(max(1.0, args.interval))
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
