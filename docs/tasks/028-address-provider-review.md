# Task 028 — Address-search provider review

Reviewed 18 November 2026. **Approved by the owner on 18 November 2026: Photon public API.**
This records the provider decision for [task 028](028-address-search-autocomplete.md).
The approved API adapter is implemented first; browser integration follows in a stacked PR.

## Comparison

| Service | Autocomplete and cost | Setup / limits | POC decision |
| --- | --- | --- | --- |
| [Photon public demo](https://github.com/komoot/photon#demo-server) | Explicit search-as-you-type support; public API available without an account/key | Reasonable request volume only; extensive usage may be throttled/banned. No numeric quota or availability guarantee is promised. Based on OpenStreetMap data. | Recommend for this small POC, with restrained requests and clear failure handling. |
| [Geoapify autocomplete](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/) | Dedicated autocomplete API; [Free plan](https://www.geoapify.com/pricing/) lists 3,000 credits/day and up to 5 requests/second | Account and API key required. Free commercial use permitted within plan limits; Geoapify and data-source attribution required. Credits are not a promise of 3,000 completed user searches. | Alternative if the owner prefers an account-based service with published limits. No account/key or live integration tested. |
| [Public Nominatim](https://operations.osmfoundation.org/policies/nominatim/) | Its policy explicitly prohibits autocomplete | The public endpoint cannot be used for this feature, even with debouncing. This restriction does not describe all privately hosted Nominatim services. | Excluded; no queries sent. |

Photon fits the request for a free POC with little setup. Only its hosted API is proposed:
no Photon software, Java, OpenSearch or geocoder database would be installed. Address
coverage depends on the underlying data; these tests do not establish complete Australian
house-number coverage or survey accuracy. Search moves the camera, not equipment.

## Small live probes

Three public place/street queries were made with the standard Python HTTP client. No
private addresses, saved scenarios, machine positions or receiver data were sent.
Coordinates below are returned search centres, not independent location measurements.

| Query | First returned match | Latitude, longitude |
| --- | --- | --- |
| Greenbushes Western Australia | Greenbushes, WA 6254 | −33.8494245, 116.0595868 |
| Bunbury Western Australia | Bunbury, WA 6230 | −33.3267797, 115.6366980 |
| Blackwood Road Greenbushes | Blackwood Road, Greenbushes, WA 6254 | −33.8458162, 116.0555472 |

The street query also returned named public premises with house numbers. That demonstrates
some address data, not comprehensive coverage. A request with Origin
`http://127.0.0.1:8767` returned `Access-Control-Allow-Origin: *`; browser access is possible.
Raw local research artifacts are under `/tmp/sound-model-provider-review/`; the official
linked pages above are the source for terms and limits, not assumptions from the probes.

## Approved integration plan

- One address/place field in existing map navigation. Show up to five labelled suggestions;
  retain coordinate entry, Greenbushes and local-fit actions. Do not select automatically.
- Start after at least three non-whitespace characters and a 500 ms pause. Cancel/ignore
  stale responses and never request on an empty query or during IME composition.
- Use the existing Python backend as a small adapter to coordinate fair use across browser
  tabs: at most one upstream request per second per backend process, bounded in-memory
  caching, timeouts and no automatic retry loop. This is a conservative app policy, not
  a Photon-published quota. Although CORS permits direct browser requests, the adapter
  centralises usage control without a new package or credential.
- Post search inputs to the local adapter rather than putting text in local access-log URLs.
  Send only the query, language, result limit and map-centre bias to Photon. The external
  service receives these inputs and the backend computer's public IP. Do not send machine,
  receiver, sound-power or scenario data, and do not save search history in scenario files.
- Validate GeoJSON coordinates as longitude/latitude before converting to Leaflet order.
  Photon extents use west/north/east/south. Validate and convert bounds; when unsuitable,
  use the valid returned point and a sensible zoom. Never fabricate or clamp locations.
- Keyboard-accessible suggestions support Up/Down, Enter and Escape. Provide loading,
  no-match, offline and rate/error feedback. Keep search-result attribution to Photon and
  [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) visible near results;
  explain external search in About without adding technical prose to the main map.
- Choosing a result changes the camera only, with zero prediction/contour/range calls.
  Retain existing Save/recovery semantics for camera changes. The provider adapter remains
  separate from the map renderer so a future provider can be substituted.

Use existing Python/FastAPI and vanilla JavaScript; no dependency is proposed. If the API
adapter and browser UI together exceed a focused change, make separate stacked PRs within
task 028. A public demo is not an offline or guaranteed service: coordinate navigation
must remain usable if lookup fails. Do not add an unapproved fallback provider.

## Approval and remaining checks

The owner replied “Photon is fine to use” on 18 November 2026. The adapter is approved;
full feature acceptance remains incomplete until the browser integration is verified. The existing project rule is:
“The owner must approve new third-party technologies/dependencies before adoption”
([AGENTS.md](../../AGENTS.md)).

After approval, test actual street-address selection, keyboard/mouse interaction, stale
responses, malformed coordinates/bounds, errors and throttling with offline fixtures. Then
verify two live locations, screenshots at desktop/390 px, preserved inputs and zero sound
requests on search/navigation. No runtime test is claimed for this documentation-only review.
