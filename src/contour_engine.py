"""Bounded NumPy evaluation and ContourPy extraction on sparse source-centred tiles."""

from __future__ import annotations

import math
from collections import defaultdict
from typing import TYPE_CHECKING, cast

import contourpy
import numpy as np
from numpy.typing import NDArray

from .types import Contour

if TYPE_CHECKING:
    from .contours import ContourField

type FloatArray = NDArray[np.float64]
type IntArray = NDArray[np.int64]
type Endpoint = tuple[str, int, int]

BATCH_SIZE = 2048
TILE_CELLS = 8
REFERENCE_LOSS_DB = 10 * math.log10(4 * math.pi)
EARTH_RADIUS = 6_371_008.8


class ArrayField:
    """Prepared source coefficients for bounded vectorised evaluation.

    Attributes:
        sources: Fixed source coefficients copied from the scalar field.
        reference: Largest LwA, used for stable energy normalisation.
        weights: Relative source powers; all exponents are nonpositive.
    """

    def __init__(self, field: ContourField) -> None:
        """Prepare coefficients once per contour request.

        Args:
            field: Source field used by the direct scalar reference evaluator.
        """
        self.sources: FloatArray = np.asarray(field.sources, dtype=np.float64)
        self.reference: float = float(np.max(self.sources[:, 4]))
        self.weights: FloatArray = np.power(10.0, (self.sources[:, 4] - self.reference) / 10)

    def levels(self, points: FloatArray, radii: FloatArray | None = None) -> tuple[FloatArray, FloatArray]:
        """Evaluate exact levels or conservative lower/upper bounds in fixed-size batches.

        Args:
            points: Projected x/y sample array of shape (N, 2).
            radii: Optional Mercator cell half-diagonals for triangle-inequality bounds.

        Returns:
            Lower/upper dB arrays, identical when no cell radii are supplied.
        """
        lower = np.empty(len(points), dtype=np.float64)
        upper = np.empty(len(points), dtype=np.float64)
        for start in range(0, len(points), BATCH_SIZE):
            end = start + BATCH_SIZE
            chunk = points[start:end]
            lng = chunk[:, 0, None] / EARTH_RADIUS
            lat = 2 * np.arctan(np.exp(chunk[:, 1, None] / EARTH_RADIUS)) - math.pi / 2
            haversine = (
                np.sin((lat - self.sources[:, 2]) / 2) ** 2
                + np.cos(lat) * np.cos(self.sources[:, 2]) * np.sin((lng - self.sources[:, 3]) / 2) ** 2
            )
            distance = 2 * EARTH_RADIUS * np.arcsin(np.sqrt(np.clip(haversine, 0, 1)))
            radius = radii[start:end, None] if radii is not None else 0.0
            # Scale to relative linear power first, avoiding per-source log/power round trips.
            lower[start:end] = (
                self.reference
                - REFERENCE_LOSS_DB
                + 10 * np.log10(np.sum(self.weights / np.maximum(1, distance + radius) ** 2, axis=1))
            )
            if radii is None:
                upper[start:end] = lower[start:end]
            else:
                upper[start:end] = (
                    self.reference
                    - REFERENCE_LOSS_DB
                    + 10 * np.log10(np.sum(self.weights / np.maximum(1, distance - radius) ** 2, axis=1))
                )
        return lower, upper


