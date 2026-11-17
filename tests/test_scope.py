"""Screening policy and the Perth sniff test, separate from underlying acoustic arithmetic."""

import math

import pytest
from fastapi.testclient import TestClient

from src.acoustics import at_point, distance_metres, source_level
from src.contours import build_contours
from src.main import app
from src.types import ContourRequest, MachineType, Receiver, Source


def test_perth_is_not_presented_as_an_audibility_prediction() -> None:
    """Check metre-based arithmetic, then hide its unsupported distant extrapolation."""
    source = Source(id="s", type_id="t", lat=-33.866, lng=116.056)
    perth = Receiver(id="r", lat=-31.9523, lng=115.8613)
    machine = MachineType(id="t", name="Guessed machine", lwa=120)
    distance = distance_metres(source, perth)
    assert 210_000 < distance < 220_000
    # Free-field arithmetic alone gives a small positive level, not proof of hearing it.
    expected = 120 - 20 * math.log10(distance) - 10 * math.log10(4 * math.pi)
    assert 2 < expected < 3
    assert at_point(perth, [source], {"t": machine}).level_db == pytest.approx(expected)
    with TestClient(app) as client:
        result = client.post(
            "/api/predict",
            json={"types": [machine.model_dump()], "sources": [source.model_dump()], "receivers": [perth.model_dump()]},
        ).json()["receivers"]["r"]
    assert result["status"] == "out_of_scope"
    assert result["level_db"] is None
    assert result["contributions"] == []
    assert result["nearest_source_m"] == pytest.approx(distance)


def test_negative_pressure_levels_are_valid_within_scope() -> None:
    """A negative dB value is below a reference pressure, never negative energy."""
    with TestClient(app) as client:
        result = client.post(
            "/api/predict",
            json={
                "types": [{"id": "t", "name": "Quiet example", "lwa": 60}],
                "sources": [{"id": "s", "type_id": "t", "lat": 0, "lng": 0}],
                "receivers": [{"id": "r", "lat": 0, "lng": 0.01}],
            },
        ).json()["receivers"]["r"]
    assert result["status"] == "ok"
    assert result["level_db"] < 0
    assert result["level_db"] == pytest.approx(source_level(60, 1111.950802), abs=0.001)


def test_one_failed_level_does_not_remove_other_contours() -> None:
    """Retain geometry and distinguish failed, calculated and unreachable thresholds."""
    scenario = ContourRequest(
        types=[MachineType(id="t", name="Test", lwa=120)],
        sources=[Source(id="s", type_id="t", lat=0, lng=0)],
        levels=[0, 40, 80, 120],
    )
    result = build_contours(scenario).contours
    assert [c.status for c in result] == ["failed", "ok", "ok", "empty"]
    assert result[0].error and "200 km" in result[0].error
    assert result[1].lines and result[2].lines
    assert result[3].error is None


def test_low_contour_outside_scope_is_not_clipped_or_drawn() -> None:
    """A continent-spanning geometry-only level line must not look like valid coverage."""
    scenario = ContourRequest(
        types=[MachineType(id="t", name="Test", lwa=120)],
        sources=[Source(id="s", type_id="t", lat=0, lng=0)],
        levels=[10, 60],
    )
    results = build_contours(scenario).contours
    assert results[0].status == "failed"
    assert results[0].error and "10 km" in results[0].error
    assert results[0].lines == []
    assert results[1].status == "ok" and results[1].lines
