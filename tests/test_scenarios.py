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
    expected = {
        "measurements": [],
        "disabled_source_ids": [],
        "background_spectrum": None,
        "background_db": None,
        "acceptable_level_db": None,
        **cast(dict[str, object], original["document"]),
        "receivers": [{"id": "r", "lat": -33.85, "lng": 116.05, "name": ""}],
    }
    original_types = cast(list[dict[str, object]], expected["types"])
    expected["types"] = [
        {**item, "source_reference": "", "operating_mode": "", "spectrum": None, "fitting": None}
        for item in original_types
    ]
    assert record["document"] == expected
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
        {"disabled_source_ids": ["unknown"]},
    ):
        invalid = {"name": "Invalid", "document": {**record["document"], **changes}}
        assert saved_client.put(f"/api/scenarios/{record['id']}", json=invalid).status_code == 422
    assert saved_client.get(f"/api/scenarios/{record['id']}").json() == record


def test_optional_disabled_source_and_background_link_round_trip(saved_client: TestClient) -> None:
    """Keep placement state and paired readings in saved documents."""
    data = payload()
    document = cast(dict[str, object], data["document"])
    document["disabled_source_ids"] = ["s"]
    document["measurements"] = [
        {"id": "operating", "lat": -33.86, "lng": 116.05, "level_db": 55, "background_id": "background"},
        {"id": "background", "lat": -33.86, "lng": 116.05, "level_db": 43},
    ]
    response = saved_client.post("/api/scenarios", json=data)
    assert response.status_code == 201
    record = response.json()
    reopened = saved_client.get(f"/api/scenarios/{record['id']}").json()["document"]
    assert reopened["disabled_source_ids"] == ["s"]
    assert reopened["sources"][0]["id"] == "s"
    assert reopened["measurements"][0]["background_id"] == "background"


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


def test_legacy_receiver_names_are_defaulted_without_rewriting_files(saved_client: TestClient, tmp_path: Path) -> None:
    """Read old version-1 files without modifying their bytes or losing existing inputs.

    Args:
        saved_client: Isolated scenario API.
        tmp_path: Temporary save directory.
    """
    identifier = str(uuid4())
    legacy = {**payload(), "id": identifier, "updated_at": "2026-11-17T00:00:00Z"}
    path = tmp_path / f"{identifier}.json"
    path.write_text(json.dumps(legacy), encoding="utf-8")
    previous = path.read_bytes()
    response = saved_client.get(f"/api/scenarios/{identifier}")
    assert response.status_code == 200
    document = response.json()["document"]
    assert document["acceptable_level_db"] is None
    assert document["version"] == 1
    assert document["receivers"] == [{"id": "r", "lat": -33.85, "lng": 116.05, "name": ""}]
    assert path.read_bytes() == previous
    assert (
        saved_client.put(
            f"/api/scenarios/{identifier}", json={"name": legacy["name"], "document": document}
        ).status_code
        == 200
    )
    saved = saved_client.get(f"/api/scenarios/{identifier}").json()["document"]
    assert saved == document
    original_types = cast(list[dict[str, object]], cast(dict[str, object], payload()["document"])["types"])
    assert saved["types"] == [
        {**item, "source_reference": "", "operating_mode": "", "spectrum": None, "fitting": None}
        for item in original_types
    ]
    assert saved["sources"] == cast(dict[str, object], payload()["document"])["sources"]


def test_named_receivers_round_trip_and_invalid_update_preserves_save(saved_client: TestClient) -> None:
    """Keep labels as metadata while IDs remain unique and bad updates are atomic.

    Args:
        saved_client: Isolated scenario API.
    """
    document = cast(dict[str, object], payload()["document"])
    document["receivers"] = [
        {"id": "r1", "lat": -33.85, "lng": 116.05, "name": "住宅 🏠"},
        {"id": "r2", "lat": -33.84, "lng": 116.05, "name": "住宅 🏠"},
    ]
    response = saved_client.post("/api/scenarios", json={"name": "Named receivers", "document": document})
    assert response.status_code == 201
    record = response.json()
    route = f"/api/scenarios/{record['id']}"
    assert saved_client.get(route).json()["document"]["receivers"] == document["receivers"]
    validated = saved_client.post("/api/scenarios/validate", json=record["document"])
    assert validated.status_code == 200
    assert validated.json()["receivers"] == document["receivers"]
    invalid = {**record["document"], "receivers": [{"id": "r1", "lat": 0, "lng": 0, "name": "x" * 81}]}
    assert saved_client.put(route, json={"name": record["name"], "document": invalid}).status_code == 422
    assert saved_client.get(route).json() == record


