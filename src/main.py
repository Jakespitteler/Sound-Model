"""FastAPI application entry point for the Sound-Model web server and REST API."""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .acoustics import at_point, combine, distance_metres, inverse_mercator, mercator_y, source_level
from .types import Bounds, Grid, MachineType, Point, Position, Prediction, Scenario

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
    """Compute receiver sound pressure levels and an optional 48x48 heatmap grid.

    Evaluates every receiver directly and, when both ``scenario.bounds`` and at
    least one source are present, samples a 48x48 grid spaced uniformly in Web
    Mercator projection space.

    Args:
        scenario: Validated acoustic scenario containing types, sources, receivers,
            and optional viewport bounds.

    Returns:
        A :class:`Prediction` containing receiver readings, optional grid values,
        and scenario metadata.
    """
    types: dict[str, MachineType] = {item.id: item for item in scenario.types}
    receivers: dict[str, Point] = {point.id: at_point(point, scenario.sources, types) for point in scenario.receivers}
    grid: Grid | None = None
    if scenario.bounds and scenario.sources:
        bounds: Bounds = scenario.bounds
        rows = columns = 48
        top: float = mercator_y(bounds.north)
        bottom: float = mercator_y(bounds.south)
        values: list[float | None] = []
        for row in range(rows):
            lat = inverse_mercator(top + (bottom - top) * (row + 0.5) / rows)
            for col in range(columns):
                lng = bounds.west + (bounds.east - bounds.west) * (col + 0.5) / columns
                point = Position(lat=lat, lng=lng)
                values.append(
                    combine(
                        [
                            source_level(types[source.type_id].lwa, distance_metres(source, point))
                            for source in scenario.sources
                        ]
                    )
                )
        grid = Grid(
            rows=rows,
            columns=columns,
            bounds=bounds.model_dump(),
            values=values,
        )
    return Prediction(
        receivers=receivers,
        grid=grid,
        cloud_cover=scenario.cloud_cover,
        cloud_correction_db=None,
        example_data=any(types[source.type_id].provenance == "example" for source in scenario.sources),
        model="full-space-point-source-v1",
    )


app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="frontend")
