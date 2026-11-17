"""Explicit presentation scope for the unvalidated free-field screening model.

This is an owner-approved screening policy, not a propagation or audibility cutoff.
The underlying scalar equations remain available for analytical tests.
"""

from .types import Point

SCREENING_DISTANCE_M = 10_000.0


def screen_receiver(point: Point) -> Point:
    """Suppress unsupported distant receiver totals without falsifying them as silence.

    Args:
        point: Raw free-field total and source contributions.

    Returns:
        Scoped reading; a receiver more than 10 km from every source has no numeric
        level or numeric source contributions. In-scope totals retain all sources,
        with a warning if any individual path exceeds the screening distance.
    """
    if not point.contributions:
        return point.model_copy(update={"status": "no_sources"})
    nearest = min(c.distance_m for c in point.contributions)
    if nearest > SCREENING_DISTANCE_M:
        return Point(level_db=None, near_field=False, contributions=[], status="out_of_scope", nearest_source_m=nearest)
    return point.model_copy(
        update={
            "nearest_source_m": nearest,
            "includes_distant_sources": any(c.distance_m > SCREENING_DISTANCE_M for c in point.contributions),
        }
    )
