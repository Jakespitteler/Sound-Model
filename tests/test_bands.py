"""Independent band-energy references, completeness and legacy invariance."""

import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.bands import at_receiver_bands
from src.main import app
from src.types import MachineType, Receiver, Scenario, Source, Spectrum


def spectrum(level: float = 100, period: float = 60) -> Spectrum:
    """Create explicitly fictional unweighted evidence.

    Args:
        level: Constant per-band level, not a reconstruction of LwA.
        period: Averaging duration in seconds.

    Returns:
        Complete test spectrum with an assumption reference.
    """
    return Spectrum(levels=[level] * 9, period_s=period, reference="Fictional fixture")


def test_band_energy_distance_and_no_weighting() -> None:
    """At 100 m, independent intensity agrees; distance and source count follow energy."""
    source = Source(id="s", type_id="t", lat=0, lng=0)
    types = {"t": MachineType(id="t", name="Fictional", lwa=10, spectrum=spectrum())}
    background = spectrum(40)
    for distance in (100, 200):
        receiver = Receiver(id="r", lat=0, lng=math.degrees(distance / 6371008.8))
        row = at_receiver_bands(receiver, [source], types, background)[4]
        expected = 10 * math.log10(10**10 / (4 * math.pi * distance**2))
        assert row.status == "ok" and row.machine_db == pytest.approx(expected)
        assert row.difference_db == pytest.approx(expected - 40)
        pair = at_receiver_bands(receiver, [source, source.model_copy(update={"id": "s2"})], types, background)[4]
        assert pair.machine_db == pytest.approx(expected + 10 * math.log10(2))


def test_unknown_source_is_not_dropped() -> None:
    """One missing source invalidates that band's total, retaining known other bands."""
    a = Source(id="a", type_id="a", lat=0, lng=0)
    b = Source(id="b", type_id="b", lat=0, lng=0.1)
    partial = spectrum()
    partial.levels[0] = None
    types = {
        "a": MachineType(id="a", name="A", lwa=100, spectrum=spectrum()),
        "b": MachineType(id="b", name="B", lwa=100, spectrum=partial),
    }
    rows = at_receiver_bands(Receiver(id="r", lat=0, lng=0.01), [a, b], types, spectrum(40))
    assert rows[0].status == "missing_source_data" and rows[0].machine_db is None and rows[0].missing_sources == ["b"]
    assert rows[1].status == "ok"


def test_basis_missing_background_and_near_field() -> None:
    """Preserve unknown/basis states without converting them into a hearing verdict."""
    source = Source(id="s", type_id="t", lat=0, lng=0)
    receiver = Receiver(id="r", lat=0, lng=0)
    types = {"t": MachineType(id="t", name="T", lwa=100, spectrum=spectrum())}
    assert at_receiver_bands(receiver, [source], types, None)[0].status == "missing_background"
    row = at_receiver_bands(receiver, [source], types, spectrum(40, 300))[0]
    assert row.near_field and row.status == "incompatible_basis" and row.difference_db is None
    assert at_receiver_bands(receiver, [], types, spectrum(40))[0].status == "no_sources"
    types["t"].spectrum = Spectrum(levels=[100] * 9)
    assert at_receiver_bands(receiver, [source], types, spectrum(40))[0].machine_db is None


@pytest.mark.parametrize(
    "patch",
    [
        {"levels": [1] * 8},
        {"levels": [1] * 10},
        {"levels": [True] * 9},
        {"levels": [float("nan")] * 9},
        {"levels": [float("inf")] * 9},
        {"weighting": "A"},
        {"metric": "Lmax"},
        {"period_s": 0},
        {"period_s": -1},
    ],
)
def test_reject_incompatible_spectrum(patch: dict[str, object]) -> None:
    """Reject unknown weighting/metrics, wrong grids and invalid values.

    Args:
        patch: Invalid input changes.
    """
    with pytest.raises(ValidationError):
        Spectrum.model_validate({**spectrum().model_dump(), **patch})


def test_optional_bands_do_not_change_overall_or_contours() -> None:
    """Adding spectra affects only band results, with no change to baseline geometry."""
    body = {
        "types": [{"id": "t", "name": "T", "lwa": 110}],
        "sources": [{"id": "s", "type_id": "t", "lat": 0, "lng": 0}],
        "receivers": [{"id": "r", "lat": 0, "lng": 0.01}],
        "background_db": 45,
    }
    with TestClient(app) as client:
        original = client.post("/api/predict", json=body).json()
        contour = client.post("/api/contours", json={**body, "levels": [40]}).json()
        scenario = Scenario.model_validate(body)
        scenario.types[0].spectrum = spectrum(-10)
        scenario.background_spectrum = spectrum(-20)
        body = scenario.model_dump()
        enriched = client.post("/api/predict", json=body).json()
        assert enriched["receivers"] == original["receivers"]
        assert original["band_results"] == {} and len(enriched["band_results"]["r"]) == 9
        assert client.post("/api/contours", json={**body, "levels": [40]}).json() == contour


def test_source_basis_mismatch_and_extreme_difference() -> None:
    """Do not sum incompatible averages or emit an infinite signed difference."""
    source = Source(id="a", type_id="a", lat=0, lng=0)
    receiver = Receiver(id="r", lat=0, lng=0)
    types = {
        "a": MachineType(id="a", name="A", lwa=100, spectrum=spectrum()),
        "b": MachineType(id="b", name="B", lwa=100, spectrum=spectrum(100, 300)),
    }
    rows = at_receiver_bands(
        receiver, [source, source.model_copy(update={"id": "b", "type_id": "b"})], types, spectrum(40)
    )
    assert rows[0].status == "incompatible_basis" and rows[0].machine_db is None
    types["a"].spectrum = spectrum(1e308)
    row = at_receiver_bands(receiver, [source], types, spectrum(-1e308))[0]
    assert row.status == "unavailable" and row.difference_db is None


def test_saved_spectra_round_trip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Save complete and partial evidence without inventing missing bands.

    Args:
        tmp_path: Isolated storage directory supplied by pytest.
        monkeypatch: Temporary environment override.
    """
    monkeypatch.setenv("SOUND_MODEL_DATA_DIR", str(tmp_path))
    partial = spectrum(-10)
    partial.levels[3] = None
    document = {
        "version": 1,
        "types": [{"id": "t", "name": "T", "lwa": 110, "spectrum": partial.model_dump()}],
        "sources": [{"id": "s", "type_id": "t", "lat": 0, "lng": 0}],
        "receivers": [],
        "levels": [40],
        "cloud_cover": 0,
        "background_spectrum": spectrum(30).model_dump(),
    }
    with TestClient(app) as client:
        saved = client.post("/api/scenarios", json={"name": "Fictional spectral evidence", "document": document})
        assert saved.status_code == 201
        identifier = saved.json()["id"]
        loaded = client.get(f"/api/scenarios/{identifier}").json()["document"]
        assert loaded["types"][0]["spectrum"] == partial.model_dump()
        assert loaded["background_spectrum"] == spectrum(30).model_dump()
        assert client.post("/api/scenarios/validate", json=loaded).json() == loaded
