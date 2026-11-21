"""Pydantic request, domain, and response schemas for the Sound-Model API."""

from typing import Annotated, Literal, Self

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


class Spectrum(StrictModel):
    """Optional unweighted octave evidence on a fixed 31.5 Hz–8 kHz grid.

    Attributes:
        levels: Nine finite band levels, with None for unknown measurements.
        period_s: Leq averaging duration in seconds; None means unknown basis.
        weighting: Z/unweighted only; A-weighted band inputs are not interchangeable.
        metric: Energy-average levels only; maxima are not silently averaged.
        provenance: Whether the spectral evidence is assumed or measured.
        reference: Plain-text source and operating-condition reference.
    """

    levels: list[Annotated[float, Field(strict=True)] | None] = Field(min_length=9, max_length=9)
    period_s: float | None = Field(default=None, gt=0, strict=True)
    weighting: Literal["Z"] = "Z"
    metric: Literal["Leq"] = "Leq"
    provenance: Literal["example", "measured"] = "example"
    reference: str = Field(default="", max_length=500)


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
        lwa: A-weighted sound power level ($L_{wA}$) in dB(A) within ``[0, 300]``.
        provenance: Indicates whether ``lwa`` is an illustrative example or measured data.
        spectrum: Optional unweighted sound-power bands, separate from LwA.
    """

    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    lwa: float = Field(ge=0, le=300)
    provenance: Literal["example", "measured"] = "example"
    spectrum: Spectrum | None = None


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
        name: Optional display label, empty for legacy records; never an acoustic input.
        lat: WGS84 latitude in decimal degrees within ``[-85, 85]``.
        lng: WGS84 longitude in decimal degrees within ``[-180, 180]``.
    """

    id: str = Field(min_length=1, max_length=80)
    name: str = Field(default="", max_length=80)


class Scenario(StrictModel):
    """Complete acoustic prediction request payload.

    Attributes:
        types: Catalogue of available machine types (up to 50 entries).
        sources: Active noise sources placed on the map (up to 100 entries).
        receivers: Discrete receiver points to evaluate (up to 20 entries).
        background_spectrum: Optional unweighted background pressure bands.
        background_db: Optional uniform background pressure in dB(A); never guessed.
        cloud_cover: Recorded sky cloud cover percentage within ``[0, 100]``.
    """

    types: list[MachineType] = Field(default_factory=list[MachineType], max_length=50)
    sources: list[Source] = Field(default_factory=list[Source], max_length=100)
    receivers: list[Receiver] = Field(default_factory=list[Receiver], max_length=20)
    background_spectrum: Spectrum | None = None
    background_db: float | None = Field(default=None, strict=True)
    cloud_cover: int = Field(default=0, ge=0, le=100, strict=True)

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


class ReceiverComparisonRequest(StrictModel):
    """Two source configurations compared at the current receiver locations.

    Attributes:
        baseline: Captured baseline source configuration.
        current: Current source configuration and the receiver locations for both predictions.
    """

    baseline: Scenario
    current: Scenario


class ReceiverComparison(StrictModel):
    """Machinery-only levels for the same point before and after scenario edits.

    Attributes:
        baseline_db: Baseline contribution, or None when there are no baseline sources.
        current_db: Current contribution, or None when there are no current sources.
        change_db: Current minus baseline, when both levels exist.
        near_field: One or both configurations contain a source within 1 m of the point.
    """

    baseline_db: float | None
    current_db: float | None
    change_db: float | None
    near_field: bool


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
        level_db: Energetic sum in dB(A), or ``None`` for no sources or a negligible background increase.
        near_field: ``True`` if at least one contributing source is within 1 m.
        contributions: Per-source breakdown, hidden when the total increase is negligible.
        status: Whether a reading is present, empty, or negligible against background.
        nearest_source_m: Distance to the closest source, where sources exist.
        includes_distant_sources: Legacy compatibility field; always False.
    """

    level_db: float | None
    near_field: bool
    contributions: list[Contribution]
    status: Literal["ok", "no_sources", "negligible"] = "ok"
    nearest_source_m: float | None = None
    includes_distant_sources: bool = False


class BandReading(BaseModel):
    """One unweighted frequency comparison; never an audibility classification.

    Attributes:
        frequency_hz: Fixed octave centre.
        machine_db: Complete compatible all-source band pressure, or unknown.
        background_db: Entered band background pressure, or unknown.
        difference_db: Machine minus background for compatible averaging periods.
        status: Data completeness, temporal compatibility or numeric failure.
        missing_sources: Source IDs whose band or averaging basis is unknown.
        near_field: Whether a source is inside the 1 m numerical clamp.
    """

    frequency_hz: float
    machine_db: float | None = None
    background_db: float | None = None
    difference_db: float | None = None
    status: Literal[
        "ok", "missing_source_data", "missing_background", "incompatible_basis", "no_sources", "unavailable"
    ]
    missing_sources: list[str] = Field(default_factory=list)
    near_field: bool = False


class Prediction(BaseModel):
    """Direct receiver results, independent of viewport and contour rendering.

    Attributes:
        receivers: Results keyed by receiver ID.
        band_results: Optional unweighted comparisons, independently keyed by receiver ID.
        cloud_cover: Recorded cloud percentage; no numerical correction applies.
        cloud_correction_db: Always None until a meteorological model is validated.
        example_data: Whether an active source uses example sound power data.
        model: Identifier of the unchanged full-space acoustic model.
    """

    receivers: dict[str, Point]
    band_results: dict[str, list[BandReading]] = Field(default_factory=dict)
    cloud_cover: int
    cloud_correction_db: None
    example_data: bool
    model: str


class ContourRequest(Scenario):
    """Source-based request for level lines, without camera or visual styling.

    Attributes:
        levels: Unique dB(A) thresholds, limited to 26 including the automatic boundary.
    """

    levels: list[float] = Field(max_length=26)

    @model_validator(mode="after")
    def valid_levels(self) -> Self:
        """Reject repeated or out-of-range contour thresholds.

        Returns:
            Validated contour request.

        Raises:
            ValueError: If thresholds are repeated or non-finite.
        """
        if len(set(self.levels)) != len(self.levels):
            raise ValueError("Contour levels must be unique finite values")
        return self


class Contour(BaseModel):
    """One threshold's connected contour polylines.

    Attributes:
        level_db: Combined A-weighted noise threshold.
        lines: Polylines as [longitude, latitude] pairs; longitudes may unwrap at 180°.
        status: Calculated, negligible, no crossing, or failed; failures are isolated by level.
        error: Explanation of a calculation failure, without suppressing other levels.
    """

    level_db: float
    lines: list[list[tuple[float, float]]]
    status: Literal["ok", "empty", "failed", "negligible"] = "ok"
    error: str | None = None


class ContourResponse(BaseModel):
    """Viewport-independent geometry and numerical accuracy metadata.

    Attributes:
        contours: One result per requested level, including empty levels.
        tolerance_db: Maximum target vertex error for bisection refinement.
        model: Acoustic model used to evaluate all thresholds.
    """

    contours: list[Contour]
    tolerance_db: float = 0.02
    model: str = "full-space-point-source-v1"
