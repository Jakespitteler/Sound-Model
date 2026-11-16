"""Analytical geometry and HTTP regression tests for combined noise contours."""

import math

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.acoustics import at_point, distance_metres
from src.contours import build_contours
from src.main import app
from src.types import ContourRequest, MachineType, Receiver, Source


def request_for(levels: list[float], sources: list[Source] | None = None, power: float = 110) -> ContourRequest:
    """Build a compact source-centred test scenario near Greenbushes.

    Args:
        levels: Requested contour thresholds.
        sources: Source instances, defaulting to one machine at Greenbushes.
        power: Shared machine sound power in dB(A).

    Returns:
        A validated contour request with no receiver or camera dependency.
    """
    return ContourRequest(
        types=[MachineType(id="t", name="Test", lwa=power)],
        sources=[Source(id="s", type_id="t", lat=-33.86, lng=116.05)] if sources is None else sources,
        levels=levels,
    )


@pytest.mark.parametrize("level", [35, 45, 55, 65, 85, 95])
def test_single_source_closed_ring_matches_analytical_radius(level: float) -> None:
    """Keep both compact and distant rings within the vertex error tolerance.

    Args:
        level: Threshold covering single-source radii from metres to kilometres.
    """
    scenario = request_for([level])
    contour = build_contours(scenario).contours[0]
    assert len(contour.lines) == 1
    line = contour.lines[0]
    assert line[0] == line[-1]
    assert len(line) > 60
    radius = math.sqrt(10 ** ((110 - level) / 10) / (4 * math.pi))
    for lng, lat in line:
        distance = distance_metres(scenario.sources[0], Receiver(id="r", lat=lat, lng=lng))
        assert distance == pytest.approx(radius, rel=0.003)


def test_two_sources_form_one_outer_and_two_inner_rings() -> None:
    """Combined energy joins outer contours while high thresholds retain two lobes."""
    sources = [
        Source(id="a", type_id="t", lat=-33.86, lng=116.05),
        Source(id="b", type_id="t", lat=-33.86, lng=116.054),
    ]
    scenario = request_for([45, 70], sources)
    result = build_contours(scenario)
    assert len(result.contours[0].lines) == 1
    assert len(result.contours[1].lines) == 2
    types = {t.id: t for t in scenario.types}
    for contour in result.contours:
        for line in contour.lines:
            assert line[0] == line[-1]
            for lng, lat in line:
                reading = at_point(Receiver(id="r", lat=lat, lng=lng), sources, types)
                assert reading.level_db == pytest.approx(contour.level_db, abs=0.021)


def test_colocated_sources_expand_radius_by_sqrt_two() -> None:
    """Combined contours represent the sum, not independent circles per machine."""
    sources = [Source(id=str(i), type_id="t", lat=0, lng=0) for i in range(2)]
    scenario = request_for([55], sources, power=100)
    contour = build_contours(scenario).contours[0]
    expected = math.sqrt(2 * 10 ** ((100 - 55) / 10) / (4 * math.pi))
    for lng, lat in contour.lines[0]:
        assert distance_metres(sources[0], Receiver(id="r", lat=lat, lng=lng)) == pytest.approx(expected, rel=0.003)


def test_empty_and_unreached_levels() -> None:
    """No sources, no levels and thresholds above the source maximum stay explicit."""
    assert build_contours(request_for([55], sources=[])).contours[0].lines == []
    assert build_contours(request_for([])).contours == []
    assert build_contours(request_for([110])).contours[0].lines == []


def test_distant_source_does_not_erase_compact_ring() -> None:
    """A wide multi-source domain preserves high thresholds around both machines."""
    sources = [Source(id="a", type_id="t", lat=0, lng=0), Source(id="b", type_id="t", lat=0, lng=0.1)]
    contours = build_contours(request_for([85], sources))
    assert len(contours.contours[0].lines) == 2
    assert all(line[0] == line[-1] for line in contours.contours[0].lines)


