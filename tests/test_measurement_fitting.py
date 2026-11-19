"""Independent synthetic fits, background energy correction and held-out checks."""

import math

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.main import app
from src.measurement_fitting import FitRequest, fit_measurements, separated_pressure
from src.measurements import Measurement, SourceContext
from src.scenario_files import ScenarioDocument
from src.types import MachineType, Source


def fitting(mode: str = "machine") -> FitRequest:
    """Create independent spherical reference readings with a known background.

    Args:
        mode: Machine or area workflow.

    Returns:
        Three fictional locations for a 110 dB source, with one held-out check.
    """
    source = Source(id="s", type_id="t", lat=0, lng=0)
    readings: list[Measurement] = []
    for index, distance in enumerate([100, 200, 400]):
        pressure = 110 - 10 * math.log10(4 * math.pi * distance**2)
        total = 10 * math.log10(10 ** (pressure / 10) + 10 ** (30 / 10))
        readings.append(
            Measurement(
                id=str(index),
                lat=0,
                lng=math.degrees(distance / 6371008.8),
                level_db=total,
                metric="LAeq",
                test_kind="stationary",
                duration_s=60,
                activity="Steady operation",
                isolation="isolated",
                source_id="s",
                source_context=SourceContext(**source.model_dump(), name="Test source", lwa=120),
            )
        )
    return FitRequest.model_validate(
        dict(
            mode=mode,
            source_id="s" if mode == "machine" else None,
            centre={"lat": 0, "lng": 0} if mode == "area" else None,
            radius_m=20 if mode == "area" else None,
            activity="Steady operation",
            fit_ids=["0", "1"],
            check_ids=["2"],
            measurements=readings,
            background_db=30,
            background_confirmed=True,
            types=[MachineType(id="t", name="Test source", lwa=120)],
            sources=[source],
        )
    )


@pytest.mark.parametrize("mode", ["machine", "area"])
def test_fit_recovers_power_and_keeps_check_independent(mode: str) -> None:
    """Recover a known source without fitting the check point or mutating inputs."""
    request = fitting(mode)
    before = request.model_dump()
    result = fit_measurements(request)
    assert result.ready and result.lwa == pytest.approx(110, abs=1e-9)
    assert all(row.difference_db == pytest.approx(0, abs=1e-9) for row in result.rows)
    assert request.model_dump() == before
    request.measurements[2].level_db += 6
    changed = fit_measurements(request)
    assert changed.lwa == result.lwa
    assert changed.rows[2].difference_db is not None and changed.rows[2].difference_db > 6


@pytest.mark.parametrize("gap", [3, 6, 10, 100, 10000])
def test_stable_background_energy_subtraction(gap: float) -> None:
    """Subtract energies, retaining stable high-dynamic-range levels."""
    corrected = separated_pressure(45 + gap, 45)
    assert corrected is not None and math.isfinite(corrected)
    if gap < 100:
        assert 10 ** (corrected / 10) == pytest.approx(10 ** ((45 + gap) / 10) - 10**4.5)


@pytest.mark.parametrize("gap", [-100, 0, 2.999])
def test_background_dominated_not_used(gap: float) -> None:
    """Do not derive exact emission from inseparable pressure readings."""
    assert separated_pressure(45 + gap, 45) is None


@pytest.mark.parametrize(
    "field,value,reason",
    [
        ("isolation", "mixed", "not confirmed isolated"),
        ("isolation", "unknown", "not confirmed isolated"),
        ("metric", "LAmax", "LAeq"),
        ("duration_s", None, "duration"),
        ("test_kind", "moving", "stationary"),
        ("activity", "Other activity", "differs"),
        ("source_context", None, "setup"),
        ("level_db", 31, "3 dB"),
    ],
)
def test_ineligible_kept_with_reason(field: str, value: object, reason: str) -> None:
    """Keep each excluded record visible rather than silently altering selections."""
    request = fitting()
    setattr(request.measurements[0], field, value)
    result = fit_measurements(request)
    assert not result.ready and result.lwa is None
    assert reason in result.rows[0].reason
    assert len(result.rows) == 3


