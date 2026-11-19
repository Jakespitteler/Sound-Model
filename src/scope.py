"""Background-relative display policy, independent of distance and propagation physics."""

import math

from .types import Point

NEGLIGIBLE_INCREASE_DB = 0.1
# Stable energy ratio: machine/background = 10**(0.1/10) - 1.
BACKGROUND_OFFSET_DB = 10 * math.log10(math.expm1(NEGLIGIBLE_INCREASE_DB * math.log(10) / 10))


def boundary_level(background_db: float) -> float:
    """Find the machinery level that raises a uniform background by 0.1 dB.

    Args:
        background_db: Scenario background pressure level in dB(A).

    Returns:
        Combined machinery contribution at the adaptive outer boundary.
    """
    return background_db + BACKGROUND_OFFSET_DB


def screen_receiver(point: Point, background_db: float | None = None) -> Point:
    """Label negligible machinery increases without using any distance cutoff.

    Args:
        point: All-source geometry estimate before presentation filtering.
        background_db: User-entered background, or None when not supplied.

    Returns:
        Original estimate, no-source status, or an explicit negligible-increase label.
        Background is never added to the displayed machinery contribution.
    """
    if not point.contributions:
        return point.model_copy(update={"status": "no_sources"})
    nearest = min(c.distance_m for c in point.contributions)
    if background_db is not None and point.level_db is not None and point.level_db < boundary_level(background_db):
        return Point(
            level_db=None, near_field=point.near_field, contributions=[], status="negligible", nearest_source_m=nearest
        )
    return point.model_copy(update={"nearest_source_m": nearest})