def test_antimeridian_sources_remain_neighbours() -> None:
    """A nearby pair across ±180° produces a local combined ring, not a globe-wide domain."""
    sources = [Source(id="a", type_id="t", lat=0, lng=179.999), Source(id="b", type_id="t", lat=0, lng=-179.999)]
    contour = build_contours(request_for([45], sources)).contours[0]
    assert len(contour.lines) == 1
    longitudes = [point[0] for point in contour.lines[0]]
    assert max(longitudes) - min(longitudes) < 0.1


@pytest.mark.parametrize("levels", [[45, 45], [-1], [301], [float("nan")], [float("inf")], list(range(26))])
def test_contour_input_limits(levels: list[float]) -> None:
    """Reject ambiguous or unbounded requests before computing any geometry.

    Args:
        levels: Invalid thresholds under test.
    """
    with pytest.raises(ValidationError):
        request_for(levels)


def test_contour_api_and_domain_limit() -> None:
    """Return typed geometry and explicit errors instead of silently clipped lines."""
    with TestClient(app) as client:
        response = client.post("/api/contours", json=request_for([55]).model_dump())
        assert response.status_code == 200
        assert response.json()["contours"][0]["lines"]
        response = client.post("/api/contours", json=request_for([0], power=180).model_dump())
        assert response.status_code == 422
        assert "200 km" in response.json()["detail"]


def test_camera_and_style_fields_are_not_acoustic_inputs() -> None:
    """Viewport and presentation edits cannot accidentally change the physical domain."""
    with TestClient(app) as client:
        payload = request_for([55]).model_dump()
        for field in ("bounds", "color"):
            response = client.post("/api/contours", json={**payload, field: {}})
            assert response.status_code == 422


def test_exact_near_field_maximum_keeps_boundary() -> None:
    """An exactly attainable clamped maximum has a 1 m boundary, not no contour."""
    from src.acoustics import source_level

    scenario = request_for([source_level(110, 1)])
    contour = build_contours(scenario).contours[0]
    assert len(contour.lines) == 1
    for lng, lat in contour.lines[0]:
        assert distance_metres(scenario.sources[0], Receiver(id="r", lat=lat, lng=lng)) == pytest.approx(1, abs=0.06)


def test_contour_field_matches_direct_physics_and_bounds() -> None:
    """Check independent energy arithmetic and conservative pruning across latitudes.

    This exercises mixed powers, projected coordinates and sub-cell distance bounds,
    rather than merely checking two implementations against each other.
    """
    from src.acoustics import mercator_y
    from src.contours import EARTH_RADIUS, ContourField

    for latitude in (0, -33.86, 70):
        sources = [
            Source(id="a", type_id="t", lat=latitude, lng=116.05),
            Source(id="b", type_id="weak", lat=latitude + 0.001, lng=116.052),
        ]
        scenario = ContourRequest(
            types=[MachineType(id="t", name="Loud", lwa=110), MachineType(id="weak", name="Quiet", lwa=70)],
            sources=sources,
            levels=[55],
        )
        field = ContourField(scenario)
        types = {t.id: t for t in scenario.types}
        centre = (EARTH_RADIUS * math.radians(116.053), EARTH_RADIUS * mercator_y(latitude + 0.002))
        lo, hi = field.range_at(centre, 50)
        for dx, dy in ((0, 0), (30, 30), (-30, -30), (50, 0), (0, -50)):
            xy = (centre[0] + dx, centre[1] + dy)
            lng, lat = field.geographic(xy)
            receiver = Receiver(id="r", lat=lat, lng=lng)
            distances = [distance_metres(s, receiver) for s in sources]
            energy = sum(
                10 ** (types[s.type_id].lwa / 10) / (4 * math.pi * max(1, d) ** 2)
                for s, d in zip(sources, distances, strict=True)
            )
            expected = 10 * math.log10(energy)
            assert field.value(xy) == pytest.approx(expected, abs=1e-8)
            assert at_point(receiver, sources, types).level_db == pytest.approx(expected, abs=1e-8)
            assert lo <= expected <= hi


