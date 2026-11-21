"""Named local scenario files with validated schemas and atomic replacement."""

import json
import os
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from pydantic import AwareDatetime, Field, model_validator

from .measurement_fitting import FitEvidence
from .measurements import Measurement
from .types import ContourRequest, MachineType, Receiver, Source, Spectrum, StrictModel


class SavedMachine(MachineType):
    """Machine data and its human-readable evidence/assumption metadata.

    Attributes:
        fitting: Optional reviewed measurement-derived estimate and complete input snapshot.
        note: User's source or estimate note, retained across save/open.
        use: Optional description of the machine's operation.
        kind: Built-in illustration category, or generic for custom equipment.
        source_reference: Optional plain-text equipment evidence reference.
        operating_mode: Optional operating condition associated with the input level.
    """

    fitting: FitEvidence | None = None
    source_reference: str = Field(default="", max_length=500)
    operating_mode: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=2000)
    use: str = Field(default="", max_length=200)
    kind: str = Field(default="generic", max_length=40)

    @property
    def acoustic_input(self) -> MachineType:
        """Return the standard acoustic machine wrapped by this saved entry.

        Returns:
            Machine inputs used by contours and receiver predictions.
        """
        return MachineType.model_validate(self.model_dump(include=set(MachineType.model_fields)))


class MapView(StrictModel):
    """Saved geographic camera, independent from acoustic calculations.

    Attributes:
        lat: Centre latitude.
        lng: Centre longitude, normalised to ±180°.
        zoom: Leaflet zoom supported by the map.
    """

    lat: float = Field(ge=-85, le=85)
    lng: float = Field(ge=-180, le=180)
    zoom: float = Field(ge=3, le=19)


class ScenarioDocument(StrictModel):
    """Versioned browser scenario with notes and presentation state.

    Attributes:
        measurements: Optional field observations, independent of simulated source links.
        version: Persisted schema version; unknown versions are rejected.
        types: Equipment catalogue including source notes.
        sources: Placed machines.
        receivers: Listening locations.
        levels: Unique contour thresholds.
        cloud_cover: Recorded cloud percentage.
        background_spectrum: Optional unweighted background evidence.
        background_db: Optional uniform background pressure in dB(A).
        acceptable_level_db: Optional user-set reference threshold; no regulatory default.
        view: Optional map camera.
        high_contrast: White contour halos enabled.
        show_contours: Global contour visibility.
    """

    measurements: list[Measurement] = Field(default_factory=list[Measurement], max_length=100)
    version: Literal[1] = 1
    types: list[SavedMachine] = Field(max_length=50)
    sources: list[Source] = Field(max_length=100)
    receivers: list[Receiver] = Field(max_length=20)
    levels: list[float] = Field(max_length=25)
    cloud_cover: int = Field(ge=0, le=100, strict=True)
    background_spectrum: Spectrum | None = None
    background_db: float | None = Field(default=None, strict=True)
    acceptable_level_db: float | None = Field(default=None, strict=True)
    view: MapView | None = None
    high_contrast: bool = False
    show_contours: bool = True

    @model_validator(mode="after")
    def acoustic_inputs(self) -> "ScenarioDocument":
        """Reuse acoustic validators for saved references, uniqueness and ranges.

        Returns:
            Valid document with no silent repair or discarded source metadata.
        """
        if len({m.id for m in self.measurements}) != len(self.measurements):
            raise ValueError("Measurement IDs must be unique.")
        unique_levels = set(self.levels)
        if self.acceptable_level_db is not None:
            unique_levels.add(self.acceptable_level_db)
        if len(unique_levels) > 25:
            raise ValueError("At most 25 unique levels including the acceptable level are supported.")
        ContourRequest(
            types=[entry.acoustic_input for entry in self.types],
            sources=self.sources,
            receivers=self.receivers,
            levels=self.levels,
            cloud_cover=self.cloud_cover,
            background_db=self.background_db,
            background_spectrum=self.background_spectrum,
        )
        return self


class SaveRequest(StrictModel):
    """A user-named document for creation or explicit update.

    Attributes:
        name: Display label; never used as a file path.
        document: Versioned scenario content.
    """

    name: str = Field(min_length=1, max_length=100)
    document: ScenarioDocument


class SavedRecord(SaveRequest):
    """Persisted scenario envelope.

    Attributes:
        id: Server-generated UUID used as the safe filename.
        updated_at: Last successful save in UTC.
    """

    id: UUID
    updated_at: AwareDatetime


def data_directory() -> Path:
    """Resolve the local data directory; no credentials or shared service is required.

    Returns:
        Configured folder or the repository's ignored local-data/scenarios directory.
    """
    return Path(
        os.environ.get("SOUND_MODEL_DATA_DIR", Path(__file__).resolve().parents[1] / "local-data" / "scenarios")
    )


def read_scenario(identifier: UUID) -> SavedRecord:
    """Load and validate a saved record without interpreting names as file paths.

    Args:
        identifier: Validated scenario UUID.

    Returns:
        Validated saved document.
    """
    record = SavedRecord.model_validate_json((data_directory() / f"{identifier}.json").read_text(encoding="utf-8"))
    if record.id != identifier:
        raise ValueError("Scenario identifier does not match its file")
    return record


def save_scenario(request: SaveRequest, identifier: UUID | None = None) -> SavedRecord:
    """Atomically create or replace a scenario, preserving the old file on write failure.

    Args:
        request: Validated name and document.
        identifier: Existing UUID to update, or None to create a new file.

    Returns:
        The saved record after atomic filesystem replacement.
    """
    directory = data_directory()
    directory.mkdir(parents=True, exist_ok=True)
    record = SavedRecord(**request.model_dump(), id=identifier or uuid4(), updated_at=datetime.now(UTC))
    temporary: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=directory, suffix=".tmp", delete=False
        ) as stream:
            temporary = stream.name
            json.dump(record.model_dump(mode="json"), stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, directory / f"{record.id}.json")
        temporary = None
    finally:
        if temporary is not None:
            Path(temporary).unlink(missing_ok=True)
    return record
