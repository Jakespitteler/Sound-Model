"""Observed pressure is retained; comparisons never calibrate the geometry model."""

import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.main import app
from src.measurements import Measurement, SourceContext, compare_measurement
from src.types import MachineType, Scenario, Source


def scene() -> Scenario:
    """Return a fictional source setup.

    Returns:
        Single-machine scenario, with no background assumption.
    """
    return Scenario(
        types=[MachineType(id="t", name="Fictional truck", lwa=110)],
        sources=[Source(id="s", type_id="t", lat=0, lng=0)],
    )


def observation() -> Measurement:
    """Return a stationary average with recorded source setup.

    Returns:
        Fictional 100 m field reading; it is not a real site measurement.
    """
    s = scene()
    return Measurement(
        id="m",
        lat=0,
        lng=math.degrees(100 / 6371008.8),
        level_db=60,
        metric="LAeq",
        test_kind="stationary",
        duration_s=60,
        activity="Steady idle",
        source_id="s",
        source_context=SourceContext(**s.sources[0].model_dump(), name="Fictional truck", lwa=110),
    )


def test_current_comparison_uses_all_sources_without_fitting() -> None:
    """Compare pressure quantities separately and retain the entire active-source sum."""
    s = scene()
    m = observation()
    before = s.model_dump()
    one = compare_measurement(m, s)
    expected = 10 * math.log10(10**11 / (4 * math.pi * 100**2))
    assert one.status == "available" and one.point and one.point.level_db == pytest.approx(expected)
    m.level_db = 80
    assert compare_measurement(m, s).point == one.point and s.model_dump() == before
    s.sources.append(s.sources[0].model_copy(update={"id": "other"}))
    pair = compare_measurement(m, s)
    assert pair.point and pair.point.level_db == pytest.approx(expected + 10 * math.log10(2))
    assert len(pair.point.contributions) == 2


@pytest.mark.parametrize(
    "patch",
    [
        {"test_kind": "moving"},
        {"test_kind": "startup"},
        {"test_kind": "unknown"},
        {"metric": "LAmax"},
        {"metric": "unknown"},
        {"duration_s": None},
        {"activity": ""},
        {"source_context": None},
    ],
)
def test_non_comparable_readings_are_retained(patch: dict[str, object]) -> None:
    """Keep observations while refusing inappropriate numerical comparisons.

    Args:
        patch: Missing/incompatible test information.
    """
    m = observation().model_copy(update=patch)
    result = compare_measurement(m, scene())
    assert result.status == "unsupported" and result.point is None and m.level_db == 60


def test_changed_missing_and_negligible_context() -> None:
    """Source edits/removal do not relocate or discard the historical observation."""
    m = observation()
    original = m.model_dump()
    s = scene()
    s.sources[0].lng = 0.01
    assert compare_measurement(m, s).status == "source_changed"
    s.sources = []
    assert compare_measurement(m, s).status == "source_missing" and m.model_dump() == original
    s = scene()
    s.background_db = 100
    result = compare_measurement(m, s)
    assert result.point and result.point.status == "negligible" and result.point.level_db is None


@pytest.mark.parametrize("level", [0, -10, 40.5])
def test_pressure_save_and_legacy_round_trip(level: float, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Retain partial/linked records and unknown meter details through persisted documents.

    Args:
        level: Legitimate pressure value.
        tmp_path: Isolated storage.
        monkeypatch: Temporary data-directory override.
    """
    monkeypatch.setenv("SOUND_MODEL_DATA_DIR", str(tmp_path))
    s = scene()
    m = observation()
    m.level_db = level
    unknown = Measurement(id="unknown", lat=0, lng=0.02, level_db=level)
    document = {**s.model_dump(), "version": 1, "levels": [40], "measurements": [m.model_dump(), unknown.model_dump()]}
    with TestClient(app) as client:
        result = client.post("/api/scenarios", json={"name": "Fictional test", "document": document})
        assert result.status_code == 201
        saved = client.get("/api/scenarios/" + result.json()["id"]).json()["document"]
        assert saved["measurements"] == [m.model_dump(), unknown.model_dump()]
        assert client.post("/api/scenarios/validate", json=saved).json() == saved
        # Historical links may outlive simulated sources.
        saved["sources"] = []
        assert client.post("/api/scenarios/validate", json=saved).status_code == 200
        del saved["measurements"]
        assert client.post("/api/scenarios/validate", json=saved).json()["measurements"] == []


@pytest.mark.parametrize(
    "patch",
    [
        {"level_db": float("nan")},
        {"level_db": float("inf")},
        {"level_db": True},
        {"duration_s": 0},
        {"lat": 86},
        {"metric": "peak"},
        {"source_id": "different"},
    ],
)
def test_invalid_observation_is_rejected(patch: dict[str, object]) -> None:
    """Reject invalid data without converting it into a usable observation.

    Args:
        patch: Invalid input fields.
    """
    with pytest.raises(ValidationError):
        Measurement.model_validate({**observation().model_dump(), **patch})


def test_comparison_api_and_duplicate_ids() -> None:
    """Independent statuses coexist and duplicate IDs cannot overwrite a result."""
    m = observation()
    unknown = Measurement(id="unknown", lat=0, lng=0.01, level_db=50)
    with TestClient(app) as client:
        payload = {**scene().model_dump(), "measurements": [m.model_dump(), unknown.model_dump()]}
        response = client.post("/api/measurements/compare", json=payload)
        assert response.status_code == 200
        assert response.json()["m"]["status"] == "available" and response.json()["unknown"]["point"] is None
        payload["measurements"] = [m.model_dump(), m.model_dump()]
        assert client.post("/api/measurements/compare", json=payload).status_code == 422


def test_changed_operating_label_is_not_treated_as_same_setup() -> None:
    """Mode labels affect comparison context, never emission calibration."""
    m = observation()
    assert compare_measurement(m, scene(), {"s": "Different operation"}).status == "source_changed"
    assert scene().types[0].lwa == 110
