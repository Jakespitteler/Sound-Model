"""Practical slider intervals from the existing point-source model and contour engine."""

import math
from typing import Literal

from pydantic import BaseModel

from .acoustics import at_point, combine, source_level
from .contours import build_contours
from .scope import boundary_level
from .types import ContourRequest, Receiver, Scenario


class ContourRange(BaseModel):
    """Verified slider interval, not an audibility or compliance criterion.

    Attributes:
        status: Whether a useful interval was found.
        min_db: Conservative, verified lower contour threshold.
        max_db: Verified upper threshold below a sampled source peak.
        reason: Actionable explanation when an interval is unavailable.
    """

    status: Literal["ok", "unavailable"]
    min_db: float | None = None
    max_db: float | None = None
    reason: str | None = None


def calculate_contour_range(scenario: Scenario) -> ContourRange:
    """Find a practical continuous slider interval without changing physical predictions.

    The background boundary and supported projection suggest a conservative low
    endpoint; source-centre samples suggest a high endpoint. Both are checked by
    the normal engine. Intermediate levels may still report independent errors.

    Args:
        scenario: Validated sources/types; camera, receivers and cloud are irrelevant.

    Returns:
        A checked practical interval, or an explicit unavailable result. This is
        neither a maximal feasible interval nor a restriction on numeric entry.
    """
    if not scenario.sources:
        return ContourRange(status="unavailable", reason="Place a machine to enable the slider.")
    types = {item.id: item for item in scenario.types}
    total = combine([types[source.type_id].lwa for source in scenario.sources])
    assert total is not None
    peaks: list[float] = []
    for source in scenario.sources:
        level = at_point(Receiver(id="slider-sample", lat=source.lat, lng=source.lng), scenario.sources, types).level_db
        assert level is not None
        peaks.append(level)
    peak = max(peaks)
    # With no background, probe the map projection domain rather than an acoustic radius.
    projection_radius = math.radians(85 - max(abs(s.lat) for s in scenario.sources)) * 6_371_008.8 / 2
    projection_floor = source_level(total, max(2, projection_radius))
    floor = (
        max(boundary_level(scenario.background_db), projection_floor)
        if scenario.background_db is not None
        else projection_floor
    )
    if floor >= peak:
        return ContourRange(
            status="unavailable", reason="No useful slider interval above background; enter a level directly."
        )
    low = math.ceil((floor + 0.05) * 10) / 10
    high = math.floor((peak - 0.05) * 10) / 10
    unavailable = ContourRange(status="unavailable", reason="No useful slider interval; enter a level directly.")
    if high <= low:
        return unavailable

    def produces_line(level: float) -> bool:
        """Verify one threshold using normal extraction and background checks.

        Args:
            level: Proposed slider threshold.

        Returns:
            Whether the normal engine produced a successful nonempty level.
        """
        result = build_contours(ContourRequest(**scenario.model_dump(), levels=[level])).contours[0]
        return result.status == "ok" and bool(result.lines)

    if not produces_line(high):
        return unavailable
    if not produces_line(low):
        failed, valid = low, high
        for _ in range(12):
            if valid - failed <= 0.11:
                break
            middle = math.floor((failed + valid) * 5) / 10
            if produces_line(middle):
                valid = middle
            else:
                failed = middle
        low = valid
    if high <= low:
        return unavailable
    return ContourRange(status="ok", min_db=low, max_db=high)
