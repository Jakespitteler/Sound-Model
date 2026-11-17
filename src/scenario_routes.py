"""Small local save/open API; no database or new dependency."""

from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from .scenario_files import SavedRecord, SaveRequest, ScenarioDocument, data_directory, read_scenario, save_scenario

router = APIRouter(prefix="/api/scenarios")


@router.post("/validate", response_model=ScenarioDocument)
def validate_recovery(document: ScenarioDocument) -> ScenarioDocument:
    """Validate browser recovery data without reading or writing named files.

    Args:
        document: Untrusted draft checked against the complete saved-input schema.

    Returns:
        Validated, normalised scenario inputs ready for explicit restoration.
    """
    return document


@router.get("")
def list_scenarios() -> dict[str, object]:
    """List readable documents and explicitly count corrupt files.

    Returns:
        Saved names/IDs/timestamps and unreadable-file count.
    """
    records: list[SavedRecord] = []
    unreadable = 0
    try:
        for path in data_directory().glob("*.json"):
            try:
                records.append(read_scenario(UUID(path.stem)))
            except (OSError, ValueError):
                unreadable += 1
    except OSError as error:
        raise HTTPException(500, "Could not list scenario files. Check the local data folder permissions.") from error
    records.sort(key=lambda r: r.updated_at, reverse=True)
    return {
        "scenarios": [{"id": str(r.id), "name": r.name, "updated_at": r.updated_at.isoformat()} for r in records],
        "unreadable_count": unreadable,
    }


@router.post("", response_model=SavedRecord, status_code=201)
def create_scenario(request: SaveRequest) -> SavedRecord:
    """Save a new named scenario.

    Args:
        request: Validated complete scenario.

    Returns:
        Newly created saved record.
    """
    try:
        return save_scenario(request)
    except OSError as error:
        raise HTTPException(
            500, "Could not save scenario. Check free space and local data folder permissions."
        ) from error


@router.get("/{identifier}", response_model=SavedRecord)
def get_scenario(identifier: UUID) -> SavedRecord:
    """Read a saved scenario.

    Args:
        identifier: Scenario UUID.

    Returns:
        Valid saved record, never an unvalidated browser payload.
    """
    try:
        return read_scenario(identifier)
    except FileNotFoundError as error:
        raise HTTPException(404, "Saved scenario not found.") from error
    except (OSError, ValidationError, ValueError) as error:
        raise HTTPException(
            500, "Saved scenario could not be read or has an unsupported format. The file was preserved."
        ) from error


@router.put("/{identifier}", response_model=SavedRecord)
def update_scenario(identifier: UUID, request: SaveRequest) -> SavedRecord:
    """Explicitly update the selected saved scenario.

    Args:
        identifier: Existing scenario UUID.
        request: Validated replacement document.

    Returns:
        Saved record after atomic replacement.
    """
    get_scenario(identifier)
    try:
        return save_scenario(request, identifier)
    except OSError as error:
        raise HTTPException(500, "Could not update scenario; the previous save was preserved.") from error
