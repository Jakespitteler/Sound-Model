"""Address search validation, provider parsing and bounded usage checks."""

import pytest
from fastapi.testclient import TestClient

from src.geocoding import GeocodingBusy, PhotonClient, Place, SearchQuery, parse_places
from src.main import app


def test_photon_order_bounds_and_address_label() -> None:
    """Convert provider coordinate order and retain a distinguishable street address."""
    places = parse_places(
        {
            "features": [
                {
                    "geometry": {"type": "Point", "coordinates": [116.05, -33.85]},
                    "properties": {
                        "name": "Town hall",
                        "housenumber": "46",
                        "street": "Blackwood Road",
                        "city": "Greenbushes",
                        "postcode": "6254",
                        "country": "Australia",
                        "extent": [116.04, -33.84, 116.06, -33.86],
                    },
                }
            ]
        }
    )
    assert places == [
        Place(
            label="Town hall, 46 Blackwood Road, Greenbushes, 6254, Australia",
            lat=-33.85,
            lng=116.05,
            bounds=(-33.86, 116.04, -33.84, 116.06),
        )
    ]


def test_cache_rate_limit_and_expiry() -> None:
    """Cache repeated queries, bound live calls, and expire cached locations."""
    now = [0.0]
    calls: list[str] = []

    def fetch(query: SearchQuery) -> list[Place]:
        """Return a deterministic provider result and count upstream queries."""
        calls.append(query.query)
        return [Place(label=query.query, lat=-33.85, lng=116.05)]

    client = PhotonClient(fetcher=fetch, clock=lambda: now[0])
    first = SearchQuery(query="Greenbushes", lat=-33.85, lng=116.05)
    assert client.search(first) == client.search(first)
    assert calls == ["Greenbushes"]
    with pytest.raises(GeocodingBusy):
        client.search(SearchQuery(query="Bunbury", lat=-33.85, lng=116.05))
    now[0] = 1.0
    client.search(SearchQuery(query="Bunbury", lat=-33.85, lng=116.05))
    now[0] = 301.0
    client.search(first)
    assert calls == ["Greenbushes", "Bunbury", "Greenbushes"]


def test_api_rejects_scenario_fields_before_contacting_provider() -> None:
    """Only bounded search inputs belong in the local address endpoint."""
    with TestClient(app) as client:
        response = client.post("/api/geocode", json={"query": "Town", "lat": -33.85, "lng": 116.05, "sources": []})
    assert response.status_code == 422


@pytest.mark.parametrize(
    "coords", [[True, 2], [1, False], ["116", -33], [float("inf"), -33], [181, -33], [116, 86], [10**1000, 0]]
)
def test_invalid_locations_are_never_clamped(coords: list[object]) -> None:
    """Discard unsupported numeric coordinates rather than navigating somewhere invented.

    Args:
        coords: Invalid GeoJSON longitude/latitude values.
    """
    import json
    from typing import cast

    from pydantic import JsonValue

    raw = cast(
        JsonValue,
        json.loads(
            json.dumps(
                {"features": [{"geometry": {"type": "Point", "coordinates": coords}, "properties": {"name": "Bad"}}]}
            )
        ),
    )
    assert parse_places(raw) == []


def test_invalid_bounds_duplicate_results_and_empty_response() -> None:
    """Keep a valid point when bounds cross the dateline, and collapse duplicate entries."""
    from pydantic import JsonValue

    feature: JsonValue = {
        "geometry": {"type": "Point", "coordinates": [116, -33]},
        "properties": {"name": "Town", "extent": [170, 5, -170, -5]},
    }
    assert parse_places({"features": [feature, feature]}) == [Place(label="Town", lat=-33, lng=116)]
    assert parse_places({"features": []}) == []


def test_result_budget_and_cache_eviction() -> None:
    """Limit suggestion count and evict least-recently-used cached queries."""
    from pydantic import JsonValue

    features: list[JsonValue] = [
        {"geometry": {"type": "Point", "coordinates": [i, 0]}, "properties": {"name": str(i)}} for i in range(8)
    ]
    assert len(parse_places({"features": features})) == 5
    now = [0.0]
    calls: list[str] = []

    def fetch(query: SearchQuery) -> list[Place]:
        """Count requests while producing legitimate empty responses."""
        calls.append(query.query)
        return []

    client = PhotonClient(fetcher=fetch, clock=lambda: now[0], cache_size=2)
    for name in ["One", "Two", "One", "Three", "Two"]:
        client.search(SearchQuery(query=name, lat=0, lng=0))
        now[0] += 1
    assert calls == ["One", "Two", "Three", "Two"]


def test_concurrent_lookups_do_not_queue() -> None:
    """An active upstream call excludes another, with no duplicate provider traffic."""
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event

    started, release = Event(), Event()

    def fetch(query: SearchQuery) -> list[Place]:
        """Hold a request until the concurrency assertion completes."""
        started.set()
        assert release.wait(5)
        return []

    client = PhotonClient(fetcher=fetch)
    query = SearchQuery(query="Town", lat=0, lng=0)
    with ThreadPoolExecutor() as pool:
        future = pool.submit(client.search, query)
        try:
            assert started.wait(5)
            with pytest.raises(GeocodingBusy):
                client.search(query)
        finally:
            release.set()
        assert future.result(timeout=5) == []


