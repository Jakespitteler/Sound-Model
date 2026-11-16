"""Unit and validation tests for the full-space point-source acoustic model."""

import math

import pytest
from pydantic import ValidationError

from src.acoustics import combine, distance_metres, inverse_mercator, mercator_y, source_level
from src.main import predict
from src.types import Bounds, Grid, MachineType, Point, Position, Prediction, Receiver, Scenario, Source


def generate_scenario(
    *,
    types: list[MachineType] | None = None,
    sources: list[Source] | None = None,
    receivers: list[Receiver] | None = None,
    cloud_cover: int = 0,
    bounds: Bounds | None = None,
) -> Scenario:
    """Create a valid acoustic scenario with baseline defaults.

    Args:
        types: Machine type definitions. Defaults to a single 100 dB example machine.
        sources: Acoustic sources placed on the map. Defaults to one source at (0, 0).
        receivers: Evaluation receiver points. Defaults to one receiver at (0, 0.001).
        cloud_cover: Percentage of cloud cover from 0 to 100.
        bounds: Optional geographic bounding box for grid evaluation.

    Returns:
        A validated :class:`Scenario` instance ready for prediction.
    """
    return Scenario(
        types=[MachineType(id="t", name="Example", lwa=100)] if types is None else types,
        sources=[Source(id="s", type_id="t", lat=0, lng=0)] if sources is None else sources,
        receivers=[Receiver(id="r", lat=0, lng=0.001)] if receivers is None else receivers,
        cloud_cover=cloud_cover,
        bounds=bounds,
    )


def test_reference_level() -> None:
    """Verify full-space spherical spreading loss at a 10 m reference distance."""
    # Lp = Lw - 20*log10(10) - 10*log10(4*pi)
    assert source_level(100, 10) == pytest.approx(69.00790136, abs=1e-6)


def test_distance_doubling() -> None:
    """Verify that doubling distance attenuates sound pressure level by ~6.02 dB."""
    assert source_level(100, 10) - source_level(100, 20) == pytest.approx(6.02059991)


def test_energetic_sum() -> None:
    """Verify logarithmic energy summation, dynamic-range stability, and empty input."""
    # Two equal incoherent levels add 10*log10(2) (~3.01 dB).
    assert combine([60, 60]) == pytest.approx(63.01029996)
    # Wide dynamic range must not suffer from floating-point underflow.
    assert combine([160, -160]) == pytest.approx(160)
    assert combine([]) is None


def test_geodesic() -> None:
    """Verify Haversine great-circle distance along the equator and across the antimeridian."""
    origin = Source(id="a", type_id="t", lat=0, lng=0)
    antimeridian_west = Source(id="b", type_id="t", lat=0, lng=179.999)
    # 1 degree of longitude at the equator is ~111.195 km on the mean Earth sphere.
    assert distance_metres(origin, Position(lat=0, lng=1)) == pytest.approx(111195.0802, abs=1e-3)
    # 0.002 degrees across +/-180 longitude should wrap cleanly rather than span the globe.
    assert distance_metres(antimeridian_west, Position(lat=0, lng=-179.999)) < 223


def test_combination_and_removal() -> None:
    """Verify multi-source energy addition and null outputs when all sources are removed."""
    one_level: float | None = predict(generate_scenario()).receivers["r"].level_db
    assert one_level is not None

    # Adding a second identical colocated source increases the receiver level by ~3.01 dB.
    two_prediction: Prediction = predict(
        generate_scenario(sources=[Source(id=str(i), type_id="t", lat=0, lng=0) for i in range(2)])
    )
    two_level: float | None = two_prediction.receivers["r"].level_db
    assert two_level is not None
    assert two_level - one_level == pytest.approx(3.01029996)

    # Removing all sources yields an empty prediction without generating a grid.
    empty: Prediction = predict(generate_scenario(sources=[]))
    assert empty.receivers["r"].level_db is None
    assert empty.grid is None


def test_clouds_do_not_invent_correction() -> None:
    """Verify that cloud_cover is recorded without applying an unverified attenuation offset."""
    clear_sky: Prediction = predict(generate_scenario(cloud_cover=0))
    overcast: Prediction = predict(generate_scenario(cloud_cover=100))
    assert clear_sky.receivers == overcast.receivers
    assert overcast.cloud_correction_db is None


def test_near_field_is_flagged() -> None:
    """Verify that receivers within 1 m of a source are flagged and remain finite."""
    # Place the receiver directly on top of the source (0 m separation).
    result: Point = predict(generate_scenario(receivers=[Receiver(id="r", lat=0, lng=0)])).receivers["r"]
    assert result.near_field is True
    assert result.level_db is not None
    assert math.isfinite(result.level_db)


def test_grid_centres_match_receiver() -> None:
    """Verify that the 48x48 prediction grid aligns with Mercator cell-centre coordinates."""
    bounds = Bounds(south=-0.01, north=0.01, west=-0.01, east=0.01)
    result: Prediction = predict(generate_scenario(bounds=bounds))
    grid: Grid | None = result.grid
    assert grid is not None
    assert len(grid.values) == 48 * 48
    assert all(v is not None and math.isfinite(v) for v in grid.values)

    # Cell (row=0, col=0) sits half a step (0.5 / 48 = 1 / 96) inside the north-west corner.
    lat: float = inverse_mercator(mercator_y(0.01) + (mercator_y(-0.01) - mercator_y(0.01)) / 96)
    expected: Prediction = predict(generate_scenario(receivers=[Receiver(id="r", lat=lat, lng=-0.01 + 0.02 / 96)]))
    expected_level: float | None = expected.receivers["r"].level_db
    assert expected_level is not None
    assert grid.values[0] == pytest.approx(expected_level)


@pytest.mark.parametrize(
    "case",
    [
        {"cloud_cover": -1},  # Below 0% minimum
        {"cloud_cover": 1.5},  # Non-integer rejected by strict int
        {"sources": [{"id": "s", "type_id": "missing", "lat": 0, "lng": 0}]},  # Unknown machine type ID
        {"receivers": [{"id": "r", "lat": float("nan"), "lng": 0}]},  # Non-finite coordinate
        {"receivers": [{"id": "r", "lat": 86, "lng": 0}]},  # Beyond Web Mercator latitude limit
        {"bounds": {"south": 1, "north": 0, "east": 1, "west": 0}},  # Inverted north/south bounds
        {"types": [{"id": "t", "name": "   ", "lwa": 100}]},  # Whitespace-only name after stripping
        {"types": [{"id": "t", "name": "x", "lwa": float("inf")}]},  # Infinite sound power level
        {"sources": [{"id": "s", "type_id": "t", "lat": 0, "lng": 0}] * 2},  # Duplicate source IDs
    ],
)
def test_bad_inputs(case: dict[str, object]) -> None:
    """Verify that invalid scenario payloads raise a Pydantic ValidationError.

    Args:
        case: Partial payload override containing a specific invalid field or constraint violation.
    """
    payload: dict[str, object] = {
        "types": [{"id": "t", "name": "Example", "lwa": 100}],
        "sources": [{"id": "s", "type_id": "t", "lat": 0, "lng": 0}],
        "receivers": [{"id": "r", "lat": 0, "lng": 0.001}],
        **case,
    }
    with pytest.raises(ValidationError):
        Scenario.model_validate(payload)
