from datetime import UTC, datetime, timedelta

from qore_mobile_gateway.freshness import FreshnessPolicy
from qore_mobile_gateway.models import Freshness


NOW = datetime(2026, 9, 18, 23, 0, tzinfo=UTC)


def test_freshness_boundaries() -> None:
    policy = FreshnessPolicy()

    assert policy.classify(now=NOW, last_seen=None) == Freshness.UNKNOWN
    assert policy.classify(now=NOW, last_seen=NOW - timedelta(seconds=2)) == Freshness.LIVE
    assert policy.classify(now=NOW, last_seen=NOW - timedelta(seconds=10)) == Freshness.DELAYED
    assert policy.classify(now=NOW, last_seen=NOW - timedelta(seconds=30)) == Freshness.STALE
    assert policy.classify(now=NOW, last_seen=NOW - timedelta(seconds=61)) == Freshness.OFFLINE


def test_future_timestamp_is_not_trusted_as_live() -> None:
    policy = FreshnessPolicy()

    assert policy.classify(
        now=NOW,
        last_seen=NOW + timedelta(seconds=1),
    ) == Freshness.UNKNOWN
