"""Indicative full-space point-source acoustic propagation model.

Implements geodesic Haversine distance calculations, full-space spherical
geometric spreading attenuation, numerically stable energetic decibel summation,
and Web Mercator (EPSG:3857) latitude projections. Intended for exploratory
planning rather than regulatory compliance assessment.
"""

import math

from .types import Contribution, MachineType, Point, Position, Receiver, Source


def distance_metres(a: Source, b: Receiver | Position) -> float:
    """Compute great-circle distance in metres between two WGS84 coordinates.

    Uses the Haversine formula on a sphere with the IUGG mean Earth radius of
    6,371,008.8 m.

    Args:
        a: Origin point source with ``lat`` and ``lng`` in decimal degrees.
        b: Destination receiver or grid position with ``lat`` and ``lng`` in decimal degrees.

    Returns:
        Surface distance between ``a`` and ``b`` in metres.
    """
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = lat2 - lat1
    dlon = math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6_371_008.8 * math.asin(math.sqrt(min(1, max(0, h))))


def source_level(sound_power: float, distance: float) -> float:
    """Calculate free-field sound pressure level from a point source.

    Applies full-space spherical geometric spreading:
    ``Lp = LwA - 20 * log10(max(1, distance)) - 10 * log10(4 * pi)``.
    Distances below 1 m are clamped to 1 m to avoid near-field singularities.

    Args:
        sound_power: Source A-weighted sound power level ($L_{wA}$) in dB(A).
        distance: Propagation distance from source to evaluation point in metres.

    Returns:
        Predicted sound pressure level ($L_p$) in dB(A).
    """
    return sound_power - 20 * math.log10(max(1, distance)) - 10 * math.log10(4 * math.pi)


def combine(levels: list[float]) -> float | None:
    """Combine incoherent sound pressure levels by logarithmic energy summation.

    Normalises exponents relative to the maximum level prior to summation to
    prevent floating-point overflow or underflow across wide dynamic ranges.

    Args:
        levels: Individual sound pressure levels in dB(A).

    Returns:
        Total combined sound pressure level in dB(A), or ``None`` if ``levels`` is empty.
    """
    if not levels:
        return None
    highest: float = max(levels)
    return highest + 10 * math.log10(sum(10 ** ((level - highest) / 10) for level in levels))


def at_point(point: Receiver, sources: list[Source], types: dict[str, MachineType]) -> Point:
    """Evaluate all source contributions and total sound level at a receiver.

    Args:
        point: Target receiver location to evaluate.
        sources: Active acoustic point sources in the scenario.
        types: Lookup mapping from machine type ID to :class:`MachineType`.

    Returns:
        A :class:`Point` containing the energetic sum, near-field flag, and per-source
        contributions.
    """
    contributions: list[Contribution] = []
    for source in sources:
        distance: float = distance_metres(source, point)
        machine: MachineType = types[source.type_id]
        contributions.append(
            Contribution(
                id=source.id,
                name=machine.name,
                distance_m=distance,
                level_db=source_level(machine.lwa, distance),
                near_field=distance < 1,
                provenance=machine.provenance,
            )
        )
    return Point(
        level_db=combine([item.level_db for item in contributions]),
        near_field=any(item.near_field for item in contributions),
        contributions=contributions,
    )


def mercator_y(lat: float) -> float:
    """Project a WGS84 latitude onto the dimensionless Web Mercator Y axis.

    Args:
        lat: Latitude in decimal degrees strictly within ``(-90, 90)``.

    Returns:
        Dimensionless Web Mercator vertical coordinate ``y``.
    """
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def inverse_mercator(y: float) -> float:
    """Convert a dimensionless Web Mercator Y coordinate back to WGS84 latitude.

    Args:
        y: Dimensionless Web Mercator vertical coordinate.

    Returns:
        Corresponding WGS84 latitude in decimal degrees.
    """
    return math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)
