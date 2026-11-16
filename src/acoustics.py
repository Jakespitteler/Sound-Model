"""Indicative full-space point-source model, not a compliance assessment."""

import math

from .types import Contribution, MachineType, Point, Position, Receiver, Source


def distance_metres(a: Source, b: Receiver | Position) -> float:
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = lat2 - lat1
    dlon = math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6_371_008.8 * math.asin(math.sqrt(min(1, max(0, h))))


def source_level(sound_power: float, distance: float) -> float:
    return sound_power - 20 * math.log10(max(1, distance)) - 10 * math.log10(4 * math.pi)


def combine(levels: list[float]) -> float | None:
    if not levels:
        return None
    highest: float = max(levels)
    return highest + 10 * math.log10(sum(10 ** ((level - highest) / 10) for level in levels))


def at_point(point: Receiver, sources: list[Source], types: dict[str, MachineType]) -> Point:
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
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def inverse_mercator(y: float) -> float:
    return math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)
