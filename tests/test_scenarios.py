"""Local scenario persistence: round trips, invalid data and atomic-write failures."""

import json
from pathlib import Path
from typing import cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def saved_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Use isolated user files without writing private data into the checkout.

    Args:
        tmp_path: Temporary data directory.
        monkeypatch: Restores the storage-directory environment override.

    Returns:
        Test client sharing the isolated storage directory.
    """
    monkeypatch.setenv("SOUND_MODEL_DATA_DIR", str(tmp_path))
    return TestClient(app)


def payload() -> dict[str, object]:
    """Provide a complete scenario with evidence notes and presentation settings.

    Returns:
        JSON-ready save request with stable source/receiver references.
    """
    return {
        "name": "Greenbushes test <notes>",
        "document": {
            "version": 1,
            "types": [
                {
                    "id": "t",
                    "name": "Loader",
                    "lwa": 113,
                    "provenance": "example",
                    "note": "Project guess, replace with measured source evidence",
                    "kind": "loader",
                    "use": "Stockpile",
                }
            ],
            "sources": [{"id": "s", "type_id": "t", "lat": -33.86, "lng": 116.05}],
            "receivers": [{"id": "r", "lat": -33.85, "lng": 116.05}],
            "levels": [100, 80, 60, 40, 30],
            "cloud_cover": 35,
            "view": {"lat": -33.86, "lng": 116.05, "zoom": 13},
            "high_contrast": True,
            "show_contours": False,
        },
    }


def test_save_open_update_and_list(saved_client: TestClient) -> None:
    """Restore every input and note without persisting only an acoustic snapshot.

    Args:
        saved_client: API client with isolated local files.
    """
    original = payload()
    response = saved_client.post("/api/scenarios", json=original)
    assert response.status_code == 201
    record = response.json()
    identifier = record["id"]
    assert record["document"] == original["document"]
    assert saved_client.get(f"/api/scenarios/{identifier}").json() == record
    listing = saved_client.get("/api/scenarios").json()
    assert listing["unreadable_count"] == 0
    assert listing["scenarios"][0]["name"] == original["name"]
    updated = {**original, "name": "Revised scenario"}
    assert saved_client.put(f"/api/scenarios/{identifier}", json=updated).status_code == 200
    assert saved_client.get(f"/api/scenarios/{identifier}").json()["name"] == "Revised scenario"
    assert len(saved_client.get("/api/scenarios").json()["scenarios"]) == 1


def test_invalid_document_never_replaces_previous_save(saved_client: TestClient) -> None:
    """Reject broken references/schema versions and preserve previously saved work.

    Args:
        saved_client: API client with isolated local files.
    """
    record = saved_client.post("/api/scenarios", json=payload()).json()
    for changes in (
        {"version": 2},
        {"levels": [40, 40]},
        {"sources": [{"id": "s", "type_id": "missing", "lat": 0, "lng": 0}]},
    ):
        invalid = {"name": "Invalid", "document": {**record["document"], **changes}}
        assert saved_client.put(f"/api/scenarios/{record['id']}", json=invalid).status_code == 422
    assert saved_client.get(f"/api/scenarios/{record['id']}").json() == record


def test_write_failure_is_atomic(saved_client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """A failed final replacement leaves the old save intact and cleans temporary files.

    Args:
        saved_client: Isolated API client.
        monkeypatch: Restores the simulated filesystem failure.
        tmp_path: Isolated data directory.
    """
    record = saved_client.post("/api/scenarios", json=payload()).json()

    def denied(source: str, destination: Path) -> None:
        """Simulate a denied atomic replacement.

        Args:
            source: Temporary source file.
            destination: Saved record destination.

        Raises:
            PermissionError: Always, to test failure handling.
        """
        raise PermissionError("test denied")

    monkeypatch.setattr("src.scenario_files.os.replace", denied)
    response = saved_client.put(f"/api/scenarios/{record['id']}", json={**payload(), "name": "Changed"})
    assert response.status_code == 500
    assert saved_client.get(f"/api/scenarios/{record['id']}").json() == record
    assert not list(tmp_path.glob("*.tmp"))


def test_corrupt_files_do_not_block_other_saves(saved_client: TestClient, tmp_path: Path) -> None:
    """List good files and visibly count damaged/unsupported files without deleting them.

    Args:
        saved_client: Isolated API client.
        tmp_path: Isolated data directory.
    """
    record = saved_client.post("/api/scenarios", json=payload()).json()
    broken = tmp_path / f"{uuid4()}.json"
    broken.write_text("not json", encoding="utf-8")
    listing = saved_client.get("/api/scenarios").json()
    assert listing["unreadable_count"] == 1
    assert len(listing["scenarios"]) == 1
    assert listing["scenarios"][0]["id"] == record["id"]
    assert broken.exists()


def test_names_are_not_paths_and_ids_are_validated(saved_client: TestClient, tmp_path: Path) -> None:
    """Keep labels separate from filenames and reject arbitrary path identifiers.

    Args:
        saved_client: Isolated API client.
        tmp_path: Isolated data directory.
    """
    response = saved_client.post("/api/scenarios", json={**payload(), "name": "../../outside"})
    assert response.status_code == 201
    assert len(list(tmp_path.glob("*.json"))) == 1
    assert saved_client.get("/api/scenarios/not-a-uuid").status_code == 422
    assert saved_client.get(f"/api/scenarios/{uuid4()}").status_code == 404
    file = next(tmp_path.glob("*.json"))
    assert json.loads(file.read_text())["name"] == "../../outside"


def test_recovery_validation_does_not_write_files(saved_client: TestClient, tmp_path: Path) -> None:
    """Validate a draft without creating or altering a named scenario.

    Args:
        saved_client: Isolated local scenario client.
        tmp_path: Isolated save folder.
    """
    record = saved_client.post("/api/scenarios", json=payload()).json()
    before = {p.name: p.read_bytes() for p in tmp_path.iterdir()}
    response = saved_client.post("/api/scenarios/validate", json=record["document"])
    assert response.status_code == 200
    assert response.json() == record["document"]
    assert {p.name: p.read_bytes() for p in tmp_path.iterdir()} == before


@pytest.mark.parametrize(
    "change",
    [{"version": 2}, {"levels": [40, 40]}, {"sources": [{"id": "s", "type_id": "missing", "lat": 0, "lng": 0}]}],
)
def test_invalid_recovery_is_rejected_without_writes(
    saved_client: TestClient, tmp_path: Path, change: dict[str, object]
) -> None:
    """Do not apply a corrupted draft or silently repair its references.

    Args:
        saved_client: Isolated local scenario client.
        tmp_path: Isolated save folder.
        change: Invalid document fragment.
    """
    document = cast(dict[str, object], payload()["document"])
    response = saved_client.post("/api/scenarios/validate", json={**document, **change})
    assert response.status_code == 422
    assert not list(tmp_path.iterdir())
