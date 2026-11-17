"""FastAPI application entry point for the Sound-Model web server and REST API."""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse

from .acoustics import at_point
from .assets import FrontendFiles
from .contours import build_contours
from .pages import index_page, machine_estimates_page
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
    receivers: dict[str, Point] = {point.id: at_point(point, scenario.sources, types) for point in scenario.receivers}
    return Prediction(
        receivers=receivers,
        cloud_cover=scenario.cloud_cover,
        cloud_correction_db=None,
        example_data=any(types[source.type_id].provenance == "example" for source in scenario.sources),
        model="full-space-point-source-v1",
    )


@app.post("/api/contours", response_model=ContourResponse)
def contours(scenario: ContourRequest) -> ContourResponse:
    """Calculate combined-source contour lines without camera-dependent bounds.

    Args:
        scenario: Validated sources and requested decibel thresholds.

    Returns:
        Connected geographic lines and the model identifier.

    Raises:
        HTTPException: If requested geometry exceeds numerical safety limits.
    """
    try:
        return build_contours(scenario)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


app.add_api_route("/machine-estimates", machine_estimates_page, methods=["GET"], response_class=HTMLResponse)
app.add_api_route("/", index_page, methods=["GET"], response_class=HTMLResponse)
app.add_api_route("/index.html", index_page, methods=["GET"], response_class=HTMLResponse)

app.mount("/", FrontendFiles(directory=Path(__file__).parent / "static", html=True), name="frontend")
