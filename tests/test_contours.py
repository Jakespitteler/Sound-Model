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


@pytest.mark.parametrize("levels", [[45, 45], [-1], [181], [float("nan")], [float("inf")], list(range(26))])
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
