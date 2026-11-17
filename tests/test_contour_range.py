"""Scenario-dependent slider intervals use the existing contour model and scope."""

import pytest
from fastapi.testclient import TestClient

from src.main import app


def scenario(power: float = 110) -> dict[str, object]:
    """Build an isolated one-machine acoustic request.

    Args:
        power: Source sound power in dB(A).

    Returns:
        Request without camera or user-defined criteria.
    """
    return {
        "types": [{"id": "t", "name": "Machine", "lwa": power, "provenance": "example"}],
        "sources": [{"id": "s", "type_id": "t", "lat": -33.86, "lng": 116.07}],
        "receivers": [],
        "cloud_cover": 0,
    }


@pytest.mark.parametrize(("power", "minimum", "maximum"), [(110, 19.1, 98.9), (300, 209.1, 288.9)])
def test_single_source_slider_range(power: float, minimum: float, maximum: float) -> None:
    """Check useful bounds against a full-space analytic reference and actual extracted lines.

    Args:
        power: Known sound power.
        minimum: Expected rounded scope-bound threshold.
        maximum: Expected rounded source-peak threshold.
    """
    with TestClient(app) as client:
        body = scenario(power)
        response = client.post("/api/contour-range", json=body)
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "ok"
        assert result["min_db"] == minimum
        assert result["max_db"] == maximum
        contours = client.post(
            "/api/contours", json={**body, "levels": [minimum, (minimum + maximum) / 2, maximum]}
        ).json()
        assert all(level["status"] == "ok" and level["lines"] for level in contours["contours"])


def test_range_responds_to_layout_and_all_source_power() -> None:
    """Coincident machines sum energy; separation changes the evaluated source peak."""
    with TestClient(app) as client:
        body = scenario()
        body["sources"] = [{"id": name, "type_id": "t", "lat": -33.86, "lng": 116.07} for name in ("a", "b")]
        together = client.post("/api/contour-range", json=body).json()
        assert together["min_db"] == 22.1 and together["max_db"] == 101.9
        body["sources"] = [
            {"id": "a", "type_id": "t", "lat": -33.86, "lng": 116.07},
            {"id": "b", "type_id": "t", "lat": -33.85, "lng": 116.07},
        ]
        apart = client.post("/api/contour-range", json=body).json()
        assert apart["status"] == "ok" and apart["max_db"] < together["max_db"]
        body["cloud_cover"] = 100
        assert client.post("/api/contour-range", json=body).json() == apart


@pytest.mark.parametrize("empty", [False, True])
def test_no_useful_range_is_explicit(empty: bool) -> None:
    """Do not invent a slider interval for absent or too-quiet sources.

    Args:
        empty: Whether to omit machines rather than use a weak source.
    """
    body = scenario(0)
    if empty:
        body["sources"] = []
    with TestClient(app) as client:
        response = client.post("/api/contour-range", json=body)
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "unavailable" and result["min_db"] is None and result["max_db"] is None
        assert result["reason"]
