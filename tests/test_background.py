"""Uniform background validation and saved-scene compatibility."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.scenario_files import ScenarioDocument
from src.types import Scenario


@pytest.mark.parametrize("value", [None, -30, 0, 40, 1e308, -1e308])
def test_background_round_trip(value: float | None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep the exact user input in saves, validation and prediction payloads.

    Args:
        value: Finite background or explicitly unset.
        tmp_path: Isolated save folder.
        monkeypatch: Temporary environment override.
    """
    monkeypatch.setenv("SOUND_MODEL_DATA_DIR", str(tmp_path))
    document = ScenarioDocument(
        types=[], sources=[], receivers=[], levels=[-5, 500], cloud_cover=0, background_db=value
    )
    with TestClient(app) as client:
        saved = client.post("/api/scenarios", json={"name": "Fictional", "document": document.model_dump()})
        assert saved.status_code == 201
        identifier = saved.json()["id"]
        assert client.get(f"/api/scenarios/{identifier}").json()["document"]["background_db"] == value
        assert client.post("/api/scenarios/validate", json=document.model_dump()).json()["background_db"] == value
        result = client.post("/api/predict", json={**Scenario().model_dump(), "background_db": value})
        assert result.status_code == 200


@pytest.mark.parametrize("value", ["40", True, float("nan"), float("inf")])
def test_background_rejects_invalid_values(value: object) -> None:
    """Reject invalid inputs rather than substituting a background estimate.

    Args:
        value: Non-numeric or non-finite value.
    """
    with TestClient(app) as client:
        result = client.post(
            "/api/predict", content=json.dumps({"background_db": value}), headers={"Content-Type": "application/json"}
        )
    assert result.status_code == 422


def test_legacy_background_is_unset() -> None:
    """Old scenes open without acquiring an invented background or a new distance limit."""
    document = ScenarioDocument(types=[], sources=[], receivers=[], levels=[], cloud_cover=0)
    assert document.background_db is None


def test_extreme_background_with_active_sources_is_bounded() -> None:
    """Extreme finite inputs report statuses without exponent overflow or HTTP 500."""
    with TestClient(app) as client:
        for background in (-1e308, 1e308):
            body = {
                "background_db": background,
                "types": [{"id": "t", "name": "Fictional", "lwa": 120}],
                "sources": [{"id": "s", "type_id": "t", "lat": 0, "lng": 0}],
                "receivers": [{"id": "r", "lat": 0, "lng": 0.01}],
            }
            assert client.post("/api/predict", json=body).status_code == 200
            assert client.post("/api/contour-range", json=body).status_code == 200
            assert client.post("/api/contours", json={**body, "levels": [-1e308, 40, 1e308]}).status_code == 200
