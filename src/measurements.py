"""Recorded field pressure observations and cautious current-scenario comparisons."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from .acoustics import at_point
from .scope import screen_receiver
from .types import MachineType, Point, Position, Receiver, Scenario, Source, StrictModel


class SourceContext(Source):
    """Recorded source setup, retained independently of later simulation edits.

    Attributes:
        operating_mode: Recorded catalogue operating-mode label, if known.
        name: Equipment label at recording time.
        lwa: Recorded model emission, never inferred from the pressure observation.
    """

    operating_mode: str = Field(default="", max_length=200)
    name: str = Field(max_length=80)
    lwa: float = Field(ge=0, le=300)


class Measurement(Position):
    """A field sound-pressure observation, not a simulated receiver or source power.

    Attributes:
        id: Stable observation identifier.
        name: Optional display label.
        level_db: Finite observed pressure level, with metric kept explicit.
        isolation: Whether other machinery was sufficiently absent for an individual fit.
        metric: Known A-weighted average/maximum, or unknown meter designation.
        test_kind: Stationary steady test, pass-by, startup/event or unknown.
        duration_s: Known observation duration, otherwise unknown.
        source_id: Optional placed-source link, allowed to outlive the source.
        background_id: Optional recorded machinery-off reading for this observation.
        source_context: Recorded source identity, emission and position.
        activity: Operating activity; blank means unknown.
        meter: Optional instrument details.
        note: Conditions, other activity and test notes.
    """

    id: str = Field(min_length=1, max_length=80)
    name: str = Field(default="", max_length=80)
    level_db: float = Field(strict=True)
    isolation: Literal["unknown", "isolated", "mixed"] = "unknown"
    metric: Literal["unknown", "LAeq", "LAmax"] = "unknown"
    test_kind: Literal["unknown", "stationary", "moving", "startup"] = "unknown"
    duration_s: float | None = Field(default=None, gt=0, strict=True)
    source_id: str | None = Field(default=None, min_length=1, max_length=80)
    source_context: SourceContext | None = None
    background_id: str | None = Field(default=None, min_length=1, max_length=80)
    activity: str = Field(default="", max_length=200)
    meter: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def context_identity(self) -> Self:
        """Reject contradictory historical links without requiring a live source.

        Returns:
            Observation whose optional snapshot identifies its linked source.
        """
        if self.background_id == self.id:
            raise ValueError("A reading cannot be its own background.")
        if self.source_context is not None and self.source_context.id != self.source_id:
            raise ValueError("Recorded source context must match the linked source ID.")
        return self


class MeasurementRequest(Scenario):
    """Bounded direct-point comparison request, independent of contour work.

    Attributes:
        source_modes: Current source operating-mode labels, separate from acoustic inputs.
        measurements: At most 100 uniquely identified observations.
    """

    source_modes: dict[
        Annotated[str, Field(min_length=1, max_length=80, strict=True)],
        Annotated[str, Field(max_length=200, strict=True)],
    ] = Field(default_factory=dict[str, str], max_length=100)
    measurements: list[Measurement] = Field(max_length=100)

    @model_validator(mode="after")
    def unique_measurements(self) -> Self:
        """Reject ambiguous observation IDs.

        Returns:
            Request with unique observation identities.
        """
        if len({item.id for item in self.measurements}) != len(self.measurements):
            raise ValueError("Measurement IDs must be unique.")
        return self


class Comparison(StrictModel):
    """Read-only comparison eligibility and current machinery-only estimate.

    Attributes:
        status: Applicability or missing/changed source context.
        reason: Plain explanation; no accuracy or audibility verdict.
        point: Current all-source machinery estimate, never a historical prediction.
    """

    status: Literal["available", "unsupported", "source_missing", "source_changed"]
    reason: str
    point: Point | None = None


def compare_measurement(
    item: Measurement, scenario: Scenario, source_modes: dict[str, str] | None = None
) -> Comparison:
    """Compare only a known stationary average with its recorded source setup.

    Args:
        item: Stored pressure observation; total measured sound may include background.
        scenario: Current simulation; all active sources remain included.
        source_modes: Current optional operating labels used for context compatibility only.

    Returns:
        Explicit limitation or current machinery-only result. No pressure subtraction,
        source calibration, background isolation or moving-source approximation occurs.
    """
    if item.test_kind != "stationary":
        return Comparison(
            status="unsupported",
            reason="Comparison needs a stationary, steady test; moving, startup and unknown tests remain recorded.",
        )
    if item.metric != "LAeq":
        return Comparison(
            status="unsupported",
            reason="Comparison needs a known LAeq reading; maxima and unknown meter readings remain recorded.",
        )
    if item.duration_s is None or not item.activity:
        return Comparison(
            status="unsupported", reason="Record the averaging duration and operating activity before comparing."
        )
    source = next((s for s in scenario.sources if s.id == item.source_id), None)
    if source is None:
        return Comparison(
            status="source_missing", reason="The recorded machine is unlinked or no longer in this scenario."
        )
    if item.source_context is None:
        return Comparison(status="unsupported", reason="Recorded machine setup is unknown.")
    machine: MachineType = next(t for t in scenario.types if t.id == source.type_id)
    current = SourceContext(
        **source.model_dump(),
        name=machine.name,
        lwa=machine.lwa,
        operating_mode=(source_modes or {}).get(source.id, ""),
    )
    if current != item.source_context:
        return Comparison(
            status="source_changed",
            reason="The linked machine setup has changed since this reading was recorded.",
        )
    types = {t.id: t for t in scenario.types}
    point = at_point(Receiver(id=item.id, lat=item.lat, lng=item.lng), scenario.sources, types)
    return Comparison(
        status="available",
        reason=(
            "Current geometry estimate: all active machines, excluding background. "
            "Measured total includes other sound; this is not a prediction error or validation."
        ),
        point=screen_receiver(point, scenario.background_db),
    )
