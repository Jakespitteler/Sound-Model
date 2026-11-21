"""In-process HTTP integration tests for the Sound-Model FastAPI application."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict

from src.main import app
from src.types import Prediction


class ValidationErrorItem(BaseModel):
    """Schema for a single sanitised validation error entry returned by the API.

    Forbidding extra fields guarantees raw ``input`` values and ``ctx`` objects
    are never leaked in HTTP 422 responses.

    Attributes:
        loc: Path segments identifying the invalid field in the request payload.
        msg: Human-readable validation error description.
        type: Machine-readable Pydantic error code string.
    """

    model_config = ConfigDict(extra="forbid")

    loc: list[str | int]
    msg: str
    type: str


class ValidationErrorResponse(BaseModel):
    """Schema for HTTP 422 validation error responses.

    Attributes:
        detail: List of sanitised validation error items.
    """

    model_config = ConfigDict(extra="forbid")

    detail: list[ValidationErrorItem]


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    """Yield an in-process FastAPI TestClient with lifespan events initialized.

    Yields:
        An active :class:`TestClient` bound to the FastAPI application.
    """
    with TestClient(app) as test_client:
        yield test_client


@pytest.mark.parametrize(
    ("path", "fragment"),
    [
        ("/", b"Sound-Model"),
        ("/js/main.js", b"api/predict"),
        ("/js/state.js", b"ScenarioStore"),
        ("/css/sidebar.css", b".sidebar"),
        ("/css/contours.css", b".contour-row"),
        ("/vendor/leaflet/leaflet.js", b"Leaflet"),
    ],
)
def test_serves_local_frontend(client: TestClient, path: str, fragment: bytes) -> None:
    """Verify that bundled HTML, JS, CSS, and vendored Leaflet assets are served locally.

    Args:
        client: In-process FastAPI test client.
        path: Static asset URL path to request.
        fragment: Expected byte sequence confirming the asset body was served.
    """
    response = client.get(path)
    assert response.status_code == 200
    assert fragment in response.content


def test_actual_prediction_request(client: TestClient) -> None:
    """Verify full round-trip acoustic prediction over HTTP POST /api/predict.

    Args:
        client: In-process FastAPI test client.
    """
    payload: dict[str, object] = {
        "types": [{"id": "t", "name": "Test", "lwa": 100}],
        "sources": [{"id": "s", "type_id": "t", "lat": 0, "lng": 0}],
        "receivers": [{"id": "r", "lat": 0, "lng": 0.001}],
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200

    prediction: Prediction = Prediction.model_validate_json(response.text)
    level_db: float | None = prediction.receivers["r"].level_db
    assert level_db == pytest.approx(48.086, abs=1e-2)
    assert prediction.example_data is True


def test_rejects_invalid_references(client: TestClient) -> None:
    """Verify that sources referencing an undefined machine type return HTTP 422.

    Args:
        client: In-process FastAPI test client.
    """
    payload: dict[str, object] = {"sources": [{"id": "s", "type_id": "missing", "lat": 0, "lng": 0}]}
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 422


def test_empty_scenario(client: TestClient) -> None:
    """Verify that an empty scenario payload succeeds with no grid or receiver outputs.

    Args:
        client: In-process FastAPI test client.
    """
    response = client.post("/api/predict", json={})
    assert response.status_code == 200

    prediction: Prediction = Prediction.model_validate_json(response.text)
    assert prediction.cloud_correction_db is None
    assert prediction.receivers == {}


@pytest.mark.parametrize("literal", ["1e999", "NaN", "Infinity"])
def test_nonfinite_input_is_validation_error(client: TestClient, literal: str) -> None:
    """Verify that non-finite JSON numeric literals return HTTP 422 without echoing raw inputs.

    Args:
        client: In-process FastAPI test client.
        literal: Non-standard JSON token representing overflow or non-finite floats.
    """
    # Send raw bytes because standard json.dumps rejects NaN/Infinity when allow_nan=False.
    body = f'{{"receivers":[{{"id":"r","lat":{literal},"lng":0}}]}}'
    response = client.post(
        "/api/predict",
        content=body.encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422

    # Strict validation confirms each error item contains only ("loc", "msg", "type").
    error: ValidationErrorResponse = ValidationErrorResponse.model_validate_json(response.text)
    assert len(error.detail) > 0


@pytest.mark.parametrize(
    "path",
    ["/requirements.txt", "/.git/config", "/run.py", "/pyproject.toml", "/templates/index.html", "/src/types.py"],
)
def test_private_repository_files_not_served(client: TestClient, path: str) -> None:
    """Verify that repository metadata and source files outside src/static are not exposed.

    Args:
        client: In-process FastAPI test client.
        path: Root-relative path that should return HTTP 404.
    """
    response = client.get(path)
    assert response.status_code == 404


def test_page_contains_assembled_controls(client: TestClient) -> None:
    """Serve complete markup before JavaScript starts, not unresolved partial slots.

    Args:
        client: In-process FastAPI test client.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert "{{" not in response.text
    for control in ('id="type-form"', 'id="contours"', 'id="map"', 'id="retry"'):
        assert control in response.text
    assert 'defer src="/js/bootstrap.js"' in response.text


