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
        ("/css/contours.css", b".contour-card"),
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
