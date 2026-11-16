from pathlib import Path
from typing import Literal

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .acoustics import at_point, combine, distance_metres, inverse_mercator, mercator_y, source_level


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False, str_strip_whitespace=True)


class Position(StrictModel):
    lat: float = Field(ge=-85, le=85)
    lng: float = Field(ge=-180, le=180)


class MachineType(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    lwa: float = Field(ge=0, le=180)
    provenance: Literal['example', 'measured'] = 'example'


class Source(Position):
    id: str = Field(min_length=1, max_length=80)
    type_id: str = Field(min_length=1, max_length=80)


class Receiver(Position):
    id: str = Field(min_length=1, max_length=80)


class Bounds(StrictModel):
    south: float = Field(ge=-85, le=85)
    north: float = Field(ge=-85, le=85)
    west: float = Field(ge=-180, le=180)
    east: float = Field(ge=-180, le=180)

    @model_validator(mode='after')
    def ordered(self):
        if self.south >= self.north or self.west >= self.east:
            raise ValueError('Map bounds must have positive width and height')
        return self


class Scenario(StrictModel):
    types: list[MachineType] = Field(default_factory=list, max_length=50)
    sources: list[Source] = Field(default_factory=list, max_length=100)
    receivers: list[Receiver] = Field(default_factory=list, max_length=20)
    cloud_cover: int = Field(default=0, ge=0, le=100, strict=True)
    bounds: Bounds | None = None

    @model_validator(mode='after')
    def references(self):
        for collection in (self.types, self.sources, self.receivers):
            ids = [item.id for item in collection]
            if len(ids) != len(set(ids)):
                raise ValueError('IDs must be unique within each collection')
        type_ids = {item.id for item in self.types}
        if any(source.type_id not in type_ids for source in self.sources):
            raise ValueError('Every source must reference an existing machine type')
        return self


app = FastAPI(title='Sound-Model', docs_url=None, redoc_url=None, openapi_url=None)


@app.get('/api/health')
def health():
    return {'status': 'ok', 'model': 'full-space-point-source-v1'}


@app.post('/api/predict')
def predict(scenario: Scenario):
    types = {item.id: item for item in scenario.types}
    receivers = [{'id': point.id, **at_point(point, scenario.sources, types)} for point in scenario.receivers]
    grid = None
    if scenario.bounds and scenario.sources:
        bounds = scenario.bounds
        rows = columns = 48
        top, bottom = mercator_y(bounds.north), mercator_y(bounds.south)
        values = []
        for row in range(rows):
            lat = inverse_mercator(top + (bottom - top) * (row + 0.5) / rows)
            for col in range(columns):
                lng = bounds.west + (bounds.east - bounds.west) * (col + 0.5) / columns
                point = Position(lat=lat, lng=lng)
                values.append(combine([
                    source_level(types[source.type_id].lwa, distance_metres(source, point))
                    for source in scenario.sources
                ]))
        grid = {'rows': rows, 'columns': columns, 'bounds': bounds.model_dump(), 'values': values}
    return {
        'receivers': receivers, 'grid': grid,
        'cloud_cover': scenario.cloud_cover, 'cloud_correction_db': None,
        'example_data': any(types[source.type_id].provenance == 'example' for source in scenario.sources),
        'model': 'full-space-point-source-v1',
    }


app.mount('/', StaticFiles(directory=Path(__file__).parent / 'static', html=True), name='frontend')