def test_script_media_type_ignores_windows_registry(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep ES modules executable even if host MIME configuration labels JS as plain text.

    Args:
        client: In-process application client.
        monkeypatch: Fixture restoring simulated host media-type settings.
    """
    import mimetypes

    monkeypatch.setitem(mimetypes.types_map, ".js", "text/plain")
    monkeypatch.setitem(mimetypes.types_map, ".css", "application/octet-stream")
    for path in ("/js/bootstrap.js", "/js/main.js", "/js/state.js", "/vendor/leaflet/leaflet.js"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/javascript")
    assert client.get("/css/map.css").headers["content-type"].startswith("text/css")


def test_sound_power_ceiling(client: TestClient) -> None:
    """Accept 300 dB sound power, reject larger values and preserve receiver arithmetic.

    Args:
        client: In-process application client.
    """
    payload: dict[str, object] = {
        "types": [{"id": "t", "name": "Numerical limit test", "lwa": 300}],
        "sources": [{"id": "s", "type_id": "t", "lat": 0, "lng": 0}],
        "receivers": [{"id": "r", "lat": 0, "lng": 0.001}],
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    prediction = Prediction.model_validate_json(response.text)
    assert prediction.receivers["r"].level_db == pytest.approx(248.086, abs=0.01)
    payload["types"] = [{"id": "t", "name": "Above limit", "lwa": 300.1}]
    assert client.post("/api/predict", json=payload).status_code == 422


def test_equipment_estimate_notes_are_explicit(client: TestClient) -> None:
    """Expose provisional origins without falsely attributing guesses to company data.

    Args:
        client: In-process application client.
    """
    response = client.get("/machine-estimates")
    assert response.status_code == 200
    assert "rough sound-power estimates" in response.text
    assert "not verified manufacturer or site measurements" in response.text
    assert "different quantity" in response.text
    assert "Charles Hull" in response.text


def test_about_explains_reference_levels_and_scope(client: TestClient) -> None:
    """Expose useful plain-language physics and negative-decibel explanations.

    Args:
        client: In-process application client.
    """
    response = client.get("/about")
    assert response.status_code == 200
    assert "Decibels can be negative" in response.text
    assert "0.1 dB" in response.text
    assert "Negligible overall increase" in response.text
    assert "no fixed receiver-distance cutoff" in response.text
    assert "not evidence" in response.text
    assert "choose Restore" in response.text
    assert "does not update named saves automatically" in response.text


def test_scenario_screen_keeps_only_useful_navigation(client: TestClient) -> None:
    """Keep map actions while removing the decorative header and verbose guide footer.

    Args:
        client: Local application client.
    """
    response = client.get("/")
    assert "<header" not in response.text
    assert "Light-hearted, approximate pressure-level comparisons" not in response.text
    assert 'id="home"' in response.text
    assert 'href="/about"' in response.text
    assert 'id="save-scenario"' in response.text


def test_receiver_baseline_uses_current_points_before_background_screening(client: TestClient) -> None:
    """Compare both source layouts at each live point, including below the display threshold."""
    machine = {"id": "truck", "name": "Truck", "lwa": 110}
    source = {"id": "plant", "type_id": "truck", "lat": 0, "lng": 0}
    payload = {
        "baseline": {"types": [machine], "sources": [source]},
        "current": {
            "types": [machine],
            "sources": [source, {**source, "id": "extra"}],
            "receivers": [{"id": "town", "lat": 0, "lng": 0.01}, {"id": "close", "lat": 0, "lng": 0}],
            "background_db": 100,
        },
    }
    response = client.post("/api/receivers/baseline", json=payload)
    assert response.status_code == 200
    results = response.json()
    assert set(results) == {"town", "close"}
    assert results["town"]["change_db"] == pytest.approx(3.0103)
    assert results["town"]["current_db"] - results["town"]["baseline_db"] == pytest.approx(3.0103)
    assert results["close"]["near_field"]


def test_receiver_baseline_keeps_missing_source_levels_distinct_from_zero(client: TestClient) -> None:
    """An empty source configuration has no finite level or change."""
    response = client.post(
        "/api/receivers/baseline",
        json={
            "baseline": {},
            "current": {
                "types": [{"id": "p", "name": "Plant", "lwa": 100}],
                "sources": [{"id": "s", "type_id": "p", "lat": 0, "lng": 0}],
                "receivers": [{"id": "town", "lat": 0, "lng": 0.01}],
            },
        },
    )
    assert response.status_code == 200
    result = response.json()["town"]
    assert result["baseline_db"] is None
    assert result["current_db"] is not None
    assert result["change_db"] is None
