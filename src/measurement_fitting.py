"""Explicit measurement-derived point-source fits, separate from ordinary prediction."""

import math
from typing import Literal, Self

from pydantic import Field, model_validator

from .acoustics import distance_metres, source_level
from .measurements import Measurement, MeasurementRequest
from .types import Position, Source, StrictModel


class FitRequest(MeasurementRequest):
    """Selected training/check observations and a fixed source position.

    Attributes:
        mode: Isolated machine calibration or combined operating-area estimate.
        source_id: Live machine for calibration; not used in area mode.
        centre: User-marked equivalent centre for area mode.
        radius_m: Circular operating footprint, not an attenuation correction.
        background_confirmed: User confirms background represents the same test basis.
        activity: Common operating condition explicitly selected by the user.
        fit_ids: Observations used to estimate emission.
        check_ids: Separate observations used only to check predictions.
    """

    mode: Literal["machine", "area"]
    source_id: str | None = Field(default=None, max_length=80)
    centre: Position | None = None
    radius_m: float | None = Field(default=None, ge=1, strict=True)
    background_confirmed: bool = Field(default=False, strict=True)
    activity: str = Field(min_length=1, max_length=200)
    fit_ids: list[str] = Field(min_length=2, max_length=100)
    check_ids: list[str] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def selections(self) -> Self:
        """Reject ambiguous roles or missing source geometry.

        Returns:
            Validated disjoint selections and mode-specific geometry.
        """
        selected = self.fit_ids + self.check_ids
        if len(set(selected)) != len(selected):
            raise ValueError("Fit and check selections must be unique and separate.")
        if not set(selected) <= {m.id for m in self.measurements}:
            raise ValueError("A selected measurement is missing.")
        if self.mode == "machine" and not any(s.id == self.source_id for s in self.sources):
            raise ValueError("Select a current machine to calibrate.")
        if self.mode == "area" and (self.centre is None or self.radius_m is None):
            raise ValueError("Mark an area centre and enter its radius.")
        return self


class FitRow(StrictModel):
    """One retained measurement's eligibility and independent check result.

    Attributes:
        id: Observation ID.
        role: Fit or held-back check.
        reason: Rejection or background-correction caution.
        distance_m: Great-circle distance from the fixed equivalent source.
        corrected_db: Background-separated pressure, when separable.
        predicted_db: Fitted source pressure; excludes background.
        difference_db: Corrected observation minus prediction; not accuracy certification.
        eligible: Whether the reading meets this fit's requirements.
    """

    id: str
    role: Literal["fit", "check"]
    reason: str = ""
    distance_m: float | None = None
    corrected_db: float | None = None
    predicted_db: float | None = None
    difference_db: float | None = None
    eligible: bool = False


class FitResult(StrictModel):
    """Preview requiring a deliberate apply action, never an automatic mutation.

    Attributes:
        ready: All selected observations meet the fitting requirements.
        reason: Summary or limitation.
        lwa: Equivalent full-space model sound power, not a measured power certification.
        spread_db: Range of individual training-derived powers, not uncertainty bounds.
        centre: Fixed modeled location.
        rows: Fit and independent check observations, including rejected readings.
    """

    ready: bool = False
    reason: str
    lwa: float | None = None
    spread_db: float | None = None
    centre: Position
    rows: list[FitRow]


class FitEvidence(StrictModel):
    """Immutable-at-apply evidence snapshot retained with the derived catalogue entry.

    Attributes:
        request: Complete fitting inputs, preserving original observations and roles.
        result: Reviewed numerical preview.
        model: Propagation and fitting method identifier.
        covered_source_ids: Map sources replaced when applying an area estimate.
    """

    request: FitRequest
    result: FitResult
    covered_source_ids: list[str] | None = Field(default=None, max_length=100)
    model: Literal["full-space-log-fit-v1"] = "full-space-log-fit-v1"

    @model_validator(mode="after")
    def check_covered_sources(self) -> Self:
        """Check recorded coverage against the sources present during this area fit.

        Returns:
            Evidence with an unambiguous set of covered source IDs.
        """
        if self.covered_source_ids is None:
            return self
        covered = set(self.covered_source_ids)
        if (
            self.request.mode != "area"
            or len(covered) != len(self.covered_source_ids)
            or not covered.issubset(source.id for source in self.request.sources)
        ):
            raise ValueError("Area coverage must identify distinct sources in the fitting snapshot.")
        return self


def separated_pressure(total_db: float, background_db: float) -> float | None:
    """Subtract independent background energy only at a separation of at least 3 dB.

    Args:
        total_db: A-weighted measured energy-average total pressure.
        background_db: Representative compatible background pressure.

    Returns:
        Corrected pressure or None when the background contribution cannot be separated.
    """
    gap = total_db - background_db
    if gap < 3:
        return None
    return total_db + 10 * math.log10(-math.expm1(-gap * math.log(10) / 10))


