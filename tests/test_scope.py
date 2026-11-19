"""Adaptive display relevance, independent of receiver distance and source filtering."""

import math

import pytest
from fastapi.testclient import TestClient

from src.acoustics import at_point, distance_metres
from src.contours import build_contours
from src.main import app
from src.scope import boundary_level, screen_receiver
from src.types import ContourRequest, MachineType, Receiver, Source


def test_perth_depends_on_background_not_distance() -> None:
    """Retain raw distant arithmetic unless a supplied background makes it negligible."""
    source = Source(id="s", type_id="t", lat=-33.866, lng=116.056)
    perth = Receiver(id="r", lat=-31.9523, lng=115.8613)
    machine = MachineType(id="t", name="Fictional", lwa=120)
    distance = distance_metres(source, perth)
    assert 210_000 < distance < 220_000
    expected = 120 - 20 * math.log10(distance) - 10 * math.log10(4 * math.pi)
    body = {"types": [machine.model_dump()], "sources": [source.model_dump()], "receivers": [perth.model_dump()]}
    with TestClient(app) as client:
        raw = client.post("/api/predict", json=body).json()["receivers"]["r"]
        negligible = client.post("/api/predict", json={**body, "background_db": 40}).json()["receivers"]["r"]
    assert raw["status"] == "ok" and raw["level_db"] == pytest.approx(expected)
    assert negligible["status"] == "negligible" and negligible["level_db"] is None
    assert negligible["contributions"] == []
    assert negligible["nearest_source_m"] == pytest.approx(distance)


def test_boundary_matches_independent_energy_ratio() -> None:
    """The threshold raises background by 0.1 dB, including negative backgrounds."""
    for background in (-30, 0, 30, 40, 50, 100):
        threshold = boundary_level(background)
        increase = 10 * math.log10(1 + 10 ** ((threshold - background) / 10))
        assert increase == pytest.approx(0.1, abs=1e-13)
        assert threshold - background == pytest.approx(-16.327747172, abs=1e-8)


def test_combination_happens_before_negligibility() -> None:
    """Two individually negligible sources can be significant together."""
    sources = [Source(id=str(i), type_id="t", lat=0, lng=0) for i in range(2)]
    receiver = Receiver(id="r", lat=0, lng=0.01)
    # Each machine is 0.5 dB below the 0.1 dB-increase boundary at this receiver.
    power = (
        boundary_level(40) - 0.5 + 20 * math.log10(distance_metres(sources[0], receiver)) + 10 * math.log10(4 * math.pi)
    )
    types = {"t": MachineType(id="t", name="Fictional", lwa=power)}
    assert screen_receiver(at_point(receiver, sources[:1], types), 40).status == "negligible"
    total = screen_receiver(at_point(receiver, sources, types), 40)
    assert total.status == "ok" and len(total.contributions) == 2
    assert total.level_db == pytest.approx(boundary_level(40) - 0.5 + 10 * math.log10(2))


def test_distance_and_negative_levels_are_not_cutoffs() -> None:
    """A loud source beyond 10 km and a quiet negative result remain available."""
    source = Source(id="s", type_id="t", lat=0, lng=0)
    for distance in (10_000, 10_001, 15_000, 300_000):
        receiver = Receiver(id="r", lat=0, lng=math.degrees(distance / 6_371_008.8))
        raw = at_point(receiver, [source], {"t": MachineType(id="t", name="Fictional", lwa=130)})
        assert screen_receiver(raw).level_db == raw.level_db
        if distance == 15_000:
            assert screen_receiver(raw, 40).status == "ok"
    quiet = at_point(Receiver(id="r", lat=0, lng=0.01), [source], {"t": MachineType(id="t", name="Quiet", lwa=60)})
    assert quiet.level_db is not None and quiet.level_db < 0
    assert screen_receiver(quiet).level_db == quiet.level_db


def test_contours_are_adaptive_and_fail_independently() -> None:
    """Separate negligible levels, projection failures, valid lines and no crossings."""
    scenario = ContourRequest(
        types=[MachineType(id="t", name="Fictional", lwa=130)],
        sources=[Source(id="s", type_id="t", lat=0, lng=0)],
        levels=[10, boundary_level(40), 30, 400],
        background_db=40,
    )
    results = build_contours(scenario).contours
    assert [c.status for c in results] == ["negligible", "ok", "ok", "empty"]
    assert results[1].lines and results[2].lines
    failed = build_contours(scenario.model_copy(update={"background_db": None, "levels": [-100, 30]})).contours
    assert failed[0].status == "failed" and "projection" in (failed[0].error or "")
    assert failed[1].status == "ok" and failed[1].lines


def test_contours_have_no_200_km_or_numeric_level_cap() -> None:
    """A calculable 282 km ring is retained; negative and >300 levels are valid inputs."""
    scenario = ContourRequest(
        types=[MachineType(id="t", name="Fictional", lwa=120)],
        sources=[Source(id="s", type_id="t", lat=0, lng=0)],
        levels=[0, -1, 400],
    )
    results = build_contours(scenario).contours
    assert [c.status for c in results] == ["ok", "ok", "empty"]
    for lng, lat in results[0].lines[0]:
        distance = distance_metres(scenario.sources[0], Receiver(id="r", lat=lat, lng=lng))
        assert distance == pytest.approx(math.sqrt(10**12 / (4 * math.pi)), rel=0.003)


@pytest.mark.parametrize("level", [-1e308, 1e308])
def test_extreme_finite_levels_do_not_crash(level: float) -> None:
    """Report an explicit geometry failure or empty level rather than an overflow.

    Args:
        level: Extreme but finite input, with no arbitrary numeric cap.
    """
    with TestClient(app) as client:
        result = client.post(
            "/api/contours",
            json={
                "types": [{"id": "t", "name": "Test", "lwa": 120}],
                "sources": [{"id": "s", "type_id": "t", "lat": 0, "lng": 0}],
                "levels": [level],
            },
        )
    assert result.status_code == 200
    assert result.json()["contours"][0]["status"] in ("failed", "empty")


def test_near_field_and_no_source_states_survive_background() -> None:
    """No machinery is distinct from negligible machinery; near-field warnings survive."""
    source = Source(id="s", type_id="t", lat=0, lng=0)
    receiver = Receiver(id="r", lat=0, lng=0)
    types = {"t": MachineType(id="t", name="Fictional", lwa=120)}
    assert screen_receiver(at_point(receiver, [], types), 40).status == "no_sources"
    scoped = screen_receiver(at_point(receiver, [source], types), 200)
    assert scoped.status == "negligible" and scoped.near_field