def test_provider_backoff_and_uncached_failure() -> None:
    """A provider cooldown is shared across new queries and failures are not cached."""
    now, calls = [0.0], [0]

    def fetch(query: SearchQuery) -> list[Place]:
        """Throttle the first request only."""
        calls[0] += 1
        if calls[0] == 1:
            raise GeocodingBusy(10)
        return []

    client = PhotonClient(fetcher=fetch, clock=lambda: now[0])
    query = SearchQuery(query="Town", lat=0, lng=0)
    with pytest.raises(GeocodingBusy):
        client.search(query)
    now[0] = 2
    with pytest.raises(GeocodingBusy) as error:
        client.search(query)
    assert error.value.retry_after == 8 and calls[0] == 1
    now[0] = 10
    assert client.search(query) == [] and calls[0] == 2


@pytest.mark.parametrize(
    "payload",
    [
        {"query": "  ", "lat": 0, "lng": 0},
        {"query": "x" * 161, "lat": 0, "lng": 0},
        {"query": "Town", "lat": 90, "lng": 0},
        {"query": "Town", "lat": 0, "lng": 190},
    ],
)
def test_query_validation(payload: dict[str, object]) -> None:
    """Invalid text or map bias never reaches a provider.

    Args:
        payload: Unsupported request document.
    """
    with TestClient(app) as client:
        assert client.post("/api/geocode", json=payload).status_code == 422


def test_http_success_and_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    """Expose stable HTTP results and generic errors without disclosing provider details.

    Args:
        monkeypatch: Offline adapter replacement.
    """
    from src import geocoding_routes
    from src.geocoding import GeocodingUnavailable

    def fetch(query: SearchQuery) -> list[Place]:
        """Return a success or a controlled provider failure."""
        if query.query == "Error":
            raise GeocodingUnavailable("private query/provider details")
        if query.query == "Busy":
            raise GeocodingBusy(12)
        return [Place(label="Town — 北", lat=-33, lng=116)]

    monkeypatch.setattr(geocoding_routes, "client", PhotonClient(fetcher=fetch))
    with TestClient(app) as client:
        body = {"query": "Town", "lat": 0, "lng": 0}
        result = client.post("/api/geocode", json=body)
        assert result.status_code == 200 and result.json()[0]["label"] == "Town — 北"
        assert client.get("/api/geocode").status_code == 404
        monkeypatch.setattr(geocoding_routes, "client", PhotonClient(fetcher=fetch))
        assert client.post("/api/geocode", json={**body, "query": "Error"}).status_code == 503
        monkeypatch.setattr(geocoding_routes, "client", PhotonClient(fetcher=fetch))
        busy = client.post("/api/geocode", json={**body, "query": "Busy"})
        assert busy.status_code == 429 and busy.headers["Retry-After"] == "12"
        assert "private" not in busy.text


def test_http_download_is_bounded_and_encoded(monkeypatch: pytest.MonkeyPatch) -> None:
    """Exercise the real download/parser boundary with deterministic HTTP responses.

    Args:
        monkeypatch: Replace outbound network only.
    """
    from typing import Self
    from urllib.parse import parse_qs, urlparse
    from urllib.request import Request

    from src import geocoding
    from src.geocoding import GeocodingUnavailable

    payload = [b'{"features":[]}']
    opened: list[Request] = []

    class Reply:
        """Minimal context-managed provider response."""

        def __enter__(self) -> Self:
            """Enter the response context."""
            return self

        def __exit__(self, *args: object) -> None:
            """Release the response context."""

        def read(self, size: int) -> bytes:
            """Read no more than the adapter's bounded byte budget.

            Args:
                size: Requested maximum bytes.

            Returns:
                Fixture bytes, bounded like an HTTP response.
            """
            return payload[0][:size]

    def download(request: Request, timeout: int) -> Reply:
        """Inspect the outbound request instead of contacting Photon.

        Args:
            request: Constructed HTTP request.
            timeout: Required finite timeout.

        Returns:
            Fake provider response.
        """
        assert timeout == 5
        opened.append(request)
        return Reply()

    monkeypatch.setattr(geocoding, "urlopen", download)
    query = SearchQuery(query="Town & 北", lat=-33, lng=116)
    assert geocoding.fetch_photon(query) == []
    url = urlparse(opened[0].full_url)
    assert url.scheme == "https" and url.hostname == "photon.komoot.io"
    assert parse_qs(url.query) == {
        "q": ["Town & 北"],
        "lat": ["-33.0"],
        "lon": ["116.0"],
        "limit": ["5"],
        "lang": ["en"],
    }
    assert (opened[0].get_header("User-agent") or "").startswith("Sound-Model/")
    for invalid in [b"{bad json", b"{}", b"x" * 262145]:
        payload[0] = invalid
        with pytest.raises(GeocodingUnavailable):
            geocoding.fetch_photon(query)