def observation_row(item: Measurement, request: FitRequest, origin: Source, role: Literal["fit", "check"]) -> FitRow:
    """Check context without inferring isolation or replacing unknown test information.

    Args:
        item: Original observed total-pressure record.
        request: Selected operating condition and source context.
        origin: Fixed source centre; its current power is not used.
        role: Training or held-back checking role.

    Returns:
        Explicit rejected state or background-corrected eligible pressure.
    """
    distance = distance_metres(origin, item)
    row = FitRow(id=item.id, role=role, distance_m=distance)
    if item.metric != "LAeq" or item.test_kind != "stationary" or item.duration_s is None:
        row.reason = "Needs a stationary LAeq average with known duration."
    elif item.activity != request.activity:
        row.reason = "Operating activity differs from the selected condition."
    elif request.mode == "machine" and item.isolation != "isolated":
        row.reason = "Machine is not confirmed isolated. Use mixed/unknown readings for an area estimate."
    elif request.mode == "machine" and (
        item.source_id != origin.id
        or item.source_context is None
        or item.source_context.type_id != origin.type_id
        or item.source_context.lat != origin.lat
        or item.source_context.lng != origin.lng
        or item.source_context.operating_mode != request.source_modes.get(origin.id, "")
    ):
        row.reason = "Recorded machine position or operating setup does not match the selected machine."
    elif distance < 1:
        row.reason = "Within 1 m of the source: unsuitable for this spreading fit."
    elif request.mode == "area" and distance <= (request.radius_m or 0):
        row.reason = "Inside the operating area. Retained as context; use outside readings for this fit."
    elif not request.background_confirmed:
        row.reason = "Confirm that the background represents these tests on the same averaging basis."
    elif request.background_db is None:
        row.reason = "Enter a representative background level before fitting."
    else:
        row.corrected_db = separated_pressure(item.level_db, request.background_db)
        if row.corrected_db is None:
            row.reason = "Less than 3 dB above background: too uncertain to fit."
        else:
            row.eligible = True
            row.reason = (
                "3–10 dB above background: correction is sensitive to background uncertainty."
                if item.level_db - request.background_db <= 10
                else "Background energy corrected."
            )
    return row


def fit_measurements(request: FitRequest) -> FitResult:
    """Estimate one fixed source's power by least squares in pressure decibels.

    Args:
        request: Explicitly selected training/check data and representative background.

    Returns:
        Preview only. Check points never contribute to the fitted power; no inputs mutate.
    """
    if request.mode == "machine":
        origin = next(s for s in request.sources if s.id == request.source_id)
    else:
        assert request.centre is not None
        origin = Source(id="area", type_id="area", **request.centre.model_dump())
    by_id = {m.id: m for m in request.measurements}
    rows = [observation_row(by_id[i], request, origin, "fit") for i in request.fit_ids]
    rows += [observation_row(by_id[i], request, origin, "check") for i in request.check_ids]
    result = FitResult(
        reason="Review the selected readings; excluded observations are not silently dropped.",
        centre=Position(lat=origin.lat, lng=origin.lng),
        rows=rows,
    )
    if not all(row.eligible for row in rows):
        return result
    # Separate roles must also refer to distinct physical locations, not copied readings.
    selected = [by_id[i] for i in request.fit_ids + request.check_ids]
    for index, item in enumerate(selected):
        location = Source(id="location", type_id="location", lat=item.lat, lng=item.lng)
        if any(distance_metres(location, other) < 1 for other in selected[index + 1 :]):
            result.reason = "Use distinct measurement locations (at least 1 m apart) for fit and check readings."
            return result
    powers: list[float] = []
    for row in rows:
        assert row.corrected_db is not None and row.distance_m is not None
        if row.role == "fit":
            powers.append(row.corrected_db - source_level(0, row.distance_m))
    power = math.fsum(p / len(powers) for p in powers)
    if not math.isfinite(power) or not 0 <= power <= 300:
        result.reason = "Fitted emission is outside the supported 0–300 dB sound-power input range."
        return result
    spread = max(powers) - min(powers)
    if not math.isfinite(spread):
        result.reason = "Selected readings exceed the numerical dynamic range for this fit."
        return result
    result.ready = True
    result.lwa = power
    result.spread_db = spread
    result.reason = (
        "Equivalent point-source estimate. Check readings do not influence the fit; "
        "review their differences before applying."
    )
    for row in rows:
        assert row.distance_m is not None and row.corrected_db is not None
        row.predicted_db = source_level(power, row.distance_m)
        row.difference_db = row.corrected_db - row.predicted_db
    return result