def test_missing_background_and_changed_machine_context() -> None:
    """Require a background basis and honor the recorded machine location/mode."""
    request = fitting()
    request.background_db = None
    assert "background" in fit_measurements(request).rows[0].reason
    request = fitting()
    request.sources[0].lat = 0.001
    assert "setup" in fit_measurements(request).rows[0].reason
    request = fitting()
    request.source_modes = {"s": "Loaded"}
    assert "setup" in fit_measurements(request).rows[0].reason


def test_area_works_without_machines_and_rejects_inside_readings() -> None:
    """Mixed site readings need no individual source, but interior points cannot fit it."""
    request = fitting("area")
    request.sources = []
    request.types = []
    for item in request.measurements:
        item.isolation = "mixed"
        item.source_id = None
        item.source_context = None
    assert fit_measurements(request).ready
    request.radius_m = 150
    assert "Inside" in fit_measurements(request).rows[0].reason
    assert not fit_measurements(request).ready


def test_distinct_check_and_near_field() -> None:
    """Prevent copied locations masquerading as independent checking and near-field fitting."""
    request = fitting()
    request.measurements[2].lng = request.measurements[0].lng
    assert "distinct" in fit_measurements(request).reason
    request.measurements[0].lng = 0
    assert "Within 1 m" in fit_measurements(request).rows[0].reason


@pytest.mark.parametrize(
    "patch",
    [
        {"fit_ids": ["0"]},
        {"check_ids": []},
        {"check_ids": ["0"]},
        {"check_ids": ["absent"]},
        {"source_id": "absent"},
        {"mode": "area", "centre": None},
        {"radius_m": float("inf")},
    ],
)
def test_invalid_selections(patch: dict[str, object]) -> None:
    """Reject missing, overlapping, unknown or nonfinite selections."""
    with pytest.raises(ValidationError):
        FitRequest.model_validate({**fitting().model_dump(), **patch})


def test_log_fit_and_recorded_evidence() -> None:
    """Use a declared least-squares dB fit, retain independent checks and full source data."""
    request = fitting()
    request.measurements[1].level_db += 4
    result = fit_measurements(request)
    assert result.ready and result.lwa is not None and 112 < result.lwa < 112.1
    evidence = {"request": request.model_dump(), "result": result.model_dump()}
    document = ScenarioDocument.model_validate(
        dict(
            types=[{**request.types[0].model_dump(), "fitting": evidence}],
            sources=request.sources,
            receivers=[],
            levels=[40],
            cloud_cover=0,
            measurements=request.measurements,
        )
    )
    restored = ScenarioDocument.model_validate_json(document.model_dump_json())
    assert restored.types[0].fitting is not None
    assert restored.types[0].fitting.request.measurements == request.measurements
    assert restored.types[0].fitting.result == result


def test_api_returns_preview_without_mutating_scene() -> None:
    """Expose isolated read-only fitting through the existing local backend."""
    response = TestClient(app).post("/api/measurements/fit", json=fitting().model_dump())
    assert response.status_code == 200
    assert response.json()["lwa"] == pytest.approx(110)
    assert response.json()["ready"]


def test_background_confirmation_and_caution() -> None:
    """Require a representative background and distinguish correction-sensitive gaps."""
    request = fitting()
    request.background_confirmed = False
    assert not fit_measurements(request).ready
    assert "Confirm" in fit_measurements(request).rows[0].reason
    request.background_confirmed = True
    request.measurements[0].level_db = 36
    assert "sensitive" in fit_measurements(request).rows[0].reason


def test_extreme_finite_readings_fail_without_nonfinite_output() -> None:
    """Retain finite inputs but reject an unrepresentable training spread explicitly."""
    request = fitting()
    request.background_db = -1.7e308
    request.measurements[0].level_db = -1e308
    request.measurements[1].level_db = 1e308
    result = fit_measurements(request)
    assert not result.ready and "dynamic range" in result.reason
    assert "Infinity" not in result.model_dump_json()
