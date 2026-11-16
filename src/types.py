from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class Position(StrictModel):
    lat: float = Field(ge=-85, le=85)
    lng: float = Field(ge=-180, le=180)


class MachineType(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    lwa: float = Field(ge=0, le=180)
    provenance: Literal["example", "measured"] = "example"


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

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if self.south >= self.north or self.west >= self.east:
            raise ValueError("Map bounds must have positive width and height")
        return self


class Scenario(StrictModel):
    types: list[MachineType] = Field(default_factory=list[MachineType], max_length=50)
    sources: list[Source] = Field(default_factory=list[Source], max_length=100)
    receivers: list[Receiver] = Field(default_factory=list[Receiver], max_length=20)
    cloud_cover: int = Field(default=0, ge=0, le=100, strict=True)
    bounds: Bounds | None = None

    @model_validator(mode="after")
    def references(self) -> Self:
        for collection in (self.types, self.sources, self.receivers):
            ids = [item.id for item in collection]
            if len(ids) != len(set(ids)):
                raise ValueError("IDs must be unique within each collection")
        type_ids = {item.id for item in self.types}
        if any(source.type_id not in type_ids for source in self.sources):
            raise ValueError("Every source must reference an existing machine type")
        return self


class Contribution(BaseModel):
    id: str
    name: str
    distance_m: float
    level_db: float
    near_field: bool
    provenance: Literal["example", "measured"]


class Point(BaseModel):
    level_db: float | None
    near_field: bool
    contributions: list[Contribution]


class Grid(BaseModel):
    rows: Literal[48]
    columns: Literal[48]
    bounds: dict[str, float]
    values: list[float | None]


class Prediction(BaseModel):
    receivers: dict[str, Point]
    grid: Grid | None
    cloud_cover: int
    cloud_correction_db: None
    example_data: bool
    model: str
