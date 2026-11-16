"""Adaptive source-anchored level lines for the existing incoherent noise model.

A distance-bound quadtree prunes cells wholly above/below each threshold. Crossing
cells reach a common depth before marching squares, so neighbouring edges share
endpoints. This avoids losing compact high-level rings on a coarse viewport grid.
No new numerical or geographic dependency is required.
"""

import math
from collections import defaultdict
from collections.abc import Callable

from .acoustics import combine, inverse_mercator, mercator_y
from .types import Contour, ContourRequest, ContourResponse

EARTH_RADIUS = 6_371_008.8
MAX_CELLS = 160_000
MAX_RADIUS_M = 200_000
VERTEX_TOLERANCE_DB = 0.02

type XY = tuple[float, float]
type Edge = tuple[tuple[int, int], tuple[int, int]]


def _segments_to_lines(segments: list[tuple[Edge, Edge]], points: dict[Edge, XY]) -> list[list[XY]]:
    """Stitch segments by exact grid-edge identity, without coordinate rounding.

    Args:
        segments: Pairs of crossing grid-edge identifiers.
        points: Refined geographic coordinates for each edge.

    Returns:
        Connected open lines or explicitly closed rings.
    """
    adjacent: dict[Edge, list[int]] = defaultdict(list)
    for index, (a, b) in enumerate(segments):
        adjacent[a].append(index)
        adjacent[b].append(index)
    unused = set(range(len(segments)))
    lines: list[list[XY]] = []
    starts = sorted(adjacent, key=lambda edge: len(adjacent[edge]) != 1)
    for start in starts:
        while any(index in unused for index in adjacent[start]):
            current = start
            line = [points[current]]
            while True:
                index = next((i for i in adjacent[current] if i in unused), None)
                if index is None:
                    break
                unused.remove(index)
                a, b = segments[index]
                current = b if a == current else a
                line.append(points[current])
                if current == start:
                    break
            lines.append(line)
    return lines


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
        levels = [
            s[4] - 10 * math.log10(4 * math.pi) - 20 * math.log10(max(1, d))
            for s, d in zip(self.sources, self.distances(point), strict=True)
        ]
        highest = max(levels)
        return highest + 10 * math.log10(sum(10 ** ((v - highest) / 10) for v in levels))

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
        lower = [
            s[4] - 10 * math.log10(4 * math.pi) - 20 * math.log10(max(1, d + radius))
            for s, d in zip(self.sources, distances, strict=True)
        ]
        upper = [
            s[4] - 10 * math.log10(4 * math.pi) - 20 * math.log10(max(1, d - radius))
            for s, d in zip(self.sources, distances, strict=True)
        ]
        return float(combine(lower) or 0), float(combine(upper) or 0)

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


def _edge_crossing(a: XY, b: XY, level: float, value: Callable[[XY], float]) -> XY:
    """Refine a bracketed crossing to the documented vertex dB tolerance.

    Args:
        a: First projected edge endpoint.
        b: Second projected edge endpoint.
        level: Requested threshold.
        value: Combined-field evaluator.

    Returns:
        Projected contour vertex found by bounded bisection.
    """
    above = value(a) >= level
    point = a
    for _ in range(40):
        point = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        result = value(point)
        if abs(result - level) <= VERTEX_TOLERANCE_DB:
            break
        if (result >= level) == above:
            a = point
        else:
            b = point
    return point


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
    if level >= sum_level_at_max(field):
        return Contour(level_db=level, lines=[])
    west, south, size = field.domain(level)
    # Resolve compact rings, not just the largest domain. No viewport input.
    radii = [10 ** ((s[4] - 10 * math.log10(4 * math.pi) - level) / 20) for s in field.sources]
    positive = [r for r in radii if r >= 1]
    target = max(0.05, min(positive, default=1) / 20)
    depth = max(6, math.ceil(math.log2(size / target)))
    count = 2**depth
    step = size / count
    values: dict[tuple[int, int], float] = {}
    points: dict[Edge, XY] = {}
    segments: list[tuple[Edge, Edge]] = []
    budget = 0

    def xy(ix: int, iy: int) -> XY:
        """Map integer grid coordinates to projected metres.

        Args:
            ix: Horizontal lattice coordinate.
            iy: Vertical lattice coordinate.

        Returns:
            Projected x/y pair.
        """
        return west + ix * step, south + iy * step

    def visit(ix: int, iy: int, width: int) -> None:
        """Prune or subdivide one cell; march all retained cells at equal depth.

        Args:
            ix: Cell's western lattice index.
            iy: Cell's southern lattice index.
            width: Cell width in final-lattice steps.

        Raises:
            ValueError: If the bounded cell budget is exhausted.
        """
        nonlocal budget
        budget += 1
        if budget > MAX_CELLS:
            raise ValueError(
                "Contour is too complex at this accuracy. Reduce the source spread or simplify the scenario."
            )
        lo, hi = field.range_at(xy(ix + width // 2, iy + width // 2), width * step / math.sqrt(2))
        # At the final odd-width cell use its actual centre, not the integer origin.
        if width == 1:
            lo, hi = field.range_at((west + (ix + 0.5) * step, south + (iy + 0.5) * step), step / math.sqrt(2))
        if lo > level or hi < level:
            return
        if width > 1:
            half = width // 2
            for dx, dy in ((0, 0), (half, 0), (half, half), (0, half)):
                visit(ix + dx, iy + dy, half)
            return
        corners = [(ix, iy), (ix + 1, iy), (ix + 1, iy + 1), (ix, iy + 1)]
        for corner in corners:
            if corner not in values:
                values[corner] = field.value(xy(*corner))
        signs = [values[c] >= level for c in corners]
        crossings: list[Edge] = []
        for i, a in enumerate(corners):
            b = corners[(i + 1) % 4]
            if signs[i] == signs[(i + 1) % 4]:
                continue
            edge: Edge = (a, b) if a < b else (b, a)
            if edge not in points:
                points[edge] = field.geographic(_edge_crossing(xy(*a), xy(*b), level, field.value))
            crossings.append(edge)
        if len(crossings) == 2:
            segments.append((crossings[0], crossings[1]))
        elif len(crossings) == 4:
            # Resolve saddle topology using the actual field at the centre.
            centre_above = field.value((west + (ix + 0.5) * step, south + (iy + 0.5) * step)) >= level
            if centre_above == signs[0]:
                segments.extend([(crossings[0], crossings[1]), (crossings[2], crossings[3])])
            else:
                segments.extend([(crossings[3], crossings[0]), (crossings[1], crossings[2])])

    visit(0, 0, count)
    return Contour(level_db=level, lines=_segments_to_lines(segments, points))


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
    """Generate source-centred threshold lines using only the standard library.

    Args:
        scenario: Validated sources and thresholds; presentation settings stay client-side.

    Returns:
        Contour geometry independent of receiver positions and map viewport.
    """
    if not scenario.sources:
        return ContourResponse(contours=[Contour(level_db=level, lines=[]) for level in scenario.levels])
    field = ContourField(scenario)
    return ContourResponse(contours=[trace_level(field, level) for level in scenario.levels])
