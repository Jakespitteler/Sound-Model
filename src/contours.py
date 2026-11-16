"""Adaptive source-anchored level lines for the existing incoherent noise model.

A distance-bound quadtree prunes cells wholly above/below each threshold. NumPy
evaluates source energy in bounded batches, and ContourPy extracts fine-grid lines
inside sparse tiles. Exact lattice identities join neighbouring tile endpoints.
The scalar field remains a reference for numerical validation.
"""

import math

from .acoustics import combine, inverse_mercator, mercator_y, source_level
from .contour_engine import trace_tiles
from .types import Contour, ContourRequest, ContourResponse

EARTH_RADIUS = 6_371_008.8
MAX_CELLS = 640_000
MAX_RADIUS_M = 200_000
VERTEX_TOLERANCE_DB = 0.02

type XY = tuple[float, float]


class ContourField:
    """Projected sampling frame with exact great-circle energetic evaluation.

    Attributes:
        sources: Projected x/y, latitude radians, longitude radians and LwA tuples.
        origin_lng: Reference longitude used to unwrap sources near the dateline.
    """

    def __init__(self, scenario: ContourRequest) -> None:
        """Prepare fixed source coefficients without mutating the request.

        Args:
            scenario: Nonempty, validated contour request.
        """
        self.origin_lng: float = scenario.sources[0].lng
        types = {item.id: item for item in scenario.types}
        self.sources: list[tuple[float, float, float, float, float]] = []
        for source in scenario.sources:
            lng = self.origin_lng + (source.lng - self.origin_lng + 180) % 360 - 180
            self.sources.append(
                (
                    EARTH_RADIUS * math.radians(lng),
                    EARTH_RADIUS * mercator_y(source.lat),
                    math.radians(source.lat),
                    math.radians(lng),
                    types[source.type_id].lwa,
                )
            )

    def geographic(self, point: XY) -> XY:
        """Convert a projected sample to unwrapped longitude and latitude.

        Args:
            point: Web Mercator x/y in metres on the mean Earth sphere.

        Returns:
            Longitude/latitude pair for Leaflet polylines.
        """
        return math.degrees(point[0] / EARTH_RADIUS), inverse_mercator(point[1] / EARTH_RADIUS)

    def distances(self, point: XY) -> list[float]:
        """Evaluate great-circle distances from all sources to a projected point.

        Args:
            point: Web Mercator x/y sample in metres.

        Returns:
            Surface distances in source order.
        """
        lng, lat = self.geographic(point)
        lat_r, lng_r = math.radians(lat), math.radians(lng)
        return [
            2
            * EARTH_RADIUS
            * math.asin(
                math.sqrt(
                    min(
                        1.0,
                        math.sin((lat_r - s[2]) / 2) ** 2
                        + math.cos(lat_r) * math.cos(s[2]) * math.sin((lng_r - s[3]) / 2) ** 2,
                    )
                )
            )
            for s in self.sources
        ]

    def value(self, point: XY) -> float:
        """Calculate the combined level using numerically stable energy addition.

        Args:
            point: Projected sample in metres.

        Returns:
            Combined dB(A) at the sample, with the existing 1 m near-field clamp.
        """
        levels = [source_level(s[4], d) for s, d in zip(self.sources, self.distances(point), strict=True)]
        result = combine(levels)
        assert result is not None
        return result

    def range_at(self, centre: XY, radius: float) -> tuple[float, float]:
        """Bound every level within a cell using the spherical triangle inequality.

        Web Mercator distances overestimate surface distances. Therefore its
        half-diagonal safely bounds the distance from the cell centre to any point.

        Args:
            centre: Projected cell centre in metres.
            radius: Projected cell half-diagonal in metres.

        Returns:
            Conservative lower and upper combined dB(A) limits for pruning.
        """
        distances = self.distances(centre)
        lower = [source_level(s[4], d + radius) for s, d in zip(self.sources, distances, strict=True)]
        upper = [source_level(s[4], d - radius) for s, d in zip(self.sources, distances, strict=True)]
        low, high = combine(lower), combine(upper)
        assert low is not None and high is not None
        return low, high

    def domain(self, level: float) -> tuple[float, float, float]:
        """Choose a source-based square guaranteed to enclose the requested level.

        Beyond the total-power radius from every source, the energy sum is
        below threshold. A conservative Mercator padding encloses those disks.
        Very large/polar domains are rejected explicitly, never silently clipped.

        Args:
            level: Decibel threshold to enclose.

        Returns:
            West x, south y and square side length in projected metres.

        Raises:
            ValueError: If the domain exceeds a 200 km propagation radius or poles.
        """
        total = combine([s[4] for s in self.sources])
        assert total is not None
        radius = max(2, 10 ** ((total - 10 * math.log10(4 * math.pi) - level) / 20))
        if radius > MAX_RADIUS_M:
            raise ValueError("Contour exceeds the 200 km model radius. Raise its dB threshold or reduce source power.")
        max_lat = max(abs(math.degrees(s[2])) for s in self.sources) + math.degrees(radius / EARTH_RADIUS)
        if max_lat >= 85:
            raise ValueError("Contour extends beyond supported ±85° latitude. Raise the threshold or move the sources.")
        padding = radius / math.cos(math.radians(max_lat)) * 1.02
        west = min(s[0] for s in self.sources) - padding
        south = min(s[1] for s in self.sources) - padding
        width = max(s[0] for s in self.sources) + padding - west
        height = max(s[1] for s in self.sources) + padding - south
        return west, south, max(width, height)


def trace_level(field: ContourField, level: float) -> Contour:
    """Extract a closed combined-field level set with adaptive marching squares.

    Args:
        field: Fixed source field independent of the map camera.
        level: Requested decibel threshold.

    Returns:
        Connected geographic contour lines; empty if no source reaches the level.

    Raises:
        ValueError: If the safe adaptive cell budget is exhausted.
    """
    if level > sum_level_at_max(field):
        return Contour(level_db=level, lines=[])
    return trace_tiles(field, level, MAX_CELLS, VERTEX_TOLERANCE_DB)


def sum_level_at_max(field: ContourField) -> float:
    """Bound maximum possible clamped level by summing colocated source powers.

    Args:
        field: Prepared source field.

    Returns:
        Absolute upper bound on level at any point.
    """
    total = combine([s[4] for s in field.sources])
    assert total is not None
    return total - 10 * math.log10(4 * math.pi)


def build_contours(scenario: ContourRequest) -> ContourResponse:
    """Generate source-centred lines with the approved NumPy/ContourPy engine.

    Args:
        scenario: Validated sources and thresholds; presentation settings stay client-side.

    Returns:
        Contour geometry independent of receiver positions and map viewport.
    """
    if not scenario.sources:
        return ContourResponse(contours=[Contour(level_db=level, lines=[]) for level in scenario.levels])
    field = ContourField(scenario)
    return ContourResponse(contours=[trace_level(field, level) for level in scenario.levels])