def _join_paths(paths: list[FloatArray], keys: list[tuple[Endpoint, Endpoint]]) -> list[FloatArray]:
    """Join tile-boundary paths by exact lattice-edge IDs rather than rounded geography.

    Args:
        paths: Open or closed projected contour components from ContourPy.
        keys: Endpoint edge/vertex identities for each component.

    Returns:
        Connected projected lines, including explicitly closed rings.
    """
    adjacent: dict[Endpoint, list[int]] = defaultdict(list)
    for index, (a, b) in enumerate(keys):
        adjacent[a].append(index)
        adjacent[b].append(index)
    unused = set(range(len(paths)))
    result: list[FloatArray] = []
    for start in sorted(adjacent, key=lambda key: len(adjacent[key]) != 1):
        while any(i in unused for i in adjacent[start]):
            current = start
            pieces: list[FloatArray] = []
            while True:
                index = next((i for i in adjacent[current] if i in unused), None)
                if index is None:
                    break
                unused.remove(index)
                a, b = keys[index]
                line = paths[index] if a == current else paths[index][::-1]
                pieces.append(line if not pieces else line[1:])
                current = b if a == current else a
                if current == start:
                    break
            line = np.concatenate(pieces)
            if current == start:
                line[-1] = line[0]
            result.append(line)
    return result


