"""Small Photon adapter with validated results and bounded public-service usage."""

import json
import math
from collections import OrderedDict
from collections.abc import Callable
from threading import Lock
from time import monotonic
from typing import cast
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from pydantic import BaseModel, ConfigDict, Field, JsonValue


class SearchQuery(BaseModel):
    """Search text and camera bias only; never accepts acoustic/scenario inputs.

    Attributes:
        query: Trimmed address or place text.
        lat: Camera latitude used only for search ranking.
        lng: Camera longitude used only for search ranking.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)
    query: str = Field(min_length=3, max_length=160)
    lat: float = Field(ge=-85, le=85)
    lng: float = Field(ge=-180, le=180)


class Place(BaseModel):
    """One navigable result, independent of the map renderer.

    Attributes:
        label: Human-readable name/address and locality.
        lat: Validated latitude.
        lng: Validated longitude.
        bounds: Optional south/west/north/east bounds, enclosing the point.
    """

    model_config = ConfigDict(frozen=True, allow_inf_nan=False)
    label: str
    lat: float = Field(ge=-85, le=85)
    lng: float = Field(ge=-180, le=180)
    bounds: tuple[float, float, float, float] | None = None


class GeocodingBusy(Exception):
    """The request budget is occupied; retry_after gives a bounded wait in seconds."""

    def __init__(self, retry_after: int = 1) -> None:
        """Record a conservative cooldown.

        Args:
            retry_after: Seconds before a new upstream attempt is allowed.
        """
        super().__init__("Address search is busy")
        self.retry_after = max(1, min(300, retry_after))


class GeocodingUnavailable(Exception):
    """The provider could not return a usable response."""


def number(value: JsonValue) -> float | None:
    """Read finite JSON numbers, rejecting booleans and numeric strings.

    Args:
        value: Untrusted provider value.

    Returns:
        Finite number or None.
    """
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    try:
        result = float(value)
    except OverflowError:
        return None
    return result if math.isfinite(result) else None


def parse_places(raw: JsonValue) -> list[Place]:
    """Convert Photon GeoJSON to bounded, labelled results without guessed locations.

    Args:
        raw: Decoded provider document.

    Returns:
        At most five valid points; unsupported bounds fall back to their valid point.

    Raises:
        GeocodingUnavailable: The provider envelope is malformed.
    """
    features = raw.get("features") if isinstance(raw, dict) else None
    if not isinstance(features, list):
        raise GeocodingUnavailable
    places: list[Place] = []
    seen: set[tuple[str, float, float]] = set()
    for feature in features:
        if not isinstance(feature, dict):
            continue
        geometry, props = feature.get("geometry"), feature.get("properties")
        if not isinstance(geometry, dict) or not isinstance(props, dict) or geometry.get("type") != "Point":
            continue
        coords = geometry.get("coordinates")
        if not isinstance(coords, list) or len(coords) < 2:
            continue
        lng, lat = number(coords[0]), number(coords[1])
        if lat is None or lng is None or abs(lat) > 85 or abs(lng) > 180:
            continue
        parts: list[str] = []
        for key in ["name", "street", "city", "town", "village", "district", "state", "postcode", "country"]:
            value = props.get(key)
            if not isinstance(value, str) or not value.strip():
                continue
            text = value.strip()[:160]
            house = props.get("housenumber")
            if key == "street" and isinstance(house, (str, int)) and not isinstance(house, bool):
                text = f"{str(house)[:30]} {text}"
            if text not in parts:
                parts.append(text)
        if not parts or not any(props.get(key) for key in ["name", "street", "city", "town", "village"]):
            continue
        label = ", ".join(parts)
        identity = (label, lat, lng)
        if identity in seen:
            continue
        bounds = None
        extent = props.get("extent")
        if isinstance(extent, list) and len(extent) == 4:
            west, north, east, south = [number(value) for value in extent]
            if (
                west is not None
                and north is not None
                and east is not None
                and south is not None
                and -180 <= west <= lng <= east <= 180
                and -85 <= south <= lat <= north <= 85
                and west < east
                and south < north
            ):
                bounds = (south, west, north, east)
        places.append(Place(label=label, lat=lat, lng=lng, bounds=bounds))
        seen.add(identity)
        if len(places) == 5:
            break
    return places


def fetch_photon(query: SearchQuery) -> list[Place]:
    """Query only the approved Photon host using the standard Python HTTP client.

    Args:
        query: Validated text and camera bias.

    Returns:
        Parsed locations.

    Raises:
        GeocodingBusy: Photon returned HTTP 429.
        GeocodingUnavailable: Network, timeout, oversized or malformed response.
    """
    params = urlencode({"q": query.query, "lat": query.lat, "lon": query.lng, "limit": 5, "lang": "en"})
    request = Request(
        "https://photon.komoot.io/api/?" + params,
        headers={
            "User-Agent": "Sound-Model/0.1 (https://github.com/Jakespitteler/Sound-Model)",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=5) as response:
            body = response.read(262145)
        if len(body) > 262144:
            raise GeocodingUnavailable
        return parse_places(cast(JsonValue, json.loads(body)))
    except HTTPError as error:
        if error.code == 429:
            try:
                wait = int(error.headers.get("Retry-After", "30"))
            except ValueError:
                wait = 30
            raise GeocodingBusy(wait) from error
        raise GeocodingUnavailable from error
    except (URLError, OSError, ValueError) as error:
        raise GeocodingUnavailable from error


class PhotonClient:
    """One upstream request at a time, one start per second, and a small expiring cache."""

    def __init__(
        self,
        fetcher: Callable[[SearchQuery], list[Place]] = fetch_photon,
        clock: Callable[[], float] = monotonic,
        cache_size: int = 128,
    ) -> None:
        """Set up process-local usage controls without any persistent query history.

        Args:
            fetcher: Provider operation; injectable for offline tests.
            clock: Monotonic time source.
            cache_size: Maximum cached query/bias pairs.
        """
        self._fetcher = fetcher
        self._clock = clock
        self._capacity = cache_size
        self._cache: OrderedDict[tuple[str, float, float], tuple[float, list[Place]]] = OrderedDict()
        self._last_start = -math.inf
        self._cooldown_until = -math.inf
        self._lock = Lock()

    def search(self, query: SearchQuery) -> list[Place]:
        """Return cached results or make one bounded provider request without queuing.

        Args:
            query: Validated text and map centre.

        Returns:
            Locations matching the query, possibly empty.

        Raises:
            GeocodingBusy: Another lookup is active or started less than a second ago.
            GeocodingUnavailable: The provider failed.
        """
        if not self._lock.acquire(blocking=False):
            raise GeocodingBusy
        try:
            now = self._clock()
            key = (query.query, query.lat, query.lng)
            cached = self._cache.get(key)
            if cached and now - cached[0] < 300:
                self._cache.move_to_end(key)
                return list(cached[1])
            if now < self._cooldown_until:
                raise GeocodingBusy(math.ceil(self._cooldown_until - now))
            if now - self._last_start < 1:
                raise GeocodingBusy
            self._last_start = now
            try:
                places = self._fetcher(query)
            except GeocodingBusy as error:
                self._cooldown_until = self._clock() + error.retry_after
                raise
            self._cache[key] = (now, places)
            self._cache.move_to_end(key)
            while len(self._cache) > self._capacity:
                self._cache.popitem(last=False)
            return list(places)
        finally:
            self._lock.release()