@pytest.mark.parametrize(("field", "limit"), [("source_reference", 500), ("operating_mode", 200)])
def test_equipment_metadata_boundaries(saved_client: TestClient, field: str, limit: int) -> None:
    """Accept bounded Unicode metadata and reject invalid updates atomically.

    Args:
        saved_client: Isolated scenario API.
        field: Optional equipment field under test.
        limit: Maximum number of Unicode characters.
    """
    record = saved_client.post("/api/scenarios", json=payload()).json()
    route = f"/api/scenarios/{record['id']}"
    document = record["document"]
    document["types"][0][field] = "機" * limit
    response = saved_client.put(route, json={"name": record["name"], "document": document})
    assert response.status_code == 200
    accepted = response.json()
    assert saved_client.get(route).json()["document"]["types"][0][field] == "機" * limit
    assert saved_client.post("/api/scenarios/validate", json=accepted["document"]).json() == accepted["document"]
    for invalid in ("x" * (limit + 1), None, 123):
        document["types"][0][field] = invalid
        assert saved_client.put(route, json={"name": record["name"], "document": document}).status_code == 422
        assert saved_client.get(route).json() == accepted


def test_equipment_metadata_is_plain_text_and_not_acoustic(saved_client: TestClient) -> None:
    """Keep references as text and preserve notes, provenance and acoustic inputs.

    Args:
        saved_client: Isolated scenario API.
    """
    record = saved_client.post("/api/scenarios", json=payload()).json()
    document = record["document"]
    baseline = json.loads(json.dumps(document))
    machine = document["types"][0]
    assert machine["source_reference"] == machine["operating_mode"] == ""
    machine["source_reference"] = '<img src="https://example.invalid/spec" onerror="alert(1)"> 設備'
    machine["operating_mode"] = "Loaded / travelling 🛻"
    response = saved_client.put(f"/api/scenarios/{record['id']}", json={"name": record["name"], "document": document})
    assert response.status_code == 200
    assert response.json()["document"] == document
    for field in ("id", "lwa", "note", "use", "kind", "provenance"):
        assert machine[field] == baseline["types"][0][field]
    acoustic: list[dict[str, object]] = []
    for scene in (baseline, document):
        acoustic.append(
            {
                "types": [{key: item[key] for key in ("id", "name", "lwa", "provenance")} for item in scene["types"]],
                **{key: scene[key] for key in ("sources", "receivers", "cloud_cover")},
            }
        )
    assert acoustic[0] == acoustic[1]
    for endpoint in ("/api/predict", "/api/contours"):
        bodies = [{**body, "levels": [60]} if endpoint.endswith("contours") else body for body in acoustic]
        assert saved_client.post(endpoint, json=bodies[0]).json() == saved_client.post(endpoint, json=bodies[1]).json()


@pytest.mark.parametrize("level", [None, -10, 0, 45.5, 300, 500])
def test_acceptable_level_round_trip(saved_client: TestClient, level: float | None) -> None:
    """Keep an optional reference through Save/Open and draft validation.

    Args:
        saved_client: Isolated scenario API.
        level: Unset or valid boundary/reference value.
    """
    original = saved_client.post("/api/scenarios", json=payload()).json()
    assert original["document"]["acceptable_level_db"] is None
    document = original["document"]
    document["acceptable_level_db"] = level
    response = saved_client.put(
        f"/api/scenarios/{original['id']}", json={"name": original["name"], "document": document}
    )
    assert response.status_code == 200
    assert response.json()["document"] == document
    assert saved_client.get(f"/api/scenarios/{original['id']}").json()["document"] == document
    assert saved_client.post("/api/scenarios/validate", json=document).json() == document


@pytest.mark.parametrize("level", [float("nan"), float("inf"), -float("inf"), "40", True])
def test_invalid_acceptable_level_preserves_save(saved_client: TestClient, level: object) -> None:
    """Reject nonnumeric/nonfinite references without changing a saved scenario.

    Args:
        saved_client: Isolated scenario API.
        level: Invalid reference to reject.
    """
    record = saved_client.post("/api/scenarios", json=payload()).json()
    document = {**record["document"], "acceptable_level_db": level}
    response = saved_client.put(
        f"/api/scenarios/{record['id']}",
        content=json.dumps({"name": record["name"], "document": document}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert saved_client.get(f"/api/scenarios/{record['id']}").json() == record


def test_acceptable_level_unique_budget(saved_client: TestClient) -> None:
    """A matching reference shares a slot; an extra unique threshold cannot displace another.

    Args:
        saved_client: Isolated scenario API.
    """
    document = cast(dict[str, object], payload()["document"])
    document["levels"] = list(range(25))
    document["acceptable_level_db"] = 10
    assert saved_client.post("/api/scenarios/validate", json=document).status_code == 200
    document["acceptable_level_db"] = 25
    assert saved_client.post("/api/scenarios/validate", json=document).status_code == 422
    document["levels"] = list(range(24))
    assert saved_client.post("/api/scenarios/validate", json=document).status_code == 200