def trace_tiles(field: ContourField, level: float, budget_limit: int, tolerance: float) -> Contour:
    """Extract adaptive sparse tiles using compiled array operations and line generation.

    Args:
        field: Source-anchored scalar field/domain provider.
        level: Requested combined threshold.
        budget_limit: Maximum charged cells per threshold.
        tolerance: Target vertex error in dB for vectorised edge bisection.

    Returns:
        Connected geographic contour lines with refined vertices.

    Raises:
        ValueError: If the fixed computation budget would be exceeded.
    """
    west, south, size = field.domain(level)
    radii = [10 ** ((s[4] - REFERENCE_LOSS_DB - level) / 20) for s in field.sources]
    target = max(0.05, min((r for r in radii if r >= 1), default=1) / 20)
    count = 2 ** max(6, math.ceil(math.log2(size / target)))
    step = size / count
    origin = np.asarray([west, south], dtype=np.float64)
    evaluator = ArrayField(field)
    frontier: IntArray = np.asarray([[0, 0]], dtype=np.int64)
    width, charged = count, 0

    while len(frontier):
        charged += len(frontier)
        if charged > budget_limit:
            raise ValueError(
                f"The {level:g} dB(A) contour exceeded the {budget_limit:,}-cell calculation budget "
                f"at a target cell size of {target:.3g} projected metres. "
                "Wide source spacing and mixed source powers can require more refinement. "
                "Receiver predictions remain available; do not omit relevant sources to force a result."
            )
        centre = origin + (frontier + width / 2) * step
        lo, hi = evaluator.levels(centre, np.full(len(frontier), width * step / math.sqrt(2)))
        frontier = frontier[(lo <= level + 1e-10) & (hi >= level - 1e-10)]
        if width == TILE_CELLS or not len(frontier):
            break
        width //= 2
        offsets = np.asarray([[0, 0], [width, 0], [width, width], [0, width]], dtype=np.int64)
        frontier = (frontier[:, None, :] + offsets).reshape(-1, 2)
    if not len(frontier):
        return Contour(level_db=level, lines=[])

    # Charge the dense fine cells before allocating any per-tile buffers.
    if charged + len(frontier) * TILE_CELLS**2 > budget_limit:
        raise ValueError(
            f"The {level:g} dB(A) contour exceeded the {budget_limit:,}-cell tile budget. "
            "Receiver predictions remain available; do not omit relevant sources to force a result."
        )
    paths: list[FloatArray] = []
    keys: list[tuple[Endpoint, Endpoint]] = []

    def endpoint(point: FloatArray) -> Endpoint:
        """Identify a path endpoint by its lattice edge or exact lattice vertex.

        Args:
            point: Projected endpoint coordinates.

        Returns:
            Stable key shared by both tiles touching this crossing.
        """
        x, y = (point - origin) / step
        ix, iy = round(float(x)), round(float(y))
        if abs(x - ix) < 1e-5 and abs(y - iy) < 1e-5:
            return "p", ix, iy
        if abs(x - ix) < 1e-5:
            return "v", ix, math.floor(float(y))
        return "h", math.floor(float(x)), iy

    for tile in frontier:
        xs = west + (int(tile[0]) + np.arange(TILE_CELLS + 1)) * step
        ys = south + (int(tile[1]) + np.arange(TILE_CELLS + 1)) * step
        sample_points = np.column_stack((np.tile(xs, TILE_CELLS + 1), np.repeat(ys, TILE_CELLS + 1)))
        samples, _ = evaluator.levels(sample_points)
        generator = contourpy.contour_generator(
            x=xs, y=ys, z=samples.reshape((TILE_CELLS + 1, TILE_CELLS + 1)), name="serial", line_type="Separate"
        )
        # Separate line output is a list of (N, 2) float arrays. A negligible floating-point offset
        # includes attainable flat maxima without changing the reported threshold.
        tile_lines = cast("list[FloatArray]", generator.lines(level - 1e-10))
        for line in tile_lines:
            if len(line) < 2:
                continue
            paths.append(line)
            if np.array_equal(line[0], line[-1]):
                # A closed ring contained in a tile has no shared boundary endpoint.
                key = ("closed", len(paths), 0)
                keys.append((key, key))
            else:
                keys.append((endpoint(line[0]), endpoint(line[-1])))

    lines = _join_paths(paths, keys)
    geographic: list[list[tuple[float, float]]] = []
    for line in lines:
        # Each raw ContourPy vertex lies on a known grid edge. Refine all edges together.
        grid = (line - origin) / step
        nearest = np.rint(grid)
        vertical = np.abs(grid[:, 0] - nearest[:, 0]) < 1e-5
        a = np.floor(grid)
        a[:, 0] = np.where(vertical, nearest[:, 0], a[:, 0])
        a[:, 1] = np.where(vertical, a[:, 1], nearest[:, 1])
        b = a + np.column_stack((~vertical, vertical))
        a, b = origin + a * step, origin + b * step
        first, _ = evaluator.levels(a)
        above = first >= level
        middle = line.copy()
        active = np.ones(len(line), dtype=np.bool_)
        for _ in range(32):
            if not np.any(active):
                break
            indices = np.flatnonzero(active)
            mid = (a[indices] + b[indices]) / 2
            values, _ = evaluator.levels(mid)
            middle[indices] = mid
            done = np.abs(values - level) <= tolerance
            same = (values >= level) == above[indices]
            a[indices[same]] = mid[same]
            b[indices[~same]] = mid[~same]
            active[indices[done]] = False
        if np.array_equal(line[0], line[-1]):
            middle[-1] = middle[0]
        lngs = np.degrees(middle[:, 0] / EARTH_RADIUS)
        lats = np.degrees(2 * np.arctan(np.exp(middle[:, 1] / EARTH_RADIUS)) - math.pi / 2)
        geographic.append([(float(lng), float(lat)) for lng, lat in zip(lngs, lats, strict=True)])
    return Contour(level_db=level, lines=geographic)


def lines_within_scope(field: ContourField, lines: list[list[tuple[float, float]]], radius: float) -> bool:
    """Check contour vertices and segment midpoints against the display screening scope.

    Args:
        field: Prepared source coefficients.
        lines: Unwrapped geographic paths.
        radius: Maximum allowed nearest-source distance in metres.

    Returns:
        Whether every sampled path point remains within scope; no line is clipped.
    """
    coefficients = np.asarray(field.sources, dtype=np.float64)
    for line in lines:
        points = np.asarray(line, dtype=np.float64)
        samples = np.concatenate((points, (points[:-1] + points[1:]) / 2))
        for start in range(0, len(samples), BATCH_SIZE):
            chunk = np.radians(samples[start : start + BATCH_SIZE])
            lng, lat = chunk[:, 0, None], chunk[:, 1, None]
            h = (
                np.sin((lat - coefficients[:, 2]) / 2) ** 2
                + np.cos(lat) * np.cos(coefficients[:, 2]) * np.sin((lng - coefficients[:, 3]) / 2) ** 2
            )
            distances = 2 * EARTH_RADIUS * np.arcsin(np.sqrt(np.clip(h, 0, 1)))
            if np.any(np.min(distances, axis=1) > radius):
                return False
    return True