def test_300_db_source_and_contour_are_supported() -> None:
    """Accept the new numeric ceiling without changing spreading or energy physics."""
    scenario = request_for([280], power=300)
    contour = build_contours(scenario).contours[0]
    assert contour.level_db == 280
    assert len(contour.lines) == 1
    radius = math.sqrt(100 / (4 * math.pi))
    for lng, lat in contour.lines[0]:
        distance = distance_metres(scenario.sources[0], Receiver(id="r", lat=lat, lng=lng))
        assert distance == pytest.approx(radius, rel=0.003)
    # A threshold at the accepted ceiling can be unreachable, which is an empty result.
    assert build_contours(request_for([300], power=300)).contours[0].lines == []


def test_complexity_error_identifies_level_and_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    """Report computational exhaustion clearly without changing or dropping sources.

    Args:
        monkeypatch: Fixture temporarily lowering the budget to reproduce exhaustion.
    """
    import src.contours as contour_module

    monkeypatch.setattr(contour_module, "MAX_CELLS", 1)
    with TestClient(app) as client:
        response = client.post("/api/contours", json=request_for([55]).model_dump())
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "55 dB(A)" in detail
    assert "1-cell" in detail
    assert "Receiver predictions remain available" in detail


def test_vectorised_field_matches_scalar_across_batch_boundary() -> None:
    """Keep compiled sampling/bounds identical to the scalar physical reference."""
    import numpy as np

    from src.contour_engine import BATCH_SIZE, ArrayField
    from src.contours import ContourField

    scenario = request_for([55])
    field = ContourField(scenario)
    array_field = ArrayField(field)
    centre = np.asarray(field.sources[0][:2])
    offsets = np.linspace(-100, 100, BATCH_SIZE + 3)
    points = centre + np.column_stack((offsets, offsets / 2))
    values, _ = array_field.levels(points)
    lower, upper = array_field.levels(points, np.full(len(points), 5.0))
    for index in (0, BATCH_SIZE // 2, BATCH_SIZE - 1, BATCH_SIZE, BATCH_SIZE + 2):
        point = (float(points[index, 0]), float(points[index, 1]))
        assert values[index] == pytest.approx(field.value(point), abs=1e-8)
        lo, hi = field.range_at(point, 5)
        assert lower[index] == pytest.approx(lo, abs=1e-8)
        assert upper[index] == pytest.approx(hi, abs=1e-8)


def test_mixed_power_contour_exceeds_old_budget_but_completes(monkeypatch: pytest.MonkeyPatch) -> None:
    """Exercise the measured fourfold budget increase without lowering spatial accuracy.

    Args:
        monkeypatch: Fixture restoring the production complexity guard after comparison.
    """
    import src.contours as contour_module

    scenario = ContourRequest(
        types=[MachineType(id="a", name="Loud", lwa=150), MachineType(id="b", name="Quieter", lwa=105)],
        sources=[Source(id="a", type_id="a", lat=0, lng=0), Source(id="b", type_id="b", lat=0, lng=0.001)],
        levels=[55],
    )
    with monkeypatch.context() as patch:
        patch.setattr(contour_module, "MAX_CELLS", 160_000)
        with pytest.raises(ValueError, match="160,000-cell"):
            build_contours(scenario)
    result = build_contours(scenario).contours[0]
    assert len(result.lines) == 1
    assert result.lines[0][0] == result.lines[0][-1]
    types = {t.id: t for t in scenario.types}
    for lng, lat in result.lines[0][::100]:
        reading = at_point(Receiver(id="r", lat=lat, lng=lng), scenario.sources, types)
        assert reading.level_db == pytest.approx(55, abs=0.021)


def test_colocated_300_db_sources_keep_attainable_maximum() -> None:
    """Avoid floating-point bound pruning at a combined clamped plateau maximum."""
    from src.acoustics import combine, source_level

    maximum = combine([source_level(300, 1)] * 2)
    assert maximum is not None
    scenario = request_for(
        [maximum], power=300, sources=[Source(id=str(i), type_id="t", lat=0, lng=0) for i in range(2)]
    )
    result = build_contours(scenario).contours[0]
    assert len(result.lines) == 1
    assert result.lines[0][0] == result.lines[0][-1]
