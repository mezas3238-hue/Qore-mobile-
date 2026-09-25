from dataclasses import dataclass, field
from datetime import datetime
from threading import RLock

from .freshness import FreshnessPolicy
from .models import Freshness, RuntimeSnapshot


class SequenceError(Exception):
    pass


class SequenceReplayOrOutOfOrder(SequenceError):
    pass


class SequenceGap(SequenceError):
    pass


class ReconciliationRequired(SequenceError):
    pass


@dataclass
class _RuntimeSequence:
    last_sequence: int | None = None
    reconciliation_required: bool = False
    account_ids: set[str] = field(default_factory=set)
    last_heartbeat: datetime | None = None
    as_of: datetime | None = None


class RuntimeStateStore:
    def __init__(self, freshness_policy: FreshnessPolicy | None = None) -> None:
        self._states: dict[str, _RuntimeSequence] = {}
        self._lock = RLock()
        self._freshness_policy = freshness_policy or FreshnessPolicy()

    def accept_sequence(
        self,
        *,
        runtime_id: str,
        account_id: str,
        sequence: int,
    ) -> None:
        with self._lock:
            state = self._states.setdefault(runtime_id, _RuntimeSequence())
            state.account_ids.add(account_id)

            if state.reconciliation_required:
                raise ReconciliationRequired(
                    "runtime requires a full reconciliation snapshot"
                )

            if state.last_sequence is None:
                state.last_sequence = sequence
                return

            if sequence <= state.last_sequence:
                raise SequenceReplayOrOutOfOrder(
                    "sequence is duplicated or older than the last accepted event"
                )

            if sequence != state.last_sequence + 1:
                state.reconciliation_required = True
                raise SequenceGap(
                    "sequence gap detected; full reconciliation is required"
                )

            state.last_sequence = sequence

    def record_heartbeat(
        self,
        *,
        runtime_id: str,
        account_id: str,
        event_time: datetime,
        received_at: datetime,
    ) -> None:
        with self._lock:
            state = self._states.setdefault(runtime_id, _RuntimeSequence())
            state.account_ids.add(account_id)
            state.last_heartbeat = event_time
            state.as_of = received_at

    def reconcile(
        self,
        *,
        runtime_id: str,
        account_id: str,
        sequence: int,
        received_at: datetime,
        event_time: datetime,
    ) -> None:
        with self._lock:
            state = self._states.setdefault(runtime_id, _RuntimeSequence())
            if state.last_sequence is not None and sequence <= state.last_sequence:
                raise SequenceReplayOrOutOfOrder(
                    "reconciliation sequence must advance runtime state"
                )
            state.account_ids.add(account_id)
            state.last_sequence = sequence
            state.reconciliation_required = False
            state.last_heartbeat = event_time
            state.as_of = received_at

    def list_snapshots(self, *, now: datetime) -> list[RuntimeSnapshot]:
        with self._lock:
            snapshots: list[RuntimeSnapshot] = []
            for runtime_id, state in self._states.items():
                freshness = self._freshness_policy.classify(
                    now=now,
                    last_seen=state.last_heartbeat,
                )
                if state.reconciliation_required and freshness == Freshness.LIVE:
                    freshness = Freshness.DELAYED
                snapshots.append(
                    RuntimeSnapshot(
                        runtime_id=runtime_id,
                        account_ids=sorted(state.account_ids),
                        last_sequence=state.last_sequence,
                        reconciliation_required=state.reconciliation_required,
                        last_heartbeat=state.last_heartbeat,
                        as_of=state.as_of or now,
                        freshness=freshness,
                    )
                )
            return sorted(snapshots, key=lambda item: item.runtime_id)
