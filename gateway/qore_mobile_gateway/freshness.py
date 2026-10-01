from dataclasses import dataclass
from datetime import datetime, timedelta

from .models import Freshness


@dataclass(frozen=True)
class FreshnessPolicy:
    live_max_age: timedelta = timedelta(seconds=5)
    delayed_max_age: timedelta = timedelta(seconds=15)
    stale_max_age: timedelta = timedelta(seconds=60)

    def classify(self, *, now: datetime, last_seen: datetime | None) -> Freshness:
        if last_seen is None:
            return Freshness.UNKNOWN

        age = now - last_seen

        # Future timestamps are not trusted as evidence of extra freshness.
        if age.total_seconds() < 0:
            return Freshness.UNKNOWN
        if age <= self.live_max_age:
            return Freshness.LIVE
        if age <= self.delayed_max_age:
            return Freshness.DELAYED
        if age <= self.stale_max_age:
            return Freshness.STALE
        return Freshness.OFFLINE
