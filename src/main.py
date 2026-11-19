"""FastAPI application entry point for the Sound-Model web server and REST API."""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse

from .acoustics import at_point
from .assets import FrontendFiles
from .bands import at_receiver_bands
from .contour_range import ContourRange, calculate_contour_range
from .contours import build_contours
from .geocoding_routes import router as geocoding_router
from .measurement_fitting import FitRequest, FitResult, fit_measurements
from .measurements import Comparison, MeasurementRequest, compare_measurement
from .pages import about_page, index_page, machine_estimates_page
from .scenario_routes import router as scenario_router
from .scope import screen_receiver
from .types import ContourRequest, ContourResponse, MachineType, Point, Prediction, Scenario

app = FastAPI(title="Sound-Model", docs_url=None, redoc_url=None, openapi_url=None)


@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exception: RequestValidationError) -> JSONResponse:
    """Return a sanitised HTTP 422 JSON response for Pydantic validation errors.

    Strips raw ``input`` values and validator ``ctx`` objects so non-finite JSON
    literals (such as ``NaN`` or ``Infinity``) are never echoed or serialized.

    Args:
        request: Incoming FastAPI HTTP request that failed validation.
        exception: Raised validation error containing structured error dictionaries.

    Returns:
        A ``JSONResponse`` with status code 422 and sanitised error details.
    """
    details = [{key: error[key] for key in ("loc", "msg", "type")} for error in exception.errors()]
    return JSONResponse(status_code=422, content={"detail": details})


@app.get("/api/health")
def health() -> dict[str, str]:
    """Report application health and the active acoustic model identifier.

    Returns:
        Dictionary containing ``status`` and ``model`` keys.
    """
    return {"status": "ok", "model": "full-space-point-source-v1"}


@app.post("/api/predict", response_model=Prediction)
def predict(scenario: Scenario) -> Prediction:
    """Evaluate receivers directly without calculating map geometry.

    Args:
        scenario: Source catalogue, placed machines, receivers and cloud metadata.

    Returns:
        Direct receiver readings with provenance and model metadata.
    """
    types: dict[str, MachineType] = {item.id: item for item in scenario.types}
    receivers: dict[str, Point] = {
        point.id: screen_receiver(at_point(point, scenario.sources, types), scenario.background_db)
        for point in scenario.receivers
    }
    return Prediction(
        receivers=receivers,
        band_results={
            point.id: at_receiver_bands(point, scenario.sources, types, scenario.background_spectrum)
            for point in scenario.receivers
        }
        if scenario.background_spectrum is not None
        or any(types[s.type_id].spectrum is not None for s in scenario.sources)
        else {},
        cloud_cover=scenario.cloud_cover,
        cloud_correction_db=None,
        example_data=any(types[source.type_id].provenance == "example" for source in scenario.sources),
        model="full-space-point-source-v1",
    )


@app.post("/api/measurements/fit", response_model=FitResult)
def measurement_fit(request: FitRequest) -> FitResult:
    """Preview an isolated-machine or combined-area emission estimate.

    Args:
        request: Selected observations, roles, operating basis and source geometry.

    Returns:
        Read-only fit with separate check results and explicit excluded-reading reasons.
    """
    return fit_measurements(request)


@app.post("/api/measurements/compare")
def measurement_comparisons(request: MeasurementRequest) -> dict[str, Comparison]:
    """Return per-observation eligibility/current estimates without fitting the model.

    Args:
        request: Current scenario and bounded observation records.

    Returns:
        Independent comparison states keyed by stable measurement ID.
    """
    return {item.id: compare_measurement(item, request, request.source_modes) for item in request.measurements}


@app.post("/api/contour-range", response_model=ContourRange)
def contour_range(scenario: Scenario) -> ContourRange:
    """Return useful slider bounds for the current source layout and model.

    Args:
        scenario: Current acoustic inputs, without camera or selected criterion.

    Returns:
        Checked contour-producing bounds or an unavailable explanation.
    """
    return calculate_contour_range(scenario)


@app.post("/api/contours", response_model=ContourResponse)
def contours(scenario: ContourRequest) -> ContourResponse:
    """Calculate combined-source contour lines without camera-dependent bounds.

    Args:
        scenario: Validated sources and requested decibel thresholds.

    Returns:
        Connected geographic lines and the model identifier.

    """
    return build_contours(scenario)


app.include_router(scenario_router)
app.include_router(geocoding_router)

app.add_api_route("/about", about_page, methods=["GET"], response_class=HTMLResponse)
app.add_api_route("/machine-estimates", machine_estimates_page, methods=["GET"], response_class=HTMLResponse)
app.add_api_route("/", index_page, methods=["GET"], response_class=HTMLResponse)
app.add_api_route("/index.html", index_page, methods=["GET"], response_class=HTMLResponse)

app.mount("/", FrontendFiles(directory=Path(__file__).parent / "static", html=True), name="frontend")
