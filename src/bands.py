"""Optional unweighted octave-band geometry; no masking, weighting or detection model."""

import math

from .acoustics import combine, distance_metres, source_level
from .types import BandReading, MachineType, Receiver, Source, Spectrum

FREQUENCIES_HZ = (31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000)


def at_receiver_bands(
    receiver: Receiver, sources: list[Source], types: dict[str, MachineType], background: Spectrum | None
) -> list[BandReading]:
    """Evaluate complete compatible source bands before comparing with background.

    Args:
        receiver: Listening coordinates; the existing 1 m distance clamp applies.
        sources: All active sources, never filtered by distance or camera.
        types: Catalogue including optional unweighted sound-power evidence.
        background: Uniform unweighted pressure evidence, or missing.

    Returns:
        Nine band results with explicit unknown/incompatible states. Matching Leq
        durations are necessary, not proof that measurements represent the same operation.
        Overall LwA results, contours and the background display rule are unaffected.
    """
    distances = {source.id: distance_metres(source, receiver) for source in sources}
    results: list[BandReading] = []
    for index, frequency in enumerate(FREQUENCIES_HZ):
        row = BandReading(
            frequency_hz=frequency, status="no_sources", near_field=any(d < 1 for d in distances.values())
        )
        row.background_db = background.levels[index] if background else None
        if not sources:
            results.append(row)
            continue
        levels: list[float] = []
        periods: set[float] = set()
        for source in sources:
            spectrum = types[source.type_id].spectrum
            if spectrum is None or spectrum.levels[index] is None or spectrum.period_s is None:
                row.missing_sources.append(source.id)
                continue
            power = spectrum.levels[index]
            assert power is not None
            levels.append(source_level(power, distances[source.id]))
            periods.add(spectrum.period_s)
        if row.missing_sources:
            row.status = "missing_source_data"
        elif len(periods) != 1:
            row.status = "incompatible_basis"
        else:
            row.machine_db = combine(levels)
            if background is None or row.background_db is None:
                row.status = "missing_background"
            elif background.period_s not in periods:
                row.status = "incompatible_basis"
            else:
                assert row.machine_db is not None
                difference = row.machine_db - row.background_db
                row.status = "ok" if math.isfinite(difference) else "unavailable"
                row.difference_db = difference if math.isfinite(difference) else None
        results.append(row)
    return results
