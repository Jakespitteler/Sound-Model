"""Pydantic request, domain, and response schemas for the Sound-Model API."""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    """Base schema enforcing strict input validation for API request payloads.

    Forbids unknown fields, rejects non-finite floating-point literals
    (``NaN``, ``Infinity``), and strips leading and trailing whitespace from
    string fields.

    Attributes:
        model_config: Pydantic configuration shared across all strict input models.
    """

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class Position(StrictModel):
    """Geographic coordinates constrained to valid Web Mercator bounds.

    Attributes:
        lat: WGS84 latitude in decimal degrees within ``[-85, 85]``.
        lng: WGS84 longitude in decimal degrees within ``[-180, 180]``.
    """

    lat: float = Field(ge=-85, le=85)
    lng: float = Field(ge=-180, le=180)


class MachineType(StrictModel):
    """Catalogue definition for a class of noise-emitting equipment.

    Attributes:
        id: Unique client-supplied identifier for the machine type.
        name: Human-readable equipment label displayed in the UI and outputs.
        lwa: A-weighted sound power level ($L_{wA}$) in dB(A) within ``[0, 180]``.
        provenance: Indicates whether ``lwa`` is an illustrative example or measured data.
    """

    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    lwa: float = Field(ge=0, le=180)
    provenance: Literal["example", "measured"] = "example"


class Source(Position):
    """Acoustic point source placed at a geographic coordinate on the map.

    Attributes:
        id: Unique client-supplied identifier for this source instance.
        type_id: Identifier referencing a :class:`MachineType` in the scenario catalogue.
        lat: WGS84 latitude in decimal degrees within ``[-85, 85]``.
        lng: WGS84 longitude in decimal degrees within ``[-180, 180]``.
    """

    id: str = Field(min_length=1, max_length=80)
    type_id: str = Field(min_length=1, max_length=80)


class Receiver(Position):
    """Discrete listening location where predicted noise levels are evaluated.

    Attributes:
        id: Unique client-supplied identifier for this receiver location.
        lat: WGS84 latitude in decimal degrees within ``[-85, 85]``.
        lng: WGS84 longitude in decimal degrees within ``[-180, 180]``.
    """

    id: str = Field(min_length=1, max_length=80)


class Bounds(StrictModel):
    """Axis-aligned geographic bounding box for heatmap grid evaluation.

    Attributes:
        south: Southern latitude boundary in decimal degrees within ``[-85, 85]``.
        north: Northern latitude boundary in decimal degrees within ``[-85, 85]``.
        west: Western longitude boundary in decimal degrees within ``[-180, 180]``.
        east: Eastern longitude boundary in decimal degrees within ``[-180, 180]``.
    """

    south: float = Field(ge=-85, le=85)
    north: float = Field(ge=-85, le=85)
    west: float = Field(ge=-180, le=180)
    east: float = Field(ge=-180, le=180)

    @model_validator(mode="after")
    def ordered(self) -> Self:
        """Validate that the bounding box has strictly positive width and height.

        Returns:
            The validated :class:`Bounds` instance.

        Raises:
            ValueError: If ``south >= north`` or ``west >= east``.
        """
        if self.south >= self.north or self.west >= self.east:
            raise ValueError("Map bounds must have positive width and height")
        return self


class Scenario(StrictModel):
    """Complete acoustic prediction request payload.

    Attributes:
        types: Catalogue of available machine types (up to 50 entries).
        sources: Active noise sources placed on the map (up to 100 entries).
        receivers: Discrete receiver points to evaluate (up to 20 entries).
        cloud_cover: Recorded sky cloud cover percentage within ``[0, 100]``.
        bounds: Optional map viewport bounding box for 48x48 grid evaluation.
    """

    types: list[MachineType] = Field(default_factory=list[MachineType], max_length=50)
    sources: list[Source] = Field(default_factory=list[Source], max_length=100)
    receivers: list[Receiver] = Field(default_factory=list[Receiver], max_length=20)
    cloud_cover: int = Field(default=0, ge=0, le=100, strict=True)
    bounds: Bounds | None = None

    @model_validator(mode="after")
    def references(self) -> Self:
        """Validate ID uniqueness within collections and source-to-type references.

        Returns:
            The validated :class:`Scenario` instance.

        Raises:
            ValueError: If any collection has duplicate IDs or a source references an
                undefined machine type ID.
        """
        for collection in (self.types, self.sources, self.receivers):
            ids = [item.id for item in collection]
            if len(ids) != len(set(ids)):
                raise ValueError("IDs must be unique within each collection")
        type_ids = {item.id for item in self.types}
        if any(source.type_id not in type_ids for source in self.sources):
            raise ValueError("Every source must reference an existing machine type")
        return self


class Contribution(BaseModel):
    """Predicted acoustic contribution from a single source at a receiver.

    Attributes:
        id: Identifier of the contributing :class:`Source`.
        name: Display name of the source's :class:`MachineType`.
        distance_m: Geodesic surface distance between source and receiver in metres.
        level_db: Predicted sound pressure level from this source in dB(A).
        near_field: Whether the source is closer than 1 m to the receiver.
        provenance: Data source classification inherited from the machine type.
    """

    id: str
    name: str
    distance_m: float
    level_db: float
    near_field: bool
    provenance: Literal["example", "measured"]


class Point(BaseModel):
    """Aggregated acoustic prediction result at a single receiver location.

    Attributes:
        level_db: Energetic sum of all source levels in dB(A), or ``None`` if no sources exist.
        near_field: ``True`` if at least one contributing source is within 1 m.
        contributions: Per-source breakdown ordered identically to ``Scenario.sources``.
    """

    level_db: float | None
    near_field: bool
    contributions: list[Contribution]


class Grid(BaseModel):
    """Row-major 48x48 spatial grid of predicted sound pressure levels.

    Attributes:
        rows: Fixed vertical cell count (``48``).
        columns: Fixed horizontal cell count (``48``).
        bounds: Geographic extent dictionary with ``south``, ``north``, ``west``, and ``east``.
        values: Flattened row-major list of 2,304 cell-centre levels in dB(A).
    """

    rows: Literal[48]
    columns: Literal[48]
    bounds: dict[str, float]
    values: list[float | None]


class Prediction(BaseModel):
    """Top-level acoustic prediction response returned by ``POST /api/predict``.

    Attributes:
        receivers: Mapping of receiver IDs to their evaluated :class:`Point` results.
        grid: Optional 48x48 :class:`Grid` overlay when bounds and sources are provided.
        cloud_cover: Echoed scenario cloud cover percentage.
        cloud_correction_db: Always ``None`` in v1 because no meteorological offset is applied.
        example_data: ``True`` if any active source uses a machine type marked ``"example"``.
        model: Identifier string of the acoustic propagation model version.
    """

    receivers: dict[str, Point]
    grid: Grid | None
    cloud_cover: int
    cloud_correction_db: None
    example_data: bool
    model: str
